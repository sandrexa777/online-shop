const API = "https://api.everrest.educata.dev";
const token = localStorage.getItem("access_token");
const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const totalQuantity = document.getElementById("totalQuantity");
const cartMessage = document.getElementById("cartMessage");
const cartCount = document.getElementById("cartCount");
const priceOf = (price) => typeof price === "number" ? { amount: price, currency: "GEL" } : { amount: Number(price?.current ?? price?.amount ?? 0), currency: price?.currency || "GEL" };
const stars = (rating) => { const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0))); return String.fromCharCode(9733).repeat(n) + String.fromCharCode(9734).repeat(5 - n); };
async function readResponse(response) { const text = await response.text(); if (!text) return {}; try { return JSON.parse(text); } catch (_) { return {}; } }
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
    const fallback = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><rect width="240" height="240" fill="#f1f0eb"/><path d="M90 75h60v55H90zM80 145h80" fill="none" stroke="#a9aaa2" stroke-width="4"/><text x="120" y="180" text-anchor="middle" font-family="Arial" font-size="12" fill="#777">Image unavailable</text></svg>')}`;
    let index = 0;
    const label = img.alt || "cart product";
    img.onload = () => console.info(`[image] Loaded: ${label}`, { url: img.currentSrc, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => {
        console.warn(`[image] Failed: ${label}`, { url: img.currentSrc || img.src, candidatesTried: index, nextCandidate: candidates[index] || "inline fallback" });
        if (index < candidates.length) img.src = candidates[index++];
        else { img.onerror = null; img.onload = () => console.info(`[image] Inline fallback loaded: ${label}`); img.src = fallback; }
    };
    console.info(`[image] Starting: ${label}`, { candidates });
    img.src = candidates[index++] || fallback;
}

async function loadCart() {
    if (!token) {
        cartMessage.textContent = "Please sign in to view your cart.";
        cartItems.innerHTML = '<a class="primary-button" href="login.html">Sign in</a>';
        document.querySelector(".cart-summary").classList.add("hidden");
        return;
    }
    cartMessage.textContent = "";
    try {
        const response = await fetch(`${API}/shop/cart`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (!response.ok && (data.errorKeys || []).includes("errors.user_email_not_verified")) {
            cartMessage.textContent = "Verify your email to use the cart.";
            cartItems.innerHTML = '<a class="primary-button" href="login.html">Open sign in to resend the verification email</a>';
            document.querySelector(".cart-summary").classList.add("hidden");
            return;
        }
        if (!response.ok) throw new Error(data.error || "Could not load your cart.");
        const entries = data.products || data.items || [];
        cartItems.replaceChildren();
        if (!entries.length) {
            cartItems.innerHTML = '<div class="empty-cart"><h2>Your cart is empty</h2><p>Find something you love and it will show up here.</p><a href="index.html" class="primary-button">Explore products</a></div>';
            cartTotal.textContent = "0.00"; totalQuantity.textContent = "0"; cartCount.textContent = "0"; return;
        }
        let total = 0; let quantityTotal = 0;
        const resolved = await Promise.all(entries.map(async (item) => {
            const embedded = item.product || (item.productId && typeof item.productId === "object" ? item.productId : null);
            const id = item.productId && typeof item.productId === "object" ? (item.productId._id || item.productId.id || embedded?._id || embedded?.id) : (item.productId || item.id || item._id || embedded?._id || embedded?.id);
            if (embedded) return { ...embedded, quantity: item.quantity || 1, _cartId: id };
            if (item.title && item.price !== undefined) return { ...item, _cartId: id };
            const response = await fetch(`${API}/shop/products/id/${encodeURIComponent(id)}`);
            if (!response.ok) return null;
            return { ...(await response.json()), quantity: item.quantity || 1, _cartId: id };
        }));
        resolved.filter(Boolean).forEach((product) => {
            const quantity = Number(product.quantity || 1); const { amount, currency } = priceOf(product.price);
            total += amount * quantity; quantityTotal += quantity;
            const row = document.createElement("article"); row.className = "cart-item";
            const images = [product.thumbnail, ...(product.images || [])];
            row.innerHTML = `<a href="product.html?id=${encodeURIComponent(product._id || product._cartId)}" class="cart-item-image"><img alt="${product.title || "Product"}"></a>
                <div class="cart-item-info"><p class="product-brand">${product.brand || "EVERREST STORE"}</p><h2>${product.title || "Product"}</h2>
                <p>Stock: ${product.stock ?? "-"} | ${stars(product.rating)} | ${product.reviews?.length || product.reviewCount || 0} reviews</p>
                <strong>${amount.toFixed(2)} ${currency}</strong></div>
                <div class="quantity-controls"><button aria-label="Decrease quantity" data-action="minus">-</button><span>${quantity}</span><button aria-label="Increase quantity" data-action="plus" ${quantity >= Number(product.stock ?? 999999) ? "disabled" : ""}>+</button></div>
                <div class="cart-item-total"><strong>${(amount * quantity).toFixed(2)} ${currency}</strong><button class="delete-button">Remove</button></div>`;
            attachImageFallback(row.querySelector("img"), images);
            row.querySelector('[data-action="minus"]').addEventListener("click", () => changeQuantity(product._cartId, quantity - 1));
            row.querySelector('[data-action="plus"]').addEventListener("click", () => changeQuantity(product._cartId, quantity + 1));
            row.querySelector(".delete-button").addEventListener("click", () => deleteProduct(product._cartId));
            cartItems.appendChild(row);
        });
        cartTotal.textContent = total.toFixed(2); totalQuantity.textContent = quantityTotal; cartCount.textContent = quantityTotal;
    } catch (error) { cartMessage.textContent = error.message || "Could not load cart."; }
}

async function changeQuantity(id, quantity) {
    if (quantity < 1) return deleteProduct(id);
    await mutateCart("PATCH", { id, quantity });
}
async function deleteProduct(id) { await mutateCart("DELETE", { id }); }
async function mutateCart(method, body) {
    try {
        const response = await fetch(`${API}/shop/cart/product`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || data.message || "Cart could not be updated.");
        await loadCart();
    } catch (error) { cartMessage.textContent = error.message; }
}

document.getElementById("clearCartButton").addEventListener("click", async () => {
    if (!token) return;
    try { const response = await fetch(`${API}/shop/cart`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error("Could not clear cart."); await loadCart(); }
    catch (error) { cartMessage.textContent = error.message; }
});
document.getElementById("checkoutButton").addEventListener("click", async () => {
    if (!token) { window.location.href = "login.html"; return; }
    try { const response = await fetch(`${API}/shop/cart/checkout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); const data = await readResponse(response); if (!response.ok) throw new Error(data.error || data.message || "Checkout failed."); await loadCart(); cartMessage.textContent = "Order placed successfully. Thank you!"; }
    catch (error) { cartMessage.textContent = error.message; }
});
loadCart();
