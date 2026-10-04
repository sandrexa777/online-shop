const EverrestCart = (function () {
    const API = "https://api.everrest.educata.dev";

    async function readResponse(response) {
        const text = await response.text();
        if (!text) return {};
        try { return JSON.parse(text); } catch (_) { return {}; }
    }

    async function request(method, body, token) {
        const response = await fetch(`${API}/shop/cart/product`, {
            method,
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(body)
        });
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || data.message || "Could not update the cart.");
        return data;
    }

    async function addProduct({ id, token, stock }) {
        const cartResponse = await fetch(`${API}/shop/cart`, { headers: { Authorization: `Bearer ${token}` } });
        const cartData = await readResponse(cartResponse);

        const cartErrors = cartData.errorKeys || [];
        const cartMissing = cartErrors.includes("errors.user_cart_not_exists") ||
            cartErrors.includes("errors.user_has_no_cart");
        if ((cartResponse.status === 404 || cartResponse.status === 409) && cartMissing) {
            return request("POST", { id, quantity: 1 }, token);
        }
        if (!cartResponse.ok) throw new Error(cartData.error || cartData.message || "Could not read the cart.");

        const currentItem = (cartData.products || []).find((item) => {
            const productId = item.productId || item.id || item._id;
            const value = typeof productId === "object" ? (productId._id || productId.id) : productId;
            return String(value) === String(id);
        });
        const currentQuantity = Number(currentItem?.quantity || 0);
        const availableStock = Number(stock);
        if (Number.isFinite(availableStock) && availableStock >= 0 && currentQuantity >= availableStock) {
            throw new Error(`Only ${availableStock} item(s) are available in stock.`);
        }
        return request("PATCH", { id, quantity: currentQuantity + 1 }, token);
    }

    return { addProduct };
})();
