/* ==========================================
   TASTYCUP - HOME PAGE
   ========================================== */

function initializeHome() {
    const featuredGrid = getElement("featuredGrid");
    if (!featuredGrid) return;

    // A balanced mix: two drinks, one food, one dessert.
    const featuredIds = ["d5", "d6", "f7", "s2"];
    const featured = featuredIds
        .map(id => products.find(product => product.id === id))
        .filter(Boolean);

    featuredGrid.innerHTML = (featured.length ? featured : products.slice(0, 4)).map(product => `
        <article class="menu-card home-product-card">
            <div class="menu-card-image">${product.emoji}</div>
            <div class="menu-card-content">
                <p class="product-category">${product.category}</p>
                <h3>${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="menu-card-bottom">
                    <strong>${formatPrice(product.price)}</strong>
                    <a href="menu.html" class="add-product-btn">View Menu</a>
                </div>
            </div>
        </article>
    `).join("");
}

document.addEventListener("DOMContentLoaded", initializeHome);
