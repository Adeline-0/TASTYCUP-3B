/* ==========================================
   TASTYCUP - CHECKOUT PAGE
   Requires: core.js, auth.js
   Only signed-in users with items in their cart can place an order.
   ========================================== */

function renderCheckoutItems() {
    const checkoutItems = getElement("checkoutItems");
    if (!checkoutItems) return;

    const cart = getCart();

    if (cart.length === 0) {
        checkoutItems.innerHTML = `
            <p class="empty-checkout">Your cart is empty.</p>
            <a href="menu.html" class="primary-btn">Browse Menu</a>
        `;
        updateCheckoutSummary();
        return;
    }

    checkoutItems.innerHTML = cart.map(item => `
        <div class="checkout-item">
            <div class="checkout-item-image">${item.emoji || "☕"}</div>
            <div class="checkout-item-info">
                <strong>${escapeHTML(item.name)}</strong>
                ${item.size ? `<span>${escapeHTML(item.size)}, ${escapeHTML(item.sweetness || "50%")} sweetness</span>` : ""}
                <span>Qty: ${Number(item.quantity) || 0}</span>
            </div>
            <strong>${formatPrice((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0))}</strong>
        </div>
    `).join("");

    updateCheckoutSummary();
}

function updateCheckoutSummary() {
    const totals = calculateCart();

    const set = (id, text) => {
        const element = getElement(id);
        if (element) element.textContent = text;
    };

    set("checkoutSubtotal", formatPrice(totals.subtotal));
    set("checkoutDiscount", `-${formatPrice(totals.discount)}`);
    set("checkoutFee", formatPrice(totals.serviceFee));
    set("checkoutTotal", formatPrice(totals.total));
}

/* ---------- Delivery or pickup ---------- */

// Delivery needs an address. Pickup hides it. Delivery is the default, which
// is how checkout worked before pickup existed.
function initializeFulfillment() {
    const addressGroup = getElement("addressGroup");
    const addressInput = getElement("customerAddress");

    function toggleAddress() {
        const pickup = document.querySelector(
            'input[name="fulfillment"]:checked'
        )?.value === "pickup";

        if (addressGroup) addressGroup.hidden = pickup;
        if (addressInput) {
            addressInput.disabled = pickup;
            addressInput.required = !pickup;
        }
    }

    document.querySelectorAll('input[name="fulfillment"]').forEach(radio =>
        radio.addEventListener("change", toggleAddress)
    );

    toggleAddress();
}

/* ---------- Payment method fields ---------- */

function initializePaymentFields() {
    const cardFields = getElement("cardPaymentFields");
    const gcashFields = getElement("gcashPaymentFields");

    function setSection(section, enabled) {
        if (!section) return;

        section.hidden = !enabled;
        section.querySelectorAll("input").forEach(input => {
            input.disabled = !enabled;
            input.required = enabled;
        });
    }

    function toggleFields() {
        const payment = document.querySelector(
            'input[name="payment"]:checked'
        )?.value;

        setSection(cardFields, payment === "Card");
        setSection(gcashFields, payment === "GCash");
    }

    document.querySelectorAll('input[name="payment"]').forEach(radio =>
        radio.addEventListener("change", toggleFields)
    );

    toggleFields();
}

/* ---------- Place order ---------- */

// Returns an error message, or "" if the payment details look fine.
function validateDemoPayment(payment) {
    if (payment === "Card") {
        const cardName = getElement("demoCardName")?.value.trim() || "";
        const cardNumber = (getElement("demoCardNumber")?.value || "").replace(/\s/g, "");
        const expiry = getElement("demoCardExpiry")?.value.trim() || "";
        const cvv = getElement("demoCardCvv")?.value.trim() || "";

        if (!cardName) return "Please enter the name on the demo card.";
        if (!/^\d{16}$/.test(cardNumber)) return "Enter a 16-digit fictional card number for the demo.";
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) return "Enter the expiry date as MM/YY.";
        if (!/^\d{3,4}$/.test(cvv)) return "Enter a 3 or 4 digit fictional CVV.";
    }

    if (payment === "GCash") {
        const number = (getElement("demoGcashNumber")?.value || "").replace(/\D/g, "");
        const reference = getElement("demoGcashReference")?.value.trim() || "";

        if (!/^09\d{9}$/.test(number)) return "Enter an 11-digit demo GCash number starting with 09.";
        if (!/^[A-Za-z0-9-]{6,20}$/.test(reference)) return "Enter a fictional reference number between 6 and 20 characters.";
    }

    return "";
}

function handleCheckout(event) {
    event.preventDefault();

    // Always re-check at the moment of ordering, in case the user
    // signed out in another tab.
    const user = getCurrentUser();

    if (!user) {
        requireSignIn();
        return;
    }

    const cart = getCart();

    if (cart.length === 0) {
        showToast("Your cart is empty.");
        return;
    }

    const name = getElement("customerName")?.value.trim() || user.name || "";
    const phone = getElement("customerPhone")?.value.trim() || "";
    const fulfillment = document.querySelector(
        'input[name="fulfillment"]:checked'
    )?.value === "pickup" ? "pickup" : "delivery";
    const address = fulfillment === "delivery"
        ? (getElement("customerAddress")?.value.trim() || "")
        : "";
    const payment = document.querySelector('input[name="payment"]:checked')?.value;

    if (!name || !phone || !payment || (fulfillment === "delivery" && !address)) {
        showToast(
            fulfillment === "delivery"
                ? "Please complete your name, phone number, delivery address, and payment method."
                : "Please complete your name, phone number, and payment method."
        );
        return;
    }

    if (!/^09\d{9}$/.test(phone.replace(/\D/g, ""))) {
        showToast("Please enter a valid 11-digit phone number starting with 09.");
        getElement("customerPhone")?.focus();
        return;
    }

    const paymentError = validateDemoPayment(payment);

    if (paymentError) {
        const message = getElement("checkoutMessage");
        if (message) message.textContent = paymentError;
        showToast(paymentError);
        return;
    }

    const totals = calculateCart();

    const order = {
        orderNumber: "TC-" + Date.now().toString().slice(-8),
        customerName: name,
        email: user.email || "",
        phone,
        fulfillment,
        address,
        payment,
        items: cart,
        subtotal: totals.subtotal,
        discount: totals.discount,
        serviceFee: totals.serviceFee,
        total: totals.total,
        status: "Pending",
        date: new Date().toISOString()
    };

    try {
        const orders = getAllOrders();
        orders.push(order);
        saveAllOrders(orders);
        localStorage.setItem("tastyCupLastOrder", JSON.stringify(order));
        localStorage.removeItem("tastyCupCart");
        window.location.href = "confirmation.html";
    } catch (error) {
        console.error("Unable to save order:", error);
        showToast("Unable to save your order. Please try again.");
    }
}

function initializeCheckout() {
    const checkoutForm = getElement("checkoutForm");
    if (!checkoutForm) return;

    const user = getCurrentUser();

    // Not signed in: no checkout. Send them to sign in first.
    if (!user) {
        sessionStorage.setItem(RETURN_TO_CHECKOUT_KEY, "true");
        window.location.replace("menu.html?loginRequired=true");
        return;
    }

    const nameInput = getElement("customerName");
    if (nameInput) nameInput.value = user.name || "";

    renderCheckoutItems();
    initializeFulfillment();
    initializePaymentFields();

    if (getCart().length === 0) {
        const submitButton = checkoutForm.querySelector('button[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        return;
    }

    checkoutForm.addEventListener("submit", handleCheckout);
}

document.addEventListener("DOMContentLoaded", initializeCheckout);
