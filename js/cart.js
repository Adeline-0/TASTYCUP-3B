/* ==========================================
   TASTYCUP - CART PAGE
   Requires: core.js, auth.js
   ========================================== */

function renderCart() {
    const cartItems = getElement("cartItems");
    if (!cartItems) return;

    const cart = getCart();

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="empty-cart">
                <div class="empty-cart-icon">🛒</div>
                <h2>Your cart is empty</h2>
                <p>Looks like you haven't added anything yet.</p>
                <a href="menu.html" class="primary-btn">Browse Menu</a>
            </div>
        `;

        updateCartSummary();
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-image">${item.emoji || "☕"}</div>
            <div class="cart-item-info">
                <h3>${escapeHTML(item.name)}</h3>
                ${item.size ? `<p>${escapeHTML(item.size)} • ${escapeHTML(item.sweetness || "50%")} sweetness</p>` : ""}
                <strong>${formatPrice(item.unitPrice)}</strong>
            </div>
            <div class="cart-item-actions">
                <div class="quantity-controls">
                    <button type="button" class="cart-minus"
                        data-cart-id="${escapeHTML(item.id)}">−</button>
                    <span>${Number(item.quantity) || 0}</span>
                    <button type="button" class="cart-plus"
                        data-cart-id="${escapeHTML(item.id)}">+</button>
                </div>
                <button type="button" class="remove-cart-item"
                    data-cart-id="${escapeHTML(item.id)}">Remove</button>
            </div>
        </div>
    `).join("");

    cartItems.querySelectorAll(".cart-plus").forEach(button => {
        button.addEventListener("click", () =>
            updateCartQuantity(button.dataset.cartId, 1)
        );
    });

    cartItems.querySelectorAll(".cart-minus").forEach(button => {
        button.addEventListener("click", () =>
            updateCartQuantity(button.dataset.cartId, -1)
        );
    });

    cartItems.querySelectorAll(".remove-cart-item").forEach(button => {
        button.addEventListener("click", () =>
            removeCartItem(button.dataset.cartId)
        );
    });

    updateCartSummary();
}

function updateCartQuantity(cartId, amount) {
    const cart = getCart();
    const item = cart.find(entry => entry.id === cartId);

    if (!item) return;

    item.quantity = (Number(item.quantity) || 0) + amount;

    saveCart(item.quantity <= 0
        ? cart.filter(entry => entry.id !== cartId)
        : cart
    );

    renderCart();
}

function removeCartItem(cartId) {
    saveCart(getCart().filter(item => item.id !== cartId));
    renderCart();
    showToast("Item removed from cart.");
}

function updateCartSummary() {
    const totals = calculateCart();

    const set = (id, text) => {
        const element = getElement(id);
        if (element) element.textContent = text;
    };

    set("cartSubtotal", formatPrice(totals.subtotal));
    set("cartDiscount", `-${formatPrice(totals.discount)}`);
    set("cartFee", formatPrice(totals.serviceFee));
    set("cartTotal", formatPrice(totals.total));
}

// Checkout needs a non-empty cart AND a signed-in user.
function initializeCheckoutLink() {
    const checkoutBtn = getElement("checkoutBtn");
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener("click", event => {
        if (getCart().length === 0) {
            event.preventDefault();
            showToast("Your cart is empty.");
            return;
        }

        if (!requireSignIn()) {
            event.preventDefault();
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    if (!getElement("cartItems")) return;

    renderCart();
    initializeCheckoutLink();
});
