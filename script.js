const productGrid = document.querySelector("#product-grid");
const searchInput = document.querySelector("#search-input");
const searchForm = document.querySelector("#search-form");
const sortSelect = document.querySelector("#sort-select");
const emptyState = document.querySelector("#empty-state");
const resultsCount = document.querySelector("#results-count");
const cartDrawer = document.querySelector("#cart-drawer");
const drawerBackdrop = document.querySelector("#drawer-backdrop");
const cartItemsElement = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const toast = document.querySelector("#toast");

let activeCategory = "all";
let showFavoritesOnly = false;
let toastTimer;
let cart = loadCart();
const favorites = new Set();

function loadCart() {
	try {
		const storedCart = JSON.parse(localStorage.getItem("goodfind-cart") || "{}");
		return storedCart && typeof storedCart === "object" && !Array.isArray(storedCart) ? storedCart : {};
	} catch {
		return {};
	}
}

function formatPrice(price) {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0
	}).format(price);
}

function getVisibleProducts() {
	const query = searchInput.value.trim().toLowerCase();
	let visible = products.filter((product) => {
		const matchesCategory = activeCategory === "all" || product.category === activeCategory;
		const matchesQuery = `${product.name} ${product.subtitle} ${product.category}`.toLowerCase().includes(query);
		return matchesCategory && matchesQuery && (!showFavoritesOnly || favorites.has(product.id));
	});

	if (sortSelect.value === "price-low") visible.sort((a, b) => a.price - b.price);
	if (sortSelect.value === "price-high") visible.sort((a, b) => b.price - a.price);
	if (sortSelect.value === "rating") visible.sort((a, b) => b.rating - a.rating);
	return visible;
}

function renderProducts() {
	const visible = getVisibleProducts();
	productGrid.innerHTML = visible.map((product, index) => `
		<article class="product-card" style="animation-delay:${Math.min(index * 45, 240)}ms">
			<div class="product-image-wrap">
				<a class="product-image-link" href="product.html?id=${product.id}" aria-label="View details for ${product.name}"><img src="https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=650&q=80" alt="${product.alt}" loading="lazy"></a>
				<span class="product-tag${product.tag === "JUST IN" ? " tag-coral" : ""}">${product.tag}</span>
				<button class="favorite-button${favorites.has(product.id) ? " is-favorite" : ""}" type="button" data-favorite="${product.id}" aria-label="${favorites.has(product.id) ? "Remove" : "Add"} ${product.name} ${favorites.has(product.id) ? "from" : "to"} saved favorites" aria-pressed="${favorites.has(product.id)}" title="${favorites.has(product.id) ? "Remove from saved" : "Save for later"}">${favorites.has(product.id) ? "♥" : "♡"}</button>
			</div>
			<div class="product-meta"><span class="product-category">${product.category}</span><span class="product-rating"><span aria-hidden="true">★</span> ${product.rating} (${product.reviews})</span></div>
			<h3 class="product-name" title="${product.name}"><a class="product-name-link" href="product.html?id=${product.id}">${product.name}</a></h3>
			<p class="product-subtitle">${product.subtitle}</p>
			<div class="product-buy-row"><span class="product-price">${formatPrice(product.price)}${product.oldPrice ? ` <del>${formatPrice(product.oldPrice)}</del>` : ""}</span><button class="add-button" type="button" data-add="${product.id}">Add to cart <span aria-hidden="true">+</span></button></div>
		</article>`).join("");

	productGrid.hidden = visible.length === 0;
	emptyState.hidden = visible.length !== 0;
	resultsCount.textContent = showFavoritesOnly ? `${visible.length} saved` : `${visible.length} finds`;
}

function setCategory(category) {
	activeCategory = category;
	showFavoritesOnly = false;
	document.querySelectorAll("[data-category]").forEach((button) => {
		button.classList.toggle("is-active", button.dataset.category === category);
	});
	document.querySelector("#saved-button").classList.remove("is-selected");
	renderProducts();
}

function persistCart() {
	localStorage.setItem("goodfind-cart", JSON.stringify(cart));
	renderCart();
}

function addToCart(productId) {
	cart[productId] = (cart[productId] || 0) + 1;
	persistCart();
	const product = products.find((item) => item.id === productId);
	showToast(`${product.name} added to your cart.`);
}

function getCartProducts() {
	return Object.entries(cart)
		.map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
		.filter((item) => item.product && Number.isFinite(item.quantity) && item.quantity > 0);
}

function renderCart() {
	const items = getCartProducts();
	const itemCount = items.reduce((total, item) => total + item.quantity, 0);
	const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
	cartCount.textContent = itemCount;
	document.querySelector("#drawer-item-count").textContent = `(${itemCount})`;
	document.querySelector("#cart-subtotal").textContent = formatPrice(subtotal);
	document.querySelector("#cart-empty").hidden = items.length > 0;
	document.querySelector("#drawer-footer").hidden = items.length === 0;
	cartItemsElement.innerHTML = items.map(({ product, quantity }) => `
		<article class="cart-line">
			<img src="https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=180&q=75" alt="" loading="lazy">
			<div><h3 class="cart-line-name">${product.name}</h3><span class="cart-line-price">${formatPrice(product.price)}</span>
				<div class="quantity-control" aria-label="Quantity for ${product.name}"><button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Decrease quantity">−</button><span>${quantity}</span><button type="button" data-quantity="${product.id}" data-change="1" aria-label="Increase quantity">+</button></div>
			</div>
			<button class="remove-item" type="button" data-remove="${product.id}" aria-label="Remove ${product.name}">×</button>
		</article>`).join("");
}

function openCart() {
	drawerBackdrop.hidden = false;
	requestAnimationFrame(() => {
		drawerBackdrop.classList.add("is-visible");
		cartDrawer.classList.add("is-open");
		cartDrawer.setAttribute("aria-hidden", "false");
	});
	document.body.classList.add("drawer-open");
	document.querySelector("#cart-close").focus();
}

function closeCart() {
	drawerBackdrop.classList.remove("is-visible");
	cartDrawer.classList.remove("is-open");
	cartDrawer.setAttribute("aria-hidden", "true");
	document.body.classList.remove("drawer-open");
	window.setTimeout(() => { drawerBackdrop.hidden = true; }, 260);
	document.querySelector("#cart-open").focus();
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add("is-visible");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

document.querySelectorAll("[data-category]").forEach((button) => {
	button.addEventListener("click", () => setCategory(button.dataset.category));
});
searchInput.addEventListener("input", renderProducts);
searchForm.addEventListener("submit", (event) => {
	event.preventDefault();
	document.querySelector("#products").scrollIntoView({ behavior: "smooth" });
	renderProducts();
});
sortSelect.addEventListener("change", renderProducts);

productGrid.addEventListener("click", (event) => {
	const addButton = event.target.closest("[data-add]");
	const favoriteButton = event.target.closest("[data-favorite]");
	if (addButton) addToCart(addButton.dataset.add);
	if (favoriteButton) {
		const productId = favoriteButton.dataset.favorite;
		favorites.has(productId) ? favorites.delete(productId) : favorites.add(productId);
		renderProducts();
	}
});

document.querySelector("#saved-button").addEventListener("click", (event) => {
	showFavoritesOnly = !showFavoritesOnly;
	activeCategory = "all";
	searchInput.value = "";
	document.querySelectorAll("[data-category]").forEach((button) => button.classList.toggle("is-active", button.dataset.category === "all"));
	event.currentTarget.classList.toggle("is-selected", showFavoritesOnly);
	renderProducts();
	document.querySelector("#products").scrollIntoView({ behavior: "smooth" });
});

document.querySelector("#clear-filters").addEventListener("click", () => {
	searchInput.value = "";
	setCategory("all");
});
document.querySelector("#cart-open").addEventListener("click", openCart);
document.querySelector("#cart-close").addEventListener("click", closeCart);
document.querySelector("#continue-shopping").addEventListener("click", closeCart);
drawerBackdrop.addEventListener("click", closeCart);
document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && cartDrawer.classList.contains("is-open")) closeCart();
});

cartItemsElement.addEventListener("click", (event) => {
	const quantityButton = event.target.closest("[data-quantity]");
	const removeButton = event.target.closest("[data-remove]");
	if (quantityButton) {
		const id = quantityButton.dataset.quantity;
		cart[id] = (cart[id] || 0) + Number(quantityButton.dataset.change);
		if (cart[id] <= 0) delete cart[id];
		persistCart();
	}
	if (removeButton) {
		delete cart[removeButton.dataset.remove];
		persistCart();
	}
});

document.querySelector("#checkout-button").addEventListener("click", () => {
	window.location.href = "checkout.html";
});

renderProducts();
renderCart();
if (window.location.hash === "#cart") openCart();
