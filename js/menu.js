/* ==========================================
   TASTYCUP - MENU PAGE + PRODUCT MODAL
   ========================================== */

let selectedProduct = null;
let selectedSize = "16oz";
let selectedSweetness = "50%";
let selectedQuantity = 1;

/* ---------- Menu grid ---------- */

function initializeMenu() {
    const menuGrid = getElement("menuGrid");
    if (!menuGrid) return;

    let activeCategory = "all";

    function renderMenu() {
        const filteredProducts = activeCategory === "all"
            ? products
            : products.filter(product => product.category === activeCategory);

        menuGrid.innerHTML = filteredProducts.map(product => `
            <article class="menu-card">
                <div class="menu-card-image">${product.emoji}</div>
                <div class="menu-card-content">
                    <p class="product-category">${product.category}</p>
                    <h3>${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="menu-card-bottom">
                        <strong>${formatPrice(product.price)}</strong>
                        <button type="button" class="add-product-btn"
                            data-product-id="${product.id}">Add</button>
                    </div>
                </div>
            </article>
        `).join("");

        menuGrid.querySelectorAll(".add-product-btn").forEach(button => {
            button.addEventListener("click", () => {
                openProductModal(button.dataset.productId);
            });
        });
    }

    document.querySelectorAll(".category-tab").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".category-tab").forEach(tab =>
                tab.classList.remove("active")
            );

            button.classList.add("active");
            activeCategory = button.dataset.category || "all";
            renderMenu();
        });
    });

    renderMenu();
}

/* ---------- Product modal ---------- */

function getSelectedUnitPrice() {
    let price = selectedProduct.price;

    if (selectedProduct.category === "drinks" && selectedSize === "22oz") {
        price += 25;
    }

    return price;
}

function openProductModal(productId) {
    const product = products.find(item => item.id === productId);
    const overlay = getElement("productOverlay");

    if (!product || !overlay) return;

    selectedProduct = product;
    selectedSize = "16oz";
    selectedSweetness = "50%";
    selectedQuantity = 1;

    getElement("productModalImage").textContent = product.emoji;
    getElement("productModalCategory").textContent =
        product.category.charAt(0).toUpperCase() + product.category.slice(1);
    getElement("productModalName").textContent = product.name;
    getElement("productModalDescription").textContent = product.description;
    getElement("qtyValue").textContent = selectedQuantity;

    const drinkOptions = getElement("drinkOptions");

    if (drinkOptions) {
        drinkOptions.style.display =
            product.category === "drinks" ? "block" : "none";
    }

    updateProductOptions();
    overlay.classList.add("show");
}

function closeProductModal() {
    getElement("productOverlay")?.classList.remove("show");
}

function updateProductOptions() {
    document.querySelectorAll("[data-size]").forEach(button => {
        button.classList.toggle("active", button.dataset.size === selectedSize);
    });

    document.querySelectorAll("[data-sweetness]").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.sweetness === selectedSweetness
        );
    });

    if (!selectedProduct || !getElement("productModalPrice")) return;

    getElement("productModalPrice").textContent =
        formatPrice(getSelectedUnitPrice());
}

function addSelectedProductToCart() {
    if (!selectedProduct) return;

    const unitPrice = getSelectedUnitPrice();
    const isDrink = selectedProduct.category === "drinks";
    const size = isDrink ? selectedSize : null;
    const sweetness = isDrink ? selectedSweetness : null;
    const cart = getCart();

    const existingItem = cart.find(item =>
        item.productId === selectedProduct.id &&
        (item.size || null) === size &&
        (item.sweetness || null) === sweetness
    );

    if (existingItem) {
        existingItem.quantity =
            (Number(existingItem.quantity) || 0) + selectedQuantity;
    } else {
        cart.push({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            productId: selectedProduct.id,
            name: selectedProduct.name,
            emoji: selectedProduct.emoji,
            category: selectedProduct.category,
            unitPrice,
            quantity: selectedQuantity,
            size,
            sweetness
        });
    }

    saveCart(cart);
    closeProductModal();
    showToast("Added to cart! 🛒");
}

function initializeProductModal() {
    if (!getElement("productOverlay")) return;

    getElement("closeProduct")?.addEventListener("click", closeProductModal);

    getElement("productOverlay").addEventListener("click", event => {
        if (event.target === getElement("productOverlay")) {
            closeProductModal();
        }
    });

    getElement("qtyMinus")?.addEventListener("click", () => {
        selectedQuantity = Math.max(1, selectedQuantity - 1);
        getElement("qtyValue").textContent = selectedQuantity;
    });

    getElement("qtyPlus")?.addEventListener("click", () => {
        selectedQuantity = Math.min(99, selectedQuantity + 1);
        getElement("qtyValue").textContent = selectedQuantity;
    });

    document.querySelectorAll("[data-size]").forEach(button => {
        button.addEventListener("click", () => {
            selectedSize = button.dataset.size;
            updateProductOptions();
        });
    });

    document.querySelectorAll("[data-sweetness]").forEach(button => {
        button.addEventListener("click", () => {
            selectedSweetness = button.dataset.sweetness;
            updateProductOptions();
        });
    });

    getElement("addToCartBtn")?.addEventListener("click", addSelectedProductToCart);
}

document.addEventListener("DOMContentLoaded", () => {
    initializeMenu();
    initializeProductModal();
});
