const checkoutItemsElement = document.querySelector("#checkout-items");
const checkoutTotal = document.querySelector("#checkout-total");
const checkoutCount = document.querySelector("#checkout-item-count");
const checkoutLayout = document.querySelector("#checkout-layout");
const checkoutEmpty = document.querySelector("#checkout-empty");
const paymentQr = document.querySelector("#payment-qr");
const qrPlaceholder = document.querySelector("#qr-placeholder");
const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function readCheckoutCart() {
  try {
    const cart = JSON.parse(localStorage.getItem("goodfind-cart") || "{}");
    return Object.entries(cart)
      .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
      .filter((item) => item.product && Number.isInteger(item.quantity) && item.quantity > 0);
  } catch {
    return [];
  }
}

function renderCheckout() {
  const items = readCheckoutCart();
  const count = items.reduce((total, item) => total + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  checkoutLayout.hidden = items.length === 0;
  checkoutEmpty.hidden = items.length !== 0;
  checkoutCount.textContent = `${count} ${count === 1 ? "item" : "items"}`;
  checkoutTotal.textContent = inr.format(total);
  checkoutItemsElement.innerHTML = items.map(({ product, quantity }) => `
    <article class="checkout-item">
      <img src="https://images.unsplash.com/${product.image}?auto=format&fit=crop&w=180&q=75" alt="" loading="lazy">
      <div class="checkout-item-info"><h3>${product.name}</h3><span>${product.category} · Qty ${quantity}</span></div>
      <strong>${inr.format(product.price * quantity)}</strong>
    </article>`).join("");
}

paymentQr.addEventListener("load", () => {
  if (paymentQr.naturalWidth > 0) {
    paymentQr.classList.add("is-loaded");
    qrPlaceholder.hidden = true;
  }
});

paymentQr.addEventListener("error", () => {
  paymentQr.classList.remove("is-loaded");
  qrPlaceholder.hidden = false;
});

function loadPaymentQr() {
  const imagePath = window.PHANTOMS_CART_PAYMENT_QR;
  if (imagePath) {
    paymentQr.src = imagePath;
  } else {
    qrPlaceholder.hidden = false;
  }
}

renderCheckout();
loadPaymentQr();