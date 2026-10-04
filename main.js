const API = "https://api.everrest.educata.dev";
const byId = (id) => document.getElementById(id);
const productsContainer = byId("products");
const searchInput = byId("searchInput");
const categoryFilter = byId("categoryFilter");
const brandFilter = byId("brandFilter");
const minPrice = byId("minPrice");
const maxPrice = byId("maxPrice");
const ratingFilter = byId("ratingFilter");
const cartCount = byId("cartCount");
const token = localStorage.getItem("access_token");

function priceOf(product) {
    const price = product?.price;
    if (typeof price === "number") return { amount: price, currency: "GEL" };
    return { amount: Number(price?.current ?? price?.amount ?? 0), currency: price?.currency || "GEL" };
}

function stars(value) {
    const rating = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return `<span class="stars" aria-label="${rating} out of 5">${String.fromCharCode(9733).repeat(rating)}${String.fromCharCode(9734).repeat(5 - rating)}</span>`;
}

function attachImageFallback(img, sources) {
    // Avoid Imgur rejecting local development referrer headers.
    img.referrerPolicy = "no-referrer";
    const candidates = sources.filter((source) => typeof source === "string" && source.trim()).flatMap((source) => {
        try {
            const parsed = new URL(source);
            const proxyUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
            const imgurImage = /^(www\.)?imgur\.com$/i.test(parsed.hostname) && /^\/[^/]+$/.test(parsed.pathname) && !/\.(jpe?g|png|gif|webp)$/i.test(parsed.pathname)
                ? `https://i.imgur.com${parsed.pathname}.jpg` : source;
            return [`https://images.weserv.nl/?url=${encodeURIComponent(proxyUrl)}`, imgurImage, source];
        } catch (_) { return [source]; }
    });
    const fallback = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450" viewBox="0 0 600 450"><rect width="600" height="450" fill="#f1f0eb"/><path d="M250 175h100v85H250zM235 275h130" fill="none" stroke="#a9aaa2" stroke-width="5"/><text x="300" y="330" text-anchor="middle" font-family="Arial" font-size="18" fill="#777">Image unavailable</text></svg>')}`;
    let index = 0;
    const label = img.alt || "untitled product";
    img.onload = () => console.info(`[image] Loaded: ${label}`, { url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
        console.warn(`[image] Failed: ${label}`, { url: img.currentSrc || img.src, candidatesTried: index, nextCandidate: candidates[index] || "inline fallback" });
        if (index < candidates.length) img.src = candidates[index++];
        else { img.onerror = null; img.onload = () => console.info(`[image] Inline fallback loaded: ${label}`); img.src = fallback; }
    };
    console.info(`[image] Starting: ${label}`, { candidates });
    img.src = candidates[index++] || fallback;
}

async function getProducts() {
    productsContainer.innerHTML = '<p class="state-message">Loading products...</p>';
    const params = new URLSearchParams({ page_index: "1", page_size: "50" });
    const values = {
        keywords: searchInput.value.trim(), category_id: categoryFilter.value,
        brand: brandFilter.value, price_min: minPrice.value,
        price_max: maxPrice.value, rating: ratingFilter.value
    };
    Object.entries(values).forEach(([key, value]) => { if (value !== "") params.set(key, value); });

    try {
        const response = await fetch(`${API}/shop/products/search?${params}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load products.");
        const products = Array.isArray(data) ? data : (data.products || data.items || []);
        if (!products.length) {
            productsContainer.innerHTML = '<p class="state-message">No products match these filters.</p>';
            return;
        }
        productsContainer.replaceChildren();
        products.forEach((product) => {
            const { amount, currency } = priceOf(product);
            const images = [product.thumbnail, ...(product.images || [])];
            const card = document.createElement("article");
            card.className = "product-card";
            card.innerHTML = `<a class="product-image-container" href="product.html?id=${encodeURIComponent(product._id || product.id)}"><img class="product-image" alt="${product.title || "Product"}" loading="lazy"></a>
                <div class="product-card-content"><p class="product-brand">${product.brand || "EVERREST STORE"}</p>
                <a class="product-title" href="product.html?id=${encodeURIComponent(product._id || product.id)}">${product.title || "Untitled product"}</a>
                <p class="rating">${stars(product.rating)} <span>${Number(product.rating || 0).toFixed(1)}</span></p>
                <div class="card-bottom"><strong class="price">${amount.toFixed(2)} <small>${currency}</small></strong>
                <button class="add-to-cart" data-id="${product._id || product.id}" data-stock="${product.stock}" ${Number(product.stock) < 1 ? "disabled" : ""}>${Number(product.stock) < 1 ? "Sold out" : "Add to cart"}</button></div></div>`;
            const imageEl = card.querySelector("img");
            attachImageFallback(imageEl, images);
            card.querySelector(".add-to-cart").addEventListener("click", () => addToCart(product._id || product.id, product.stock));
            productsContainer.appendChild(card);
        });
    } catch (error) {
        productsContainer.innerHTML = `<p class="state-message error-message">${error.message || "Connection problem. Please try again."}</p>`;
    }
}

async function populateSelect(url, select, allLabel, labelFor) {
    try {
        const response = await fetch(`${API}${url}`);
        if (!response.ok) return;
        const entries = await response.json();
        entries.forEach((entry) => {
            const label = labelFor(entry);
            const value = typeof entry === "string" ? entry : (entry.id || entry._id || entry.categoryId || label);
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
    } catch (_) { /* Filters remain usable if a list endpoint is unavailable. */ }
}

async function addToCart(id, stock) {
    if (!token) { window.location.href = "login.html"; return; }
    try {
        await EverrestCart.addProduct({ id, token, stock });
        await updateCartCount();
        const button = document.querySelector(`.add-to-cart[data-id="${CSS.escape(id)}"]`);
        if (button) { const original = button.textContent; button.textContent = "Added ✓"; setTimeout(() => button.textContent = original, 1200); }
    } catch (error) { alert(error.message || "Something went wrong."); }
}

async function updateCartCount() {
    if (!token) { cartCount.textContent = "0"; return; }
    try {
        const response = await fetch(`${API}/shop/cart`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json();
        cartCount.textContent = data.total?.quantity ?? data.products?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) ?? 0;
    } catch (_) { /* Keep the current count if offline. */ }
}

byId("searchButton").addEventListener("click", getProducts);
searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") getProducts(); });
byId("filterButton").addEventListener("click", getProducts);
byId("clearButton").addEventListener("click", () => {
    searchInput.value = ""; categoryFilter.value = ""; brandFilter.value = "";
    minPrice.value = ""; maxPrice.value = ""; ratingFilter.value = ""; getProducts();
});
populateSelect("/shop/products/categories", categoryFilter, "All categories", (item) => item.name || item.title || "Category");
populateSelect("/shop/products/brands", brandFilter, "All brands", (item) => typeof item === "string" ? item : item.name || item.brand || "Brand");
getProducts();
updateCartCount();
