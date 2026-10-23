// ==========================================
// TastyCup Admin Dashboard
// Requires: js/core.js (storage + staff helpers), js/orders.js (status workflow)
// Only an authorized employee (see AUTHORIZED_STAFF in core.js) can use it.
// ==========================================

const ORDERS_KEY = "tastyCupOrders";

// Quick filters. `match` decides which saved statuses belong to each one.
const ORDER_FILTERS = [
    { key: "All",       label: "All",              match: () => true },
    { key: "New",       label: "New",              match: s => s === "Pending" },
    { key: "Preparing", label: "Preparing",        match: s => s === "Preparing" },
    { key: "Ready",     label: "Ready",            match: s => s === "Ready" },
    { key: "Out",       label: "Out for Delivery", match: s => s === "Out for Delivery" },
    { key: "Completed", label: "Completed",        match: s => ["Delivered", "Picked Up", "Completed"].includes(s) },
    { key: "Cancelled", label: "Cancelled",        match: s => ["Cancelled", "Rejected"].includes(s) }
];

let currentFilter = "All";

// Orders rung up at the counter by the POS (see js/pos.js).
function isWalkInOrder(order) {
    return order?.orderType === "walk-in";
}

// Switch between the Orders list and the POS / Cashier screen.
function showAdminTab(tab) {
    const pos = tab === "pos";

    document.getElementById("ordersView").hidden = pos;
    document.getElementById("posView").hidden = !pos;
    document.getElementById("tabOrders").classList.toggle("active", !pos);
    document.getElementById("tabPos").classList.toggle("active", pos);

    if (!pos) renderOrders();
}

// Orders are always read fresh from storage.
function getOrders() {
    return getAllOrders();
}

function countFor(orders, key) {
    const filter = ORDER_FILTERS.find(item => item.key === key);
    return orders.filter(order => filter.match(getOrderStatus(order))).length;
}

// A short message above the table (replaces popups for rush-hour use).
function showNotice(message) {
    const notice = document.getElementById("adminNotice");
    notice.textContent = message;
    notice.hidden = false;

    clearTimeout(showNotice.timeout);
    showNotice.timeout = setTimeout(() => { notice.hidden = true; }, 5000);
}

function updateDashboard(orders) {
    const set = (id, key) => {
        document.getElementById(id).textContent = countFor(orders, key);
    };

    set("totalOrders", "All");
    set("newOrders", "New");
    set("preparingOrders", "Preparing");
    set("readyOrders", "Ready");
    set("outOrders", "Out");
    set("completedOrders", "Completed");
    set("cancelledOrders", "Cancelled");
}

function renderFilters(orders) {
    document.getElementById("quickFilters").innerHTML = ORDER_FILTERS.map(filter => `
        <button type="button"
                class="filter-chip ${filter.key === currentFilter ? "active" : ""}"
                data-filter="${filter.key}"
                aria-pressed="${filter.key === currentFilter}">
            ${filter.label}<span>${countFor(orders, filter.key)}</span>
        </button>
    `).join("");
}

function renderOrderRow(order) {
    const status = getOrderStatus(order);
    const pickup = getFulfillment(order) === "pickup";
    const walkIn = isWalkInOrder(order);
    const action = getNextAction(order);
    const id = escapeHTML(order.orderNumber);
    const finished = isFinishedStatus(status);

    const items = Array.isArray(order.items) && order.items.length
        ? order.items.map(item => {
            const name = escapeHTML(item.name || item.title || "Unknown item");
            const quantity = Number(item.quantity || 1);
            const size = item.size ? ` (${escapeHTML(item.size)})` : "";

            return `${name}${size} × ${quantity}`;
        }).join("<br>")
        : "No item details available";

    // The main action: one big button, or a label when nothing is left to do.
    let mainAction;

    if (action) {
        mainAction = `
            <button type="button" class="next-btn"
                    data-action="next"
                    data-order="${id}"
                    data-from="${escapeHTML(action.from)}">
                ${escapeHTML(action.label)}
            </button>`;
    } else if (status === "Cancelled" || status === "Rejected") {
        mainAction = `<span class="done-label cancelled">${escapeHTML(status)}</span>`;
    } else {
        mainAction = `<span class="done-label">✓ Completed</span>`;
    }

    return `
        <tr>
            <td data-label="Order">
                <div>
                    <strong>${escapeHTML(order.orderNumber || "N/A")}</strong>
                    <br>
                    <small>${escapeHTML(formatDate(order.date))}</small>
                </div>
            </td>

            <td data-label="Customer">
                <div>
                    <strong>${escapeHTML(order.customerName || "Guest")}</strong>
                    <br>
                    <small>${escapeHTML(order.phone || "")}</small>
                </div>
            </td>

            <td data-label="Items"><div>${items}</div></td>

            <td data-label="${walkIn ? "Type" : pickup ? "Pickup" : "Delivery"}">
                <div>
                    <span class="method-tag">${walkIn ? "Walk-in Order" : pickup ? "Pickup" : "Delivery"}</span>
                    ${pickup ? "" : `<br><small>${escapeHTML(order.address || "No address saved")}</small>`}
                </div>
            </td>

            <td data-label="Total">
                <div>
                    <strong>${formatPrice(order.total)}</strong>
                    <br>
                    <small>${escapeHTML(order.payment || "N/A")}</small>
                </div>
            </td>

            <td data-label="Status">
                <span class="order-status ${getStatusClass(order)}">
                    ${escapeHTML(getStatusLabel(order))}
                </span>
            </td>

            <td class="actions-cell" data-label="Action">
                ${mainAction}
                <div class="secondary-actions">
                    <button type="button" class="link-btn"
                            data-action="view" data-order="${id}">Details</button>
                    ${finished ? "" : `
                    <button type="button" class="link-btn danger"
                            data-action="cancel" data-order="${id}">Cancel order</button>`}
                </div>
            </td>
        </tr>`;
}

function renderOrders() {
    const allOrders = getOrders();
    const tableBody = document.getElementById("adminOrdersBody");
    const filter = ORDER_FILTERS.find(item => item.key === currentFilter) || ORDER_FILTERS[0];

    updateDashboard(allOrders);
    renderFilters(allOrders);

    // Newest orders first
    const orders = allOrders
        .filter(order => filter.match(getOrderStatus(order)))
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    if (orders.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-message">
                    ${allOrders.length === 0
                        ? "No orders yet. Orders will appear here after checkout."
                        : "No orders in this group."}
                </td>
            </tr>`;
        return;
    }

    tableBody.innerHTML = orders.map(renderOrderRow).join("");
}

/* ---------- Actions ---------- */

// One tap = one order moves one step. No confirmation for normal steps.
function handleNext(orderNumber, fromStatus) {
    const result = advanceOrder(orderNumber, fromStatus);

    if (!result.ok) showNotice(result.message);

    renderOrders();
}

// Cancelling is important, so it asks first.
function handleCancel(orderNumber) {
    if (!confirm(`Cancel order ${orderNumber}? This cannot be undone.`)) return;

    const result = cancelOrderForAdmin(orderNumber);

    if (!result.ok) showNotice(result.message);

    renderOrders();
}

function showOrderDetails(orderNumber) {
    const order = getOrders().find(item =>
        String(item.orderNumber) === String(orderNumber)
    );

    if (!order) {
        showNotice("Order not found.");
        return;
    }

    const pickup = getFulfillment(order) === "pickup";

    const items = Array.isArray(order.items) && order.items.length
        ? order.items.map(item => {
            const quantity = Number(item.quantity || 1);
            const extras = [item.size, item.sweetness && `${item.sweetness} sweet`]
                .filter(Boolean).map(escapeHTML).join(", ");

            return `<li>
                <span>${escapeHTML(item.name || item.title || "Unknown item")}
                    ${extras ? `(${extras})` : ""} × ${quantity}</span>
                <span>${formatPrice((Number(item.unitPrice) || 0) * quantity)}</span>
            </li>`;
        }).join("")
        : "<li>No item details available</li>";

    const history = Array.isArray(order.statusHistory) && order.statusHistory.length
        ? `<ul class="details-history">${order.statusHistory.map(entry =>
            `<li>${escapeHTML(getStatusLabel({ ...order, status: entry.status }))} · ${escapeHTML(formatDate(entry.at))}</li>`
        ).join("")}</ul>`
        : "";

    document.getElementById("detailsBody").innerHTML = `
        <dl class="details-grid">
            <dt>Order ID</dt><dd>${escapeHTML(order.orderNumber)}</dd>
            <dt>Placed</dt><dd>${escapeHTML(formatDate(order.date))}</dd>
            <dt>Status</dt><dd>${escapeHTML(getStatusLabel(order))}</dd>
            <dt>Customer</dt><dd>${escapeHTML(order.customerName || "Guest")}</dd>
            <dt>Email</dt><dd>${escapeHTML(order.email || "N/A")}</dd>
            <dt>Phone</dt><dd>${escapeHTML(order.phone || "N/A")}</dd>
            <dt>Method</dt><dd>${isWalkInOrder(order) ? "Walk-in Order" : pickup ? "Pickup" : "Delivery"}</dd>
            ${pickup ? "" : `<dt>Address</dt><dd>${escapeHTML(order.address || "N/A")}</dd>`}
            <dt>Payment</dt><dd>${escapeHTML(order.payment || "N/A")}</dd>
            ${order.deliveredAt ? `<dt>Delivered</dt><dd>${escapeHTML(formatDate(order.deliveredAt))}</dd>` : ""}
            ${order.pickedUpAt ? `<dt>Picked up</dt><dd>${escapeHTML(formatDate(order.pickedUpAt))}</dd>` : ""}
        </dl>
        <ul class="details-items">${items}</ul>
        <dl class="details-grid">
            <dt>Subtotal</dt><dd>${formatPrice(order.subtotal)}</dd>
            <dt>Discount</dt><dd>-${formatPrice(order.discount)}</dd>
            <dt>Service fee</dt><dd>${formatPrice(order.serviceFee)}</dd>
            <dt><strong>Total</strong></dt><dd><strong>${formatPrice(order.total)}</strong></dd>
            ${isWalkInOrder(order) ? `
            <dt>Cash received</dt><dd>${formatPrice(order.cashReceived)}</dd>
            <dt>Change</dt><dd>${formatPrice(order.change)}</dd>
            ${order.cashier ? `<dt>Cashier</dt><dd>${escapeHTML(order.cashier)}</dd>` : ""}` : ""}
        </dl>
        ${history ? `<h3>Status history</h3>${history}` : ""}`;

    document.getElementById("detailsOverlay").hidden = false;
}

function closeOrderDetails() {
    document.getElementById("detailsOverlay").hidden = true;
}

// Update when orders change in another browser tab (e.g. a new customer order
// or a customer cancelling).
window.addEventListener("storage", event => {
    if (event.key === ORDERS_KEY && getStaffSession()) {
        renderOrders();
    }
});

// Confirmation before ending the admin session.
// Reuses the .signout-* styles from style.css (same look as the customer modal).
function showAdminSignOutModal() {
    document.getElementById("adminSignOutOverlay")?.remove();

    const trigger = document.activeElement;
    const overlay = document.createElement("div");
    overlay.id = "adminSignOutOverlay";
    overlay.className = "signout-overlay";

    overlay.innerHTML = `
        <div class="signout-modal" role="alertdialog" aria-modal="true"
             aria-labelledby="adminSignOutTitle"
             aria-describedby="adminSignOutMessage">
            <div class="signout-icon">☕</div>
            <p class="signout-eyebrow">TASTYCUP ADMIN</p>
            <h2 id="adminSignOutTitle">Do you want to sign out?</h2>
            <p class="signout-description" id="adminSignOutMessage">
                Are you sure you want to sign out of your admin account?
            </p>
            <div class="signout-actions">
                <button type="button" class="signout-cancel" id="cancelAdminSignOut">Cancel</button>
                <button type="button" class="signout-confirm" id="confirmAdminSignOut">Sign Out</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    const cancelBtn = document.getElementById("cancelAdminSignOut");
    const confirmBtn = document.getElementById("confirmAdminSignOut");
    let isClosing = false;

    function closeModal() {
        if (isClosing) return;
        isClosing = true;

        document.removeEventListener("keydown", handleKeys);
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 200);
        if (trigger && trigger.focus) trigger.focus();
    }

    function handleKeys(event) {
        if (event.key === "Escape") {
            event.stopPropagation();
            closeModal();
            return;
        }

        // Keep keyboard focus inside the dialog.
        if (event.key === "Tab") {
            const first = cancelBtn;
            const last = confirmBtn;

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
    }

    cancelBtn.addEventListener("click", closeModal);

    confirmBtn.addEventListener("click", () => {
        isClosing = true;
        document.removeEventListener("keydown", handleKeys);
        endStaffSession();                       // existing session function
        window.location.replace("index.html");   // same redirect as before
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    document.addEventListener("keydown", handleKeys);
    cancelBtn.focus();
}

// Start dashboard (employees only)
document.addEventListener("DOMContentLoaded", () => {
    const staff = getStaffSession();

    if (!staff) return; // the "Access denied" panel stays visible

    document.getElementById("accessDenied").hidden = true;
    document.getElementById("adminApp").hidden = false;
    document.getElementById("adminUser").textContent =
        `${staff.name} (${staff.role})`;

    document.getElementById("adminSignOut").addEventListener("click", showAdminSignOutModal);

    document.getElementById("refreshOrders").addEventListener("click", renderOrders);

    document.querySelectorAll("[data-tab]").forEach(tab =>
        tab.addEventListener("click", () => showAdminTab(tab.dataset.tab))
    );

    // Filters and order buttons are drawn dynamically, so listen on the page.
    document.addEventListener("click", event => {
        if (!getStaffSession()) return;

        const chip = event.target.closest("[data-filter]");
        if (chip) {
            currentFilter = chip.dataset.filter;
            renderOrders();
            return;
        }

        const button = event.target.closest("[data-action][data-order]");
        if (!button) return;

        const orderNumber = button.dataset.order;

        if (button.dataset.action === "next") handleNext(orderNumber, button.dataset.from);
        if (button.dataset.action === "cancel") handleCancel(orderNumber);
        if (button.dataset.action === "view") showOrderDetails(orderNumber);
    });

    document.getElementById("detailsClose").addEventListener("click", closeOrderDetails);
    document.getElementById("detailsOverlay").addEventListener("click", event => {
        if (event.target.id === "detailsOverlay") closeOrderDetails();
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") closeOrderDetails();
    });

    renderOrders();

    // Open straight on the POS with admin.html#pos
    if (window.location.hash === "#pos") showAdminTab("pos");
});
