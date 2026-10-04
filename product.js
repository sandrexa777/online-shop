const API = "https://api.everrest.educata.dev";
const token = localStorage.getItem("access_token");
const productId = new URLSearchParams(location.search).get("id");
const el = (id) => document.getElementById(id);
const productDetails = el("productDetails");
const detailsContent = el("detailsContent");
const reviewsList = el("reviewsList");
let product = null;
let selectedRating = 0;
const priceOf = (price) => typeof price === "number" ? { amount: price, currency: "GEL" } : { amount: Number(price?.current ?? price?.amount ?? 0), currency: price?.currency || "GEL" };
const stars = (rating) => { const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0))); return String.fromCharCode(9733).repeat(n) + String.fromCharCode(9734).repeat(5 - n); };
function attachImageFallback(img, sources) {
    img.referrerPolicy = "no-referrer";
    const candidates = sources.filter((source) => typeof source === "string" && source.trim()).flatMap((source) => {
        try {
            const parsed = new URL(source);
            const proxyUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
            const imgurImage = /^(www\.)?imgur\.com$/i.test(parsed.hostname) && /^\/[^/]+$/.test(parsed.pathname) && !/\.(jpe?g|png|gif|webp)$/i.test(parsed.pathname) ? `https://i.imgur.com${parsed.pathname}.jpg` : source;
            return [`https://images.weserv.nl/?url=${encodeURIComponent(proxyUrl)}`, imgurImage, source];
        }
        catch (_) { return [source]; }
    });
    const fallback = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="650" viewBox="0 0 800 650"><rect width="800" height="650" fill="#f1f0eb"/><path d="M350 255h100v85H350zM335 355h130" fill="none" stroke="#a9aaa2" stroke-width="5"/><text x="400" y="415" text-anchor="middle" font-family="Arial" font-size="20" fill="#777">Image unavailable</text></svg>')}`;
    let index = 0;
    const label = img.alt || "product detail";
    img.onload = () => console.info(`[image] Loaded: ${label}`, { url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
        console.warn(`[image] Failed: ${label}`, { url: img.currentSrc || img.src, candidatesTried: index, nextCandidate: candidates[index] || "inline fallback" });
        if (index < candidates.length) img.src = candidates[index++];
        else { img.onerror = null; img.onload = () => console.info(`[image] Inline fallback loaded: ${label}`); img.src = fallback; }
    };
    console.info(`[image] Starting: ${label}`, { candidates });
    img.src = candidates[index++] || fallback;
}

async function loadProduct() {
    if (!productId) { productDetails.textContent = "Product not found."; return; }
    try {
        const response = await fetch(`${API}/shop/products/id/${encodeURIComponent(productId)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Product not found.");
        product = data; renderProduct(); renderDetails(); renderReviews();
    } catch (error) { productDetails.textContent = error.message || "Could not load product."; }
}
function renderProduct() {
    const { amount, currency } = priceOf(product.price);
    const images = [product.thumbnail, ...(product.images || [])];
    productDetails.innerHTML = `<div class="product-detail-card"><div class="product-detail-image"><img alt="${product.title || "Product"}"></div>
        <div class="product-detail-info"><p class="product-brand">${product.brand || "EVERREST STORE"}</p><h1>${product.title || "Product"}</h1>
        <p class="rating">${stars(product.rating)} <span>${Number(product.rating || 0).toFixed(1)} (${product.reviews?.length || product.reviewCount || 0} reviews)</span></p>
        <p class="detail-price">${amount.toFixed(2)} <small>${currency}</small></p><p><strong>Availability:</strong> ${Number(product.stock) > 0 ? `${product.stock} in stock` : "Out of stock"}</p>
        <p><strong>Brand:</strong> ${product.brand || "N/A"}</p><p><strong>Release date:</strong> ${product.issueDate ? new Date(product.issueDate).toLocaleDateString() : "N/A"}</p>
        <button id="addProductButton" class="primary-button" ${Number(product.stock) < 1 ? "disabled" : ""}>Add to cart</button></div></div>`;
    attachImageFallback(productDetails.querySelector("img"), images);
    el("addProductButton").addEventListener("click", addProductToCart);
}
function renderDetails() {
    const { amount, currency } = priceOf(product.price);
    detailsContent.innerHTML = `<p>${product.description || "No description available."}</p><p><strong>Category:</strong> ${product.category?.name || product.category?.title || product.category || "N/A"}</p><p><strong>Warranty:</strong> ${product.warranty ?? "N/A"}</p><p><strong>Price:</strong> ${amount.toFixed(2)} ${currency}</p>`;
}
function renderReviews() {
    const reviews = JSON.parse(localStorage.getItem(`reviews_${productId}`) || "[]");
    if (!reviews.length) { reviewsList.innerHTML = '<p class="state-message">No written reviews yet. Be the first to share your thoughts.</p>'; return; }
    reviewsList.replaceChildren();
    reviews.forEach((review) => {
        const card = document.createElement("article"); card.className = "review-card";
        const name = document.createElement("h3"); name.textContent = `${review.firstName} ${review.lastName}`;
        const score = document.createElement("p"); score.className = "review-stars"; score.textContent = stars(review.rating);
        const text = document.createElement("p"); text.textContent = review.text;
        card.append(name, score, text); reviewsList.appendChild(card);
    });
}
async function addProductToCart() {
    if (!token) { location.href = "login.html"; return; }
    try {
        await EverrestCart.addProduct({ id: productId, token, stock: product.stock });
        const button = el("addProductButton"); button.textContent = "Added to cart"; setTimeout(() => button.textContent = "Add to cart", 1300); updateCartCount();
    } catch (error) { alert(error.message); }
}
el("detailsTab").addEventListener("click", () => switchTab("details"));
el("reviewTab").addEventListener("click", () => switchTab("review"));
function switchTab(tab) {
    const details = tab === "details";
    el("detailsTab").classList.toggle("active", details); el("reviewTab").classList.toggle("active", !details);
    el("detailsSection").classList.toggle("hidden", !details); el("reviewSection").classList.toggle("hidden", details);
}
el("openReviewButton").addEventListener("click", () => { if (!token) { location.href = "login.html"; return; } el("reviewMessage").textContent = ""; el("reviewModal").classList.remove("hidden"); });
el("closeModal").addEventListener("click", () => el("reviewModal").classList.add("hidden"));
el("reviewModal").addEventListener("click", (event) => { if (event.target === el("reviewModal")) el("reviewModal").classList.add("hidden"); });
document.querySelectorAll("#ratingStars button").forEach((button) => button.addEventListener("click", () => {
    selectedRating = Number(button.dataset.rating);
    document.querySelectorAll("#ratingStars button").forEach((item) => item.classList.toggle("selected", Number(item.dataset.rating) <= selectedRating));
}));
el("saveReview").addEventListener("click", async () => {
    const firstName = el("reviewFirstName").value.trim(); const lastName = el("reviewLastName").value.trim(); const text = el("reviewText").value.trim();
    if (!selectedRating || !firstName || !lastName || !text) { el("reviewMessage").textContent = "Choose a rating and fill in your name and review."; return; }
    el("reviewMessage").textContent = "Saving...";
    try {
        const response = await fetch(`${API}/shop/products/rate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ productId, rate: selectedRating }) });
        const data = response.ok ? {} : await response.json();
        if (!response.ok) throw new Error(data.error || data.message || "Could not save your rating.");
        const reviews = JSON.parse(localStorage.getItem(`reviews_${productId}`) || "[]"); reviews.unshift({ firstName, lastName, text, rating: selectedRating });
        localStorage.setItem(`reviews_${productId}`, JSON.stringify(reviews)); renderReviews(); el("reviewMessage").textContent = "Your review has been saved.";
        setTimeout(() => el("reviewModal").classList.add("hidden"), 700);
    } catch (error) { el("reviewMessage").textContent = error.message; }
});
async function updateCartCount() {
    if (!token) return;
    try { const response = await fetch(`${API}/shop/cart`, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) return; const data = await response.json(); el("cartCount").textContent = data.total?.quantity ?? 0; }
    catch (_) { /* Count can update on the next page load. */ }
}
loadProduct(); updateCartCount();
