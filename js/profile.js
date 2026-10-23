/* ==========================================
   TASTYCUP - PROFILE (the signed-in customer's orders)
   Requires: core.js, orders.js, auth.js
   ========================================== */

// An order belongs to the customer whose email it was placed with.
function getMyOrders(user) {
    const email = String(user?.email || "").toLowerCase();
    if (!email) return [];

    return getAllOrders()
        .filter(order => String(order.email || "").toLowerCase() === email)
        .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
}

function renderProfileOrder(order) {
    const status = getOrderStatus(order);
    const pickup = getFulfillment(order) === "pickup";

    const items = Array.isArray(order.items) && order.items.length
        ? order.items.map(item => {
            const name = escapeHTML(item.name || item.title || "Unknown item");
            const size = item.size ? ` (${escapeHTML(item.size)})` : "";
            const quantity = Number(item.quantity || 1);
            const price = Number(item.unitPrice) || 0;

            return `
                <li>
                    <span>${name}${size} × ${quantity}</span>
                    <span>${formatPrice(price * quantity)}</span>
                </li>`;
        }).join("")
        : "<li><span>No item details available</span></li>";

    const cancelButton = status === "Pending"
        ? `<button type="button" class="cancel-order-btn"
                   data-cancel="${escapeHTML(order.orderNumber)}">
               Cancel Order
           </button>`
        : "";

    return `
        <article class="profile-order">
            <header class="profile-order-head">
                <div>
                    <strong>${escapeHTML(order.orderNumber || "N/A")}</strong>
                    <small>${escapeHTML(formatDate(order.date))}</small>
                </div>
                <span class="order-status ${getStatusClass(order)}">${escapeHTML(getStatusLabel(order))}</span>
            </header>

            ${renderProgressHTML(order)}

            <p class="order-message">${escapeHTML(getStatusMessage(order))}</p>

            <ul class="profile-order-items">${items}</ul>

            <dl class="profile-order-meta">
                <dt>Method</dt>
                <dd>${pickup ? "Pickup at the cafe" : "Delivery"}</dd>
                ${pickup ? "" : `<dt>Address</dt><dd>${escapeHTML(order.address || "N/A")}</dd>`}
                <dt>Payment</dt>
                <dd>${escapeHTML(order.payment || "N/A")}</dd>
                <dt>Last update</dt>
                <dd>${escapeHTML(getLastUpdateText(order) || "N/A")}</dd>
                ${order.deliveredAt ? `<dt>Delivered</dt><dd>${escapeHTML(formatDate(order.deliveredAt))}</dd>` : ""}
                ${order.pickedUpAt ? `<dt>Picked up</dt><dd>${escapeHTML(formatDate(order.pickedUpAt))}</dd>` : ""}
            </dl>

            <footer class="profile-order-foot">
                <strong>Total ${formatPrice(order.total)}</strong>
            </footer>

            ${cancelButton}
        </article>`;
}

function renderProfile() {
    const user = getCurrentUser();
    if (!user) return;

    const set = (id, text) => {
        const element = getElement(id);
        if (element) element.textContent = text;
    };

    const orders = getMyOrders(user);
    const spent = orders
        .filter(order => !["Cancelled", "Rejected"].includes(getOrderStatus(order)))
        .reduce((sum, order) => sum + (Number(order.total) || 0), 0);

    set("profileName", user.name || "TastyCup Member");
    set("profileEmail", user.email || "");
    set("profileOrderCount", orders.length);
    set("profileTotalSpent", formatPrice(spent));

    getElement("profileOrders").innerHTML = orders.length
        ? orders.map(renderProfileOrder).join("")
        : `<div class="profile-empty">
               <p>You haven't ordered anything yet.</p>
               <a href="menu.html" class="primary-btn">Browse the Menu</a>
           </div>`;
}

function initializeProfile() {
    if (!getElement("profileOrders")) return;

    renderProfile();

    getElement("profileOrders").addEventListener("click", event => {
        const button = event.target.closest("[data-cancel]");
        if (!button) return;

        if (!confirm("Are you sure you want to cancel this order?")) return;

        // The status is re-checked against saved data, so an order the cafe
        // just started preparing can no longer be cancelled.
        const result = cancelOrderForCustomer(button.dataset.cancel);
        showToast(result.ok ? "Your order has been cancelled." : result.message);
        renderProfile();
    });

    // Pick up changes (e.g. the admin accepting an order) from other tabs.
    window.addEventListener("storage", event => {
        if (event.key === "tastyCupOrders" || event.key === "tastyCupUser") {
            if (!getCurrentUser()) {
                window.location.replace("menu.html?loginRequired=true");
                return;
            }
            renderProfile();
        }
    });
}

document.addEventListener("DOMContentLoaded", initializeProfile);
