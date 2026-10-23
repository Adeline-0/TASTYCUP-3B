/* ==========================================
   TASTYCUP - CORE (loaded on every page)
   Shared constants, storage helpers, toast, totals
   ========================================== */

const SERVICE_FEE_RATE = 0.05;
const MEMBER_DISCOUNT_RATE = 0.10;

function getElement(id) {
    return document.getElementById(id);
}

function formatPrice(amount) {
    return `₱${Number(amount || 0).toFixed(2)}`;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

/* ---------- Storage helpers ---------- */

function readJSON(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function getCart() {
    const cart = readJSON("tastyCupCart", []);
    return Array.isArray(cart) ? cart : [];
}

function saveCart(cart) {
    try {
        localStorage.setItem("tastyCupCart", JSON.stringify(cart));
    } catch {
        showToast("Unable to save your cart. Please try again.");
    }
}

function getCurrentUser() {
    return readJSON("tastyCupUser", null);
}

function getRegisteredUsers() {
    const users = readJSON("tastyCupUsers", []);
    return Array.isArray(users) ? users : [];
}

function getAllOrders() {
    const orders = readJSON("tastyCupOrders", []);
    return Array.isArray(orders) ? orders : [];
}

function saveAllOrders(orders) {
    localStorage.setItem("tastyCupOrders", JSON.stringify(orders));
}

function getLastOrder() {
    return readJSON("tastyCupLastOrder", null);
}

/* ---------- Toast ---------- */

function showToast(message) {
    const toast = getElement("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timeout);

    showToast.timeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

/* ---------- Cart totals ---------- */

// The one place the pricing rules live: member discount first, then the
// service fee on the discounted amount. Used by the online cart and the POS.
function calculateOrderTotals(items, isMember) {
    const subtotal = (Array.isArray(items) ? items : []).reduce((sum, item) => {
        return sum +
            (Number(item.unitPrice) || 0) *
            Math.max(0, Number(item.quantity) || 0);
    }, 0);

    const discount = isMember ? subtotal * MEMBER_DISCOUNT_RATE : 0;
    const discountedSubtotal = subtotal - discount;
    const serviceFee = discountedSubtotal * SERVICE_FEE_RATE;
    const total = discountedSubtotal + serviceFee;

    return { subtotal, discount, serviceFee, total };
}

function calculateCart() {
    return calculateOrderTotals(getCart(), Boolean(getCurrentUser()));
}

/* ---------- Staff (employee) accounts ----------
   DEMO ONLY: this list and the session below live in the browser, so anyone
   who opens dev tools can read or edit them. Real protection needs a server.
   Customers sign up normally; only emails listed here count as employees. */

const STAFF_SESSION_KEY = "tastyCupStaff";

const AUTHORIZED_STAFF = [
    { name: "Cafe Admin", email: "admin@gmail.com", password: "123456789", role: "admin" }
];

function findAuthorizedStaff(email, password) {
    const wanted = String(email || "").trim().toLowerCase();

    return AUTHORIZED_STAFF.find(staff =>
        staff.email.toLowerCase() === wanted && staff.password === password
    ) || null;
}

function isEmailAuthorizedStaff(email) {
    const wanted = String(email || "").trim().toLowerCase();
    return AUTHORIZED_STAFF.some(staff => staff.email.toLowerCase() === wanted);
}

// The staff session only counts if that email is still on the authorized list.
function getStaffSession() {
    const session = readJSON(STAFF_SESSION_KEY, null);

    if (!session || !isEmailAuthorizedStaff(session.email)) return null;

    return session;
}

function startStaffSession(staff) {
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify({
        name: staff.name,
        email: staff.email,
        role: staff.role
    }));
}

function endStaffSession() {
    localStorage.removeItem(STAFF_SESSION_KEY);
}
