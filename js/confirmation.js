/* ==========================================
   TASTYCUP - ORDER CONFIRMATION + CANCELLATION
   Requires: core.js, orders.js, auth.js
   The Cancel Order button lives in confirmation.html.
   This is the only file that handles cancellation.
   ========================================== */

// The admin dashboard updates tastyCupOrders, so prefer that copy.
function getCurrentOrder() {
    const lastOrder = getLastOrder();
    if (!lastOrder) return null;

    const saved = getAllOrders().find(order =>
        String(order.orderNumber) === String(lastOrder.orderNumber)
    );

    return saved || lastOrder;
}

function displayOrder() {
    const orderNumberElement = getElement("orderNumber");
    const cancelButton = getElement("cancelOrderBtn");

    const order = getCurrentOrder();

    if (!order) {
        orderNumberElement.textContent = "No order found";
        if (cancelButton) cancelButton.hidden = true;
        return;
    }

    const status = getOrderStatus(order);
    const pickup = getFulfillment(order) === "pickup";

    orderNumberElement.textContent = order.orderNumber || "N/A";

    const set = (id, text) => {
        const element = getElement(id);
        if (element) element.textContent = text;
    };

    set("confirmationName", order.customerName || "Customer");
    set("confirmationMethod", pickup ? "Pickup" : "Delivery");
    set("confirmationAddress", order.address || "N/A");
    set("confirmationPayment", order.payment || "N/A");
    set("confirmationTotal", formatPrice(order.total));
    set("confirmationStatus", getStatusLabel(order));
    set("confirmationUpdated", getLastUpdateText(order) || "N/A");
    set("confirmationMessage", getStatusMessage(order));

    // Pickup orders have no delivery address.
    const addressRow = getElement("confirmationAddressRow");
    if (addressRow) addressRow.hidden = pickup;

    const progress = getElement("confirmationProgress");
    if (progress) progress.innerHTML = renderProgressHTML(order);

    const heading = getElement("confirmationHeading");
    if (heading) {
        heading.textContent =
            status === "Cancelled" ? "Order Cancelled" :
            status === "Rejected" ? "Order Rejected" :
            status === "Delivered" ? "Order Delivered!" :
            status === "Picked Up" ? "Order Picked Up!" :
            "Order Confirmed!";
    }

    // Only new (pending) orders can be cancelled.
    if (cancelButton) cancelButton.hidden = status !== "Pending";
}

function cancelCurrentOrder() {
    const lastOrder = getLastOrder();

    if (!lastOrder?.orderNumber) {
        showToast("Unable to find your order.");
        return;
    }

    // Re-check the saved status before asking, then again when cancelling.
    const saved = getCurrentOrder();
    if (getOrderStatus(saved) !== "Pending") {
        showToast("Only new orders can be cancelled.");
        displayOrder();
        return;
    }

    if (!confirm("Are you sure you want to cancel this order?")) return;

    const result = cancelOrderForCustomer(lastOrder.orderNumber);

    displayOrder();
    showToast(result.ok ? "Your order has been cancelled." : result.message);
}

function initializeConfirmation() {
    if (!getElement("orderNumber")) return;

    getElement("cancelOrderBtn")?.addEventListener("click", cancelCurrentOrder);

    displayOrder();

    // Pick up changes (e.g. the admin accepting the order) from other tabs.
    window.addEventListener("storage", event => {
        if (event.key === "tastyCupOrders" || event.key === "tastyCupLastOrder") {
            displayOrder();
        }
    });
}

document.addEventListener("DOMContentLoaded", initializeConfirmation);
