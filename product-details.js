const productId = new URLSearchParams(window.location.search).get("id");
const product = products.find((item) => item.id === productId);
const detailContainer = document.querySelector("#product-detail");
const notFound = document.querySelector("#detail-not-found");
const detailToast = document.querySelector("#detail-toast");
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function updateDetailCartCount() {
  try {
    const cart = JSON.parse(localStorage.getItem("goodfind-cart") || "{}");
    const count = Object.values(cart).reduce((total, quantity) => total + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0), 0);
    document.querySelector("#detail-cart-count").textContent = count;
  } catch {
    document.querySelector("#detail-cart-count").textContent = "0";
  }
}

function showDetailToast(message) {
  detailToast.textContent = message;
  detailToast.classList.add("is-visible");
  window.setTimeout(() => detailToast.classList.remove("is-visible"), 2400);
}

function renderProduct() {
  if (!product) {
    detailContainer.hidden = true;
    notFound.hidden = false;
    return;
  }

  document.title = `${product.name} — Phantoms Cart`;
  document.querySelector("#detail-breadcrumb-category").textContent = product.category;
  const savings = product.oldPrice ? product.oldPrice - product.price : 0;

  detailContainer.innerHTML = `
    <div class="detail-gallery">
      <div class="detail-image-frame"><img src="https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=1200&q=85" alt="${product.alt}"></div>
      <p class="detail-image-note"><span aria-hidden="true">✳</span> A good find, picked for everyday.</p>
    </div>
    <section class="detail-information" aria-labelledby="detail-title">
      <p class="eyebrow detail-category">${product.category.toUpperCase()} <span>·</span> ${product.tag}</p>
      <h1 id="detail-title">${product.name}</h1>
      <p class="detail-subtitle">${product.subtitle}</p>
      <div class="detail-rating"><span aria-label="${product.rating} out of 5 stars">★★★★★</span><strong>${product.rating}</strong><span class="detail-review-count">${product.reviews} customer reviews</span></div>
      <div class="detail-price-row"><strong>${currency.format(product.price)}</strong>${product.oldPrice ? `<del>${currency.format(product.oldPrice)}</del><span class="detail-savings">You save ${currency.format(savings)}</span>` : ""}</div>
      <p class="detail-description">${product.description}</p>
      <div class="detail-highlights"><h2>Why it’s a good find</h2><ul>${product.highlights.map((highlight) => `<li><span aria-hidden="true">✓</span>${highlight}</li>`).join("")}</ul></div>
      <div class="detail-purchase">
        <div class="detail-quantity" aria-label="Choose quantity"><button type="button" data-quantity-change="-1" aria-label="Decrease quantity">−</button><output id="detail-quantity" aria-live="polite">1</output><button type="button" data-quantity-change="1" aria-label="Increase quantity">+</button></div>
        <button class="detail-add-button" id="detail-add" type="button">Add to cart <span aria-hidden="true">+</span></button>
      </div>
      <div class="detail-promises"><p><span aria-hidden="true">↗</span><span><strong>Free shipping</strong> on orders over ₹999</span></p><p><span aria-hidden="true">↺</span><span><strong>Easy returns</strong> within 30 days</span></p></div>
      <a class="detail-continue" href="index.html#products">← Keep browsing good finds</a>
    </section>`;

  let quantity = 1;
  const quantityOutput = document.querySelector("#detail-quantity");
  detailContainer.addEventListener("click", (event) => {
    const quantityButton = event.target.closest("[data-quantity-change]");
    if (quantityButton) {
      quantity = Math.max(1, quantity + Number(quantityButton.dataset.quantityChange));
      quantityOutput.value = quantity;
      quantityOutput.textContent = quantity;
    }

    if (event.target.closest("#detail-add")) {
      try {
        const cart = JSON.parse(localStorage.getItem("goodfind-cart") || "{}");
        cart[product.id] = (Number.isFinite(cart[product.id]) ? cart[product.id] : 0) + quantity;
        localStorage.setItem("goodfind-cart", JSON.stringify(cart));
        updateDetailCartCount();
        showDetailToast(`${quantity} × ${product.name} added to your cart.`);
      } catch {
        showDetailToast("Your cart could not be updated. Please try again.");
      }
    }
  });

  updateDetailCartCount();
}

renderProduct();