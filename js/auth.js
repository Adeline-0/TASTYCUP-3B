/* ==========================================
   TASTYCUP - ACCOUNT / SIGN-IN / SIGN-OUT
   Loaded on every page that has the header.
   ========================================== */

const RETURN_TO_CHECKOUT_KEY = "tastyCupReturnToCheckout";

// Set by initializeAccount(). Opens the sign-in modal if it exists.
let openSignInModal = null;

// Call this to make sure someone is signed in before checkout.
// Returns true if the user is signed in. Otherwise opens the
// sign-in modal (or sends them to the menu page) and returns false.
function requireSignIn() {
    if (getCurrentUser()) return true;

    try {
        sessionStorage.setItem(RETURN_TO_CHECKOUT_KEY, "true");
    } catch {
        // sessionStorage unavailable; the user just won't be auto-redirected.
    }

    if (openSignInModal) {
        openSignInModal();
        showToast("Please sign in or create an account to check out.");
    } else {
        window.location.href = "menu.html?loginRequired=true";
    }

    return false;
}

function updateAccountButton() {
    const accountBtn = getElement("accountBtn");
    if (!accountBtn) return;

    const user = getCurrentUser();
    accountBtn.textContent = user ? (user.name || "Account") : "Sign In";
}

function initializeAccount() {
    updateAccountButton();

    const accountBtn = getElement("accountBtn");
    const overlay = getElement("accountOverlay");
    const signInForm = getElement("signInForm");

    if (!accountBtn || !overlay || !signInForm) return;

    const modal = overlay.querySelector(".account-modal");
    const accountTitle = getElement("accountTitle") ||
        modal?.querySelector("h2");
    const accountDescription = getElement("accountDescription") ||
        modal?.querySelector(":scope > p");
    const accountNameField = getElement("accountNameField");
    const accountName = getElement("accountName");
    const accountSubmit = getElement("accountSubmit") ||
        signInForm.querySelector('button[type="submit"]');
    const accountSwitch = getElement("accountSwitch");

    // Staff (employee) sign-in lives in the same modal. The toggle is added
    // here so every page's modal gets it without editing five HTML files.
    const staffSwitch = document.createElement("button");
    staffSwitch.type = "button";
    staffSwitch.id = "staffSwitch";
    staffSwitch.className = "account-switch staff-switch";
    signInForm.appendChild(staffSwitch);

    const emailInput = () =>
        signInForm.querySelector(
            '#accountEmail, #signInEmail, input[type="email"], input[name="email"]'
        );

    const passwordInput = () =>
        signInForm.querySelector(
            '#accountPassword, #signInPassword, input[type="password"], input[name="password"]'
        );

    let isCreatingAccount = false;
    let isStaffLogin = false;

    function openAccountModal(staffMode = false) {
        isCreatingAccount = false;
        isStaffLogin = staffMode === true;
        signInForm.reset();
        updateAccountMode();
        overlay.classList.add("show");
        overlay.setAttribute("aria-hidden", "false");
        emailInput()?.focus();
    }

    // Closing without signing in cancels the "go to checkout" intent.
    function closeAccountModal() {
        overlay.classList.remove("show");
        overlay.setAttribute("aria-hidden", "true");
    }

    function dismissAccountModal() {
        sessionStorage.removeItem(RETURN_TO_CHECKOUT_KEY);
        closeAccountModal();
    }

    openSignInModal = () => openAccountModal();

    function updateAccountMode() {
        modal?.classList.toggle("staff-mode", isStaffLogin);
        staffSwitch.textContent = isStaffLogin
            ? "← Back to customer sign in"
            : "Admin / Staff sign in";

        if (isStaffLogin) {
            if (accountTitle) accountTitle.textContent = "Staff Sign In";
            if (accountDescription) {
                accountDescription.textContent =
                    "Employees only. Use the credentials assigned to you.";
            }
            if (accountNameField) accountNameField.style.display = "none";
            if (accountName) accountName.required = false;
            if (accountSubmit) accountSubmit.textContent = "Sign In as Staff";
            if (passwordInput()) passwordInput().autocomplete = "current-password";
            return;
        }

        if (isCreatingAccount) {
            if (accountTitle) accountTitle.textContent = "Create Account";
            if (accountDescription) {
                accountDescription.textContent =
                    "Create your TastyCup account and enjoy 10% off your order.";
            }
            if (accountNameField) accountNameField.style.display = "block";
            if (accountName) accountName.required = true;
            if (accountSubmit) accountSubmit.textContent = "Create Account";
            if (accountSwitch) {
                accountSwitch.textContent = "Already have an account? Sign in";
            }
            if (passwordInput()) passwordInput().autocomplete = "new-password";
        } else {
            if (accountTitle) accountTitle.textContent = "Welcome to TastyCup";
            if (accountDescription) {
                accountDescription.textContent = "Sign in to your account.";
            }
            if (accountNameField) accountNameField.style.display = "none";
            if (accountName) accountName.required = false;
            if (accountSubmit) accountSubmit.textContent = "Sign In";
            if (accountSwitch) {
                accountSwitch.textContent = "Don't have an account? Create Account";
            }
            if (passwordInput()) passwordInput().autocomplete = "current-password";
        }
    }

    function finishLogin(user, message) {
        try {
            localStorage.setItem("tastyCupUser", JSON.stringify({
                name: user.name || "",
                email: user.email
            }));
        } catch (error) {
            console.error("Unable to save current user:", error);
            showToast("Unable to save your sign-in. Check your browser storage.");
            return;
        }

        // Read the checkout intent BEFORE closing the modal.
        const returnToCheckout =
            sessionStorage.getItem(RETURN_TO_CHECKOUT_KEY) === "true";

        updateAccountButton();
        closeAccountModal();
        signInForm.reset();

        if (returnToCheckout) {
            sessionStorage.removeItem(RETURN_TO_CHECKOUT_KEY);
            window.location.href = "checkout.html";
            return;
        }

        showToast(message);
    }

    staffSwitch.addEventListener("click", () => {
        isStaffLogin = !isStaffLogin;
        isCreatingAccount = false;
        signInForm.reset();
        updateAccountMode();
        emailInput()?.focus();
    });

    accountBtn.addEventListener("click", () => {
        const user = getCurrentUser();

        if (user) {
            showSignOutModal(user);
            return;
        }

        openAccountModal();
    });

    getElement("closeAccount")?.addEventListener("click", dismissAccountModal);

    overlay.addEventListener("click", event => {
        if (event.target === overlay) dismissAccountModal();
    });

    accountSwitch?.addEventListener("click", event => {
        event.preventDefault();
        isCreatingAccount = !isCreatingAccount;
        signInForm.reset();
        updateAccountMode();
        emailInput()?.focus();
    });

    signInForm.addEventListener("submit", event => {
        event.preventDefault();

        const emailField = emailInput();
        const passwordField = passwordInput();

        if (!emailField || !passwordField) {
            showToast("Unable to find the email or password field.");
            return;
        }

        const email = emailField.value.trim().toLowerCase();
        const password = passwordField.value;
        const name = (accountName?.value || "").trim();

        if (!email || !password.trim()) {
            showToast("Please enter your email and password.");
            (!email ? emailField : passwordField).focus();
            return;
        }

        if (!emailField.checkValidity()) {
            emailField.reportValidity();
            return;
        }

        if (isStaffLogin) {
            const staff = findAuthorizedStaff(email, password);

            if (!staff) {
                // Say why, without revealing which part was wrong.
                showToast(
                    "Access denied. These credentials are not authorized for staff access."
                );
                return;
            }

            try {
                startStaffSession(staff);
            } catch (error) {
                console.error("Unable to save staff session:", error);
                showToast("Unable to save your sign-in. Check your browser storage.");
                return;
            }

            sessionStorage.removeItem(RETURN_TO_CHECKOUT_KEY);
            window.location.href = "admin.html";
            return;
        }

        if (password.length < 6) {
            showToast("Your password must contain at least 6 characters.");
            passwordField.focus();
            return;
        }

        const users = getRegisteredUsers();

        if (isCreatingAccount) {
            if (!name) {
                showToast("Please enter your name.");
                accountName?.focus();
                return;
            }

            if (isEmailAuthorizedStaff(email)) {
                showToast("This email is reserved for staff. Please use another email.");
                return;
            }

            const exists = users.some(user =>
                user &&
                typeof user.email === "string" &&
                user.email.toLowerCase() === email
            );

            if (exists) {
                showToast("This email already has an account. Please sign in.");
                return;
            }

            const newUser = { name, email, password };
            users.push(newUser);

            try {
                localStorage.setItem("tastyCupUsers", JSON.stringify(users));
            } catch (error) {
                console.error("Unable to create account:", error);
                showToast("Unable to create your account. Please try again.");
                return;
            }

            finishLogin(newUser, "Account created successfully! You now get 10% off ☕");
            return;
        }

        const registeredUser = users.find(user =>
            user &&
            typeof user.email === "string" &&
            user.email.toLowerCase() === email &&
            user.password === password
        );

        if (!registeredUser) {
            showToast("Incorrect email or password. Create an account if you're new.");
            return;
        }

        finishLogin(registeredUser, "Signed in successfully! ☕");
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && overlay.classList.contains("show")) {
            dismissAccountModal();
        }
    });

    // Sent here by the checkout page when nobody is signed in.
    const params = new URLSearchParams(window.location.search);

    if (params.get("staffLogin") === "true") {
        if (getStaffSession()) {
            window.location.replace("admin.html");
            return;
        }
        openAccountModal(true);
    } else if (params.get("loginRequired") === "true" && !getCurrentUser()) {
        openAccountModal();
        showToast("Please sign in or create an account before checking out.");
    } else {
        updateAccountMode();
    }
}

/* ---------- Sign-out modal ---------- */

function showSignOutModal(user) {
    getElement("signOutOverlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "signOutOverlay";
    overlay.className = "signout-overlay";

    overlay.innerHTML = `
        <div class="signout-modal" role="dialog" aria-modal="true"
             aria-labelledby="signOutTitle">
            <div class="signout-icon">☕</div>
            <p class="signout-eyebrow">TASTYCUP MEMBER</p>
            <h2 id="signOutTitle">Leaving so soon?</h2>
            <p class="signout-description">
                Are you sure you want to sign out?
                We hope to see you again soon!
            </p>
            <div class="signout-user">
                <span class="signout-avatar">👤</span>
                <div>
                    <strong>${escapeHTML(user.name || "TastyCup Member")}</strong>
                    <span>${escapeHTML(user.email || "")}</span>
                </div>
            </div>
            <a class="signout-profile-link" href="profile.html">View my profile &amp; orders</a>
            <div class="signout-actions">
                <button type="button" class="signout-cancel" id="cancelSignOut">
                    Stay Signed In
                </button>
                <button type="button" class="signout-confirm" id="confirmSignOut">
                    Sign Out
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    let isClosing = false;

    function closeModal() {
        if (isClosing) return;
        isClosing = true;

        document.removeEventListener("keydown", handleEscape);
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 200);
    }

    function handleEscape(event) {
        if (event.key === "Escape") closeModal();
    }

    getElement("cancelSignOut").addEventListener("click", closeModal);

    getElement("confirmSignOut").addEventListener("click", () => {
        localStorage.removeItem("tastyCupUser");
        updateAccountButton();
        closeModal();

        // Signed-in-only pages send you away when you sign out.
        if (document.body.dataset.requiresAuth === "true") {
            window.location.replace("menu.html?loginRequired=true");
            return;
        }

        // Cart totals depend on the member discount.
        if (typeof renderCart === "function") renderCart();

        showToast("You've been signed out. See you again! ☕");
    });

    overlay.addEventListener("click", event => {
        if (event.target === overlay) closeModal();
    });

    document.addEventListener("keydown", handleEscape);
    getElement("cancelSignOut").focus();
}

document.addEventListener("DOMContentLoaded", initializeAccount);
