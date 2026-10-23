/* ==========================================
   TASTYCUP - ORDER STATUS WORKFLOW
   Requires: core.js
   Shared by the admin dashboard, My Orders (profile) and the
   confirmation page, so all three always agree on an order's status.

   Delivery orders:  New Order > Preparing > Ready > Out for Delivery > Delivered
   Pickup orders:    New Order > Preparing > Ready > Picked Up

   Stored status values (what is saved in localStorage):
     Pending (shown as "New Order"), Preparing, Ready, Out for Delivery,
     Delivered, Picked Up, Cancelled, Rejected
   Older orders saved as "Accepted" are read as "Preparing", and "Completed"
   is kept as a finished order. Nothing in saved data is rewritten until an
   order is actually changed.
   ========================================== */

const ORDER_FLOWS = {
    delivery: ["Pending", "Preparing", "Ready", "Out for Delivery", "Delivered"],
    pickup:   ["Pending", "Preparing", "Ready", "Picked Up"]
};

const FINISHED_STATUSES = ["Delivered", "Picked Up", "Completed", "Cancelled", "Rejected"];

/* ---------- Reading an order ---------- */

// Orders made before pickup existed have no `fulfillment`, so they are deliveries.
function getFulfillment(order) {
    return order?.fulfillment === "pickup" ? "pickup" : "delivery";
}

function normalizeStatus(status) {
    const value = String(status || "Pending").trim().toLowerCase();

    if (["pending", "new", "new order"].includes(value)) return "Pending";
    if (["accepted", "preparing"].includes(value)) return "Preparing";
    if (value.startsWith("ready")) return "Ready";
    if (value === "out for delivery") return "Out for Delivery";
    if (value === "delivered") return "Delivered";
    if (value === "picked up" || value === "pickedup") return "Picked Up";
    if (value === "completed") return "Completed";
    if (value === "rejected") return "Rejected";
    if (value === "cancelled" || value === "canceled") return "Cancelled";

    return "Pending";
}

function getOrderStatus(order) {
    return normalizeStatus(order?.status);
}

function isFinishedStatus(status) {
    return FINISHED_STATUSES.includes(normalizeStatus(status));
}

// Text staff and customers see for the status.
function getStatusLabel(order) {
    const status = getOrderStatus(order);

    if (status === "Pending") return "New Order";
    if (status === "Ready") {
        return getFulfillment(order) === "pickup"
            ? "Ready for Pickup"
            : "Ready for Delivery";
    }

    return status;
}

// CSS class for the status badge, e.g. "status-out-for-delivery".
function getStatusClass(order) {
    return "status-" + getOrderStatus(order).toLowerCase().replace(/\s+/g, "-");
}

function formatDate(date) {
    if (!date) return "N/A";

    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "N/A";

    return parsed.toLocaleString("en-PH", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

/* ---------- The one-tap "next step" ---------- */

// Returns { from, to, label } for the order's next step, or null when there
// is nothing left to do (finished, cancelled, or an unknown older status).
function getNextAction(order) {
    const status = getOrderStatus(order);
    const pickup = getFulfillment(order) === "pickup";

    if (status === "Pending") {
        return { from: status, to: "Preparing", label: "Start Preparing" };
    }

    if (status === "Preparing") {
        return { from: status, to: "Ready", label: "Mark Ready" };
    }

    if (status === "Ready") {
        return pickup
            ? { from: status, to: "Picked Up", label: "Mark Picked Up" }
            : { from: status, to: "Out for Delivery", label: "Send Out" };
    }

    // Only delivery orders can be out for delivery.
    if (status === "Out for Delivery" && !pickup) {
        return { from: status, to: "Delivered", label: "Mark Delivered" };
    }

    return null;
}

/* ---------- Changing an order ---------- */

// Changes an order's status, but only if its CURRENT saved status is one of
// `allowedFrom`. Orders are re-read from storage every time, so a stale page
// (say, staff tapping a button for an order the customer just cancelled)
// can't overwrite a newer status.
// Returns { ok, message, order }.
function setOrderStatus(orderNumber, newStatus, allowedFrom) {
    const orders = getAllOrders();
    const index = orders.findIndex(order =>
        String(order.orderNumber) === String(orderNumber)
    );

    if (index === -1) {
        return { ok: false, message: "Order not found." };
    }

    const current = getOrderStatus(orders[index]);

    if (!allowedFrom.includes(current)) {
        return {
            ok: false,
            message: `This order was just updated and is now "${getStatusLabel(orders[index])}".`,
            order: orders[index]
        };
    }

    const now = new Date().toISOString();
    const previous = orders[index];

    const updated = {
        ...previous,
        status: newStatus,
        statusUpdatedAt: now,
        statusHistory: [
            ...(Array.isArray(previous.statusHistory) ? previous.statusHistory : []),
            { status: newStatus, at: now }
        ]
    };

    if (newStatus === "Delivered") updated.deliveredAt = now;
    if (newStatus === "Picked Up") updated.pickedUpAt = now;
    if (newStatus === "Cancelled") updated.cancelledAt = now;

    orders[index] = updated;

    try {
        saveAllOrders(orders);

        // Keep the customer's "last order" copy in sync.
        const last = getLastOrder();
        if (last && String(last.orderNumber) === String(orderNumber)) {
            localStorage.setItem("tastyCupLastOrder", JSON.stringify(updated));
        }
    } catch (error) {
        console.error("Unable to save order status:", error);
        return { ok: false, message: "Unable to save the change. Please try again." };
    }

    return { ok: true, order: updated };
}

// Staff: move ONE order to its next step. `expectedStatus` is the status the
// button was drawn for; if the order has changed since, nothing happens.
function advanceOrder(orderNumber, expectedStatus) {
    const order = getAllOrders().find(item =>
        String(item.orderNumber) === String(orderNumber)
    );

    if (!order) return { ok: false, message: "Order not found." };

    const action = getNextAction(order);

    if (!action || action.from !== normalizeStatus(expectedStatus)) {
        return {
            ok: false,
            message: `This order was just updated and is now "${getStatusLabel(order)}".`,
            order
        };
    }

    return setOrderStatus(orderNumber, action.to, [action.from]);
}

// Staff: cancel any order that is not already finished.
function cancelOrderForAdmin(orderNumber) {
    return setOrderStatus(orderNumber, "Cancelled",
        ["Pending", "Preparing", "Ready", "Out for Delivery"]);
}

// Customers may cancel only their own orders, and only while it is a New Order
// (Pending). Once the cafe starts preparing it, cancelling is no longer allowed.
function cancelOrderForCustomer(orderNumber) {
    const user = getCurrentUser();
    const order = getAllOrders().find(item =>
        String(item.orderNumber) === String(orderNumber)
    );

    if (!user || !order ||
        String(order.email || "").toLowerCase() !==
        String(user.email || "").toLowerCase()) {
        return { ok: false, message: "You can only cancel your own orders." };
    }

    const result = setOrderStatus(orderNumber, "Cancelled", ["Pending"]);

    if (!result.ok && result.order) {
        result.message =
            "Only new orders can be cancelled. The cafe has already started on this one.";
    }

    return result;
}

/* ---------- What the customer sees ---------- */

function getStatusMessage(order) {
    const status = getOrderStatus(order);
    const pickup = getFulfillment(order) === "pickup";

    switch (status) {
        case "Pending":
            return "Your order has been received and is waiting for the cafe to accept it.";
        case "Preparing":
            return "The cafe has accepted your order and is preparing it.";
        case "Ready":
            return pickup
                ? "Your order is ready for pickup!"
                : "Your order is ready and waiting to be sent out for delivery.";
        case "Out for Delivery":
            return "Your order is out for delivery and on its way to you.";
        case "Delivered":
            return "Your order has been delivered! Please check that it has arrived at your delivery address.";
        case "Picked Up":
            return "Your order has been picked up. Thank you and enjoy!";
        case "Completed":
            return "Your order is complete. Enjoy!";
        case "Rejected":
            return "Sorry, the cafe could not accept your order.";
        case "Cancelled":
            return "Your order has been cancelled.";
        default:
            return "";
    }
}

// The most recent change, e.g. "Preparing · Oct 23, 2026, 4:41 PM".
function getLastUpdateText(order) {
    const when = order?.statusUpdatedAt || order?.date;
    if (!when) return "";

    return `${getStatusLabel(order)} · ${formatDate(when)}`;
}

function getProgressSteps(order) {
    return getFulfillment(order) === "pickup"
        ? [
            ["Pending", "Order placed"],
            ["Preparing", "Preparing"],
            ["Ready", "Ready for pickup"],
            ["Picked Up", "Picked up"]
        ]
        : [
            ["Pending", "Order placed"],
            ["Preparing", "Preparing"],
            ["Ready", "Ready"],
            ["Out for Delivery", "On the way"],
            ["Delivered", "Delivered"]
        ];
}

// A simple step-by-step progress bar. Cancelled/rejected orders get no bar.
function renderProgressHTML(order) {
    const status = getOrderStatus(order);

    if (status === "Cancelled" || status === "Rejected") return "";

    const steps = getProgressSteps(order);
    const lastIndex = steps.length - 1;

    // Older "Completed" orders count as fully done.
    let currentIndex = status === "Completed"
        ? lastIndex
        : steps.findIndex(([key]) => key === status);

    if (currentIndex === -1) currentIndex = 0;

    return `
        <ol class="order-progress" aria-label="Order progress">
            ${steps.map(([, label], index) => {
                const state = index < currentIndex || (index === currentIndex && index === lastIndex)
                    ? "is-done"
                    : index === currentIndex ? "is-current" : "";

                return `<li class="${state}">
                    <span class="progress-dot" aria-hidden="true">${state === "is-done" ? "✓" : index + 1}</span>
                    <span class="progress-label">${escapeHTML(label)}</span>
                </li>`;
            }).join("")}
        </ol>`;
}
