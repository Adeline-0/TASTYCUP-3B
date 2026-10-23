/* ==========================================
   TASTYCUP - POS / CASHIER (admin dashboard)
   Requires: core.js, products.js, orders.js
   Staff only. Saves walk-in orders into the same "tastyCupOrders" list the
   online checkout uses, so they show up in the admin orders table.
   ========================================== */

const POS_ORDER_TYPE = "walk-in";
const POS_ORDER_LABEL = "Walk-in Order";
const POS_LARGE_DRINK_EXTRA = 25; // same +₱25 for 22oz as menu.js

const posState = {
    items: [],              // { key, productId, name, emoji, category, size, unitPrice, quantity }
    category: "all",
    member: false,
    customerName: "",
    saleId: posNewSaleId(),  // one id per sale: the guard against duplicate orders
    saving: false,
    sizes: {}               // chosen size per drink on the product grid
};

function posNewSaleId() {
    return `sale-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ---------- Money ---------- */

// Compare and subtract in whole centavos so 113.4 vs 113.40 never misleads.
function posCents(amount) {
    return Math.round((Number(amount) || 0) * 100);
}

function posTotals() {
    return calculateOrderTotals(posState.items, posState.member);
}

/* ---------- Product grid ---------- */

function posUnitPrice(product, size) {
    return product.price +
        (product.category === "drinks" && size === "22oz" ? POS_LARGE_DRINK_EXTRA : 0);
}

function posRenderProducts() {
    const grid = getElement("posProducts");

    const list = posState.category === "all"
        ? products
        : products.filter(product => product.category === posState.category);

    grid.innerHTML = list.map(product => {
        const isDrink = product.category === "drinks";
        const size = posState.sizes[product.id] || "16oz";

        return `
            <div class="pos-product">
                <button type="button" class="pos-product-add"
                        data-pos-add="${escapeHTML(product.id)}"
                        aria-label="Add ${escapeHTML(product.name)} to order">
                    <span class="pos-product-photo">${product.emoji || "☕"}</span>
                    <strong>${escapeHTML(product.name)}</strong>
                    <span class="pos-product-price">${formatPrice(posUnitPrice(product, size))}</span>
                </button>
                ${isDrink ? `
                <div class="pos-size" role="group" aria-label="Size for ${escapeHTML(product.name)}">
                    ${["16oz", "22oz"].map(option => `
                        <button type="button"
                                class="${option === size ? "active" : ""}"
                                data-pos-size="${escapeHTML(product.id)}"
                                data-size="${option}">${option}</button>`).join("")}
                </div>` : ""}
            </div>`;
    }).join("");
}

function posRenderCategories() {
    const categories = ["all", ...new Set(products.map(product => product.category))];

    getElement("posCategories").innerHTML = categories.map(category => `
        <button type="button"
                class="filter-chip ${category === posState.category ? "active" : ""}"
                data-pos-category="${category}"
                aria-pressed="${category === posState.category}">
            ${category.charAt(0).toUpperCase() + category.slice(1)}
        </button>`).join("");
}

/* ---------- Order (cart) ---------- */

function posAddProduct(productId) {
    const product = products.find(item => item.id === productId);
    if (!product) return;

    const size = product.category === "drinks"
        ? (posState.sizes[product.id] || "16oz")
        : null;
    const key = `${product.id}|${size || ""}`;
    const existing = posState.items.find(item => item.key === key);

    if (existing) {
        existing.quantity += 1;
    } else {
        posState.items.push({
            key,
            productId: product.id,
            name: product.name,
            emoji: product.emoji,
            category: product.category,
            size,
            unitPrice: posUnitPrice(product, size),
            quantity: 1
        });
    }

    posRenderOrder();
}

function posChangeQuantity(key, amount) {
    const item = posState.items.find(entry => entry.key === key);
    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
        posState.items = posState.items.filter(entry => entry.key !== key);
    }

    posRenderOrder();
}

function posSetQuantity(key, value) {
    const item = posState.items.find(entry => entry.key === key);
    if (!item) return;

    const quantity = Math.floor(Number(value));

    if (!Number.isFinite(quantity) || quantity < 1) {
        posRenderOrder(); // put the old number back
        return;
    }

    item.quantity = Math.min(quantity, 99);
    posRenderOrder();
}

function posRemoveItem(key) {
    posState.items = posState.items.filter(entry => entry.key !== key);
    posRenderOrder();
}

function posClearOrder() {
    posState.items = [];
    posState.member = false;
    posState.customerName = "";
    posState.saleId = posNewSaleId();
    getElement("posMember").checked = false;
    getElement("posCustomer").value = "";
    getElement("posCash").value = "";
    posSetMessage("");
    posRenderOrder();
}

function posRenderOrder() {
    const list = getElement("posItems");
    const totals = posTotals();
    const count = posState.items.reduce((sum, item) => sum + item.quantity, 0);

    if (posState.items.length === 0) {
        list.innerHTML = `<p class="pos-empty">No items yet. Tap a product to add it.</p>`;
    } else {
        list.innerHTML = posState.items.map(item => `
            <div class="pos-line">
                <div class="pos-line-photo">${item.emoji || "☕"}</div>
                <div class="pos-line-info">
                    <strong>${escapeHTML(item.name)}</strong>
                    <small>${item.size ? escapeHTML(item.size) + " · " : ""}${formatPrice(item.unitPrice)} each</small>
                </div>
                <div class="pos-qty">
                    <button type="button" data-pos-minus="${escapeHTML(item.key)}" aria-label="Decrease quantity">−</button>
                    <input type="number" inputmode="numeric" min="1" max="99"
                           value="${item.quantity}"
                           data-pos-qty="${escapeHTML(item.key)}"
                           aria-label="Quantity for ${escapeHTML(item.name)}">
                    <button type="button" data-pos-plus="${escapeHTML(item.key)}" aria-label="Increase quantity">+</button>
                </div>
                <strong class="pos-line-total">${formatPrice(item.unitPrice * item.quantity)}</strong>
                <button type="button" class="pos-remove" data-pos-remove="${escapeHTML(item.key)}"
                        aria-label="Remove ${escapeHTML(item.name)}">✕</button>
            </div>`).join("");
    }

    getElement("posSubtotal").textContent = formatPrice(totals.subtotal);
    getElement("posDiscount").textContent = `-${formatPrice(totals.discount)}`;
    getElement("posFee").textContent = formatPrice(totals.serviceFee);
    getElement("posTotal").textContent = formatPrice(totals.total);
    getElement("posDiscountRow").hidden = !posState.member;

    getElement("posBarCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
    getElement("posBarTotal").textContent = formatPrice(totals.total);

    posUpdateChange();
}

/* ---------- Payment ---------- */

function posSetMessage(text) {
    const message = getElement("posMessage");
    message.textContent = text;
    message.hidden = !text;
}

function posUpdateChange() {
    const cashInput = getElement("posCash");
    const out = getElement("posChange");
    const payButton = getElement("posPay");
    const totalCents = posCents(posTotals().total);
    const hasItems = posState.items.length > 0;
    const raw = cashInput.value.trim();

    payButton.disabled = !hasItems || posState.saving;

    if (!raw) {
        out.textContent = formatPrice(0);
        out.className = "";
        return;
    }

    const diff = posCents(raw) - totalCents;

    if (hasItems && diff < 0) {
        out.textContent = `Short by ${formatPrice(-diff / 100)}`;
        out.className = "pos-short";
    } else {
        out.textContent = formatPrice(hasItems ? diff / 100 : 0);
        out.className = "";
    }
}

function posPay() {
    // Double-click / double-tap guard: ignore while a payment is being saved.
    if (posState.saving) return;

    // Re-check the staff session at the moment of payment.
    const staff = getStaffSession();
    if (!staff) {
        posSetMessage("Your staff session has ended. Please sign in again.");
        return;
    }

    if (posState.items.length === 0) {
        posSetMessage("Add at least one item to the order.");
        return;
    }

    const rawCash = getElement("posCash").value.trim();
    const cashCents = posCents(rawCash);

    if (!rawCash || !Number.isFinite(Number(rawCash)) || cashCents <= 0) {
        posSetMessage("Enter the cash amount received.");
        getElement("posCash").focus();
        return;
    }

    const totals = posTotals();
    const totalCents = posCents(totals.total);

    if (cashCents < totalCents) {
        posSetMessage(
            `Cash received is less than the total. ${formatPrice((totalCents - cashCents) / 100)} more is needed.`
        );
        getElement("posCash").focus();
        return;
    }

    posState.saving = true;
    getElement("posPay").disabled = true;

    try {
        // Read orders fresh so a second tab or earlier tap can't slip through.
        const orders = getAllOrders();

        if (orders.some(order => order.saleId === posState.saleId)) {
            posSetMessage("This sale was already saved. Check the orders list, then start a new order.");
            return;
        }

        let orderNumber;
        do {
            orderNumber = "TC-" + (Date.now() + Math.floor(Math.random() * 1000))
                .toString().slice(-8);
        } while (orders.some(order => String(order.orderNumber) === orderNumber));

        const customerName = getElement("posCustomer").value.trim() || "Walk-in Customer";

        const order = {
            orderNumber,
            customerName,
            email: "",
            phone: "",
            fulfillment: "pickup",
            address: "",
            payment: "Cash",
            items: posState.items.map(item => ({
                id: item.key,
                productId: item.productId,
                name: item.name,
                emoji: item.emoji,
                category: item.category,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                size: item.size,
                sweetness: null
            })),
            subtotal: totals.subtotal,
            discount: totals.discount,
            serviceFee: totals.serviceFee,
            total: totals.total,
            status: "Pending",
            date: new Date().toISOString(),

            // POS extras
            orderType: POS_ORDER_TYPE,
            member: posState.member,
            cashReceived: cashCents / 100,
            change: (cashCents - totalCents) / 100,
            cashier: staff.name,
            saleId: posState.saleId
        };

        orders.push(order);
        saveAllOrders(orders);

        posShowReceipt(order);
        posClearOrder();
        renderOrders(); // refresh the admin orders list/counters (admin.js)
    } catch (error) {
        console.error("Unable to save walk-in order:", error);
        posSetMessage("Unable to save the order. Please try again.");
    } finally {
        posState.saving = false;
        posUpdateChange();
    }
}

/* ---------- Receipt ---------- */

function posShowReceipt(order) {
    const rows = order.items.map(item => `
        <tr>
            <td>${escapeHTML(item.name)}${item.size ? ` (${escapeHTML(item.size)})` : ""}</td>
            <td class="num">${Number(item.quantity)}</td>
            <td class="num">${formatPrice(item.unitPrice * item.quantity)}</td>
        </tr>`).join("");

    getElement("posReceipt").innerHTML = `
        <div class="receipt-head">
            <h2>☕ TastyCup</h2>
            <p>${POS_ORDER_LABEL}</p>
            <p>${escapeHTML(order.orderNumber)}</p>
            <p>${escapeHTML(formatDate(order.date))}</p>
            <p>Customer: ${escapeHTML(order.customerName)}</p>
            <p>Cashier: ${escapeHTML(order.cashier)}</p>
        </div>
        <table class="receipt-table">
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
        <dl class="receipt-totals">
            <dt>Subtotal</dt><dd>${formatPrice(order.subtotal)}</dd>
            ${order.discount > 0 ? `<dt>Member discount (10%)</dt><dd>-${formatPrice(order.discount)}</dd>` : ""}
            <dt>Service fee (5%)</dt><dd>${formatPrice(order.serviceFee)}</dd>
            <dt class="grand">Total</dt><dd class="grand">${formatPrice(order.total)}</dd>
            <dt>Cash received</dt><dd>${formatPrice(order.cashReceived)}</dd>
            <dt>Change</dt><dd>${formatPrice(order.change)}</dd>
        </dl>
        <p class="receipt-thanks">Thank you for visiting TastyCup!</p>`;

    getElement("posReceiptOverlay").hidden = false;
    getElement("posReceiptClose").focus();
}

function posCloseReceipt() {
    getElement("posReceiptOverlay").hidden = true;
}

/* ---------- Setup ---------- */

function initializePOS() {
    if (!getStaffSession()) return; // staff only

    const root = getElement("posView");
    if (!root) return;

    posRenderCategories();
    posRenderProducts();
    posRenderOrder();

    root.addEventListener("click", event => {
        if (!getStaffSession()) return;

        const target = event.target.closest(
            "[data-pos-add],[data-pos-size],[data-pos-category],[data-pos-plus],[data-pos-minus],[data-pos-remove]"
        );
        if (!target) return;

        if (target.dataset.posAdd) posAddProduct(target.dataset.posAdd);

        if (target.dataset.posSize) {
            posState.sizes[target.dataset.posSize] = target.dataset.size;
            posRenderProducts();
        }

        if (target.dataset.posCategory) {
            posState.category = target.dataset.posCategory;
            posRenderCategories();
            posRenderProducts();
        }

        if (target.dataset.posPlus) posChangeQuantity(target.dataset.posPlus, 1);
        if (target.dataset.posMinus) posChangeQuantity(target.dataset.posMinus, -1);
        if (target.dataset.posRemove) posRemoveItem(target.dataset.posRemove);
    });

    root.addEventListener("change", event => {
        if (event.target.dataset.posQty) {
            posSetQuantity(event.target.dataset.posQty, event.target.value);
        }
    });

    getElement("posMember").addEventListener("change", event => {
        posState.member = event.target.checked;
        posRenderOrder();
    });

    getElement("posCash").addEventListener("input", () => {
        posSetMessage("");
        posUpdateChange();
    });

    getElement("posPay").addEventListener("click", posPay);

    getElement("posClear").addEventListener("click", () => {
        if (posState.items.length === 0 || confirm("Clear this order?")) posClearOrder();
    });

    getElement("posBar").addEventListener("click", () => {
        getElement("posOrderPanel").scrollIntoView({ behavior: "smooth" });
    });

    getElement("posReceiptClose").addEventListener("click", posCloseReceipt);
    getElement("posReceiptDone").addEventListener("click", posCloseReceipt);
    getElement("posPrint").addEventListener("click", () => window.print());
    // The receipt is NOT closed by clicking the backdrop: a fast double-tap on
    // "Confirm Payment" would otherwise dismiss it right after it opens.
    document.addEventListener("keydown", event => {
        if (event.key === "Escape") posCloseReceipt();
    });
}

document.addEventListener("DOMContentLoaded", initializePOS);
