import { createBooking, expireBooking, getEvent, pay } from "../api.js";
import { el, formatPrice } from "../ui.js";

const app = document.querySelector("#app");
const eventId = new URLSearchParams(window.location.search).get("id");
let event;
let selectedTier = null;
let quantity = 1;
let checkout = null;
let countdownTimer = null;
const releasedBookingReferences = new Set();

function formatDate(value) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

function getMaximum() {
  return selectedTier ? Math.min(10, selectedTier.available) : 0;
}

function setQuantity(nextValue) {
  const maximum = getMaximum();
  quantity = maximum === 0 ? 1 : Math.min(maximum, Math.max(1, Number(nextValue) || 1));
  const input = document.querySelector("#ticket-quantity");
  if (input) input.value = String(quantity);
  updateTotals();
}

function updateTotals() {
  const total = document.querySelector("#booking-total");
  if (total) {
    total.textContent = checkout
      ? `${checkout.quantity} ticket${checkout.quantity === 1 ? "" : "s"} held · ${formatPrice(checkout.amountCents)}`
      : selectedTier
      ? `${quantity} ticket${quantity === 1 ? "" : "s"} · ${formatPrice(selectedTier.priceCents * quantity)}`
      : "Select a tier";
  }
  const quantityInput = document.querySelector("#ticket-quantity");
  if (quantityInput) {
    quantityInput.max = String(getMaximum());
    quantityInput.disabled = Boolean(checkout) || getMaximum() === 0;
  }
  const reserveButton = document.querySelector("#reserve-button");
  if (reserveButton && !checkout) {
    reserveButton.disabled = !selectedTier || selectedTier.available <= 0;
    reserveButton.textContent = selectedTier ? `Hold ${quantity} ticket${quantity === 1 ? "" : "s"}` : "Choose a tier";
  }
}

function applyExpiredBooking(expiredBooking) {
  if (releasedBookingReferences.has(expiredBooking.reference)) return;
  releasedBookingReferences.add(expiredBooking.reference);

  const tier = event.tiers.find((item) => item.id === expiredBooking.tierId);
  if (!tier) throw new Error("Ticket tier for expired booking was not found");
  tier.available += expiredBooking.quantity;
  tier.sold -= expiredBooking.quantity;
  renderTierButtons();
  updateTotals();
}

function renderCheckout() {
  const oldCheckout = document.querySelector("#checkout");
  if (oldCheckout) oldCheckout.remove();

  if (!checkout) return;
  const expiresAt = Date.parse(checkout.holdExpiresAt);
  const countdown = el("strong", { id: "hold-countdown", "aria-live": "polite" }, ["10:00"]);

  const cardNumber = el("input", {
    id: "card-number",
    name: "cardNumber",
    type: "text",
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "4242 4242 4242 4242",
  });
  const decline = el("input", { id: "decline-payment", name: "decline", type: "checkbox" });
  const paymentError = el("p", { id: "payment-error", className: "error", role: "alert" });
  const payButton = el("button", { className: "button", type: "submit" }, ["Pay now"]);
  const restartButton = el("button", {
    className: "button",
    type: "button",
    onclick: () => {
      checkout = null;
      clearInterval(countdownTimer);
      section.remove();
      renderTierButtons();
      updateTotals();
    },
  }, ["Choose tickets again"]);

  async function finishExpiredHold() {
    clearInterval(countdownTimer);
    payButton.disabled = true;
    paymentError.textContent = "The seat hold has expired.";
    try {
      const expiredBooking = await expireBooking(checkout.reference);
      if (expiredBooking.status === "expired") applyExpiredBooking(expiredBooking);
      restartButton.hidden = false;
      if (!restartButton.isConnected) section.append(restartButton);
    } catch (error) {
      paymentError.textContent = error.message;
    }
  }

  const section = el("section", { id: "checkout", className: "checkout" }, [
    el("h2", { textContent: "Checkout" }),
    el("p", {}, [
      "Seats held for ",
      countdown,
    ]),
    el("p", { className: "booking-summary", textContent: `${checkout.quantity} × ${selectedTier.name} · ${formatPrice(checkout.amountCents)}` }),
    el("p", { className: "muted", textContent: `Booking reference: ${checkout.reference}` }),
    el("form", {
      id: "payment-form",
      onsubmit: async (submitEvent) => {
        submitEvent.preventDefault();
        paymentError.textContent = "";
        payButton.disabled = true;
        payButton.textContent = "Processing…";
        try {
          const paid = await pay(checkout.reference, { decline: decline.checked });
          clearInterval(countdownTimer);
          section.replaceChildren(
            el("h2", { textContent: "Payment confirmed" }),
            el("p", { className: "success", textContent: `Paid ${formatPrice(paid.amountCents)}. Reference: ${paid.reference}` }),
          );
        } catch (error) {
          if (error.code === "BOOKING_EXPIRED") {
            await finishExpiredHold();
          } else {
            paymentError.textContent = error.code === "PAYMENT_DECLINED"
              ? "Your mock card was declined. Check the details or try again."
              : error.message;
            payButton.disabled = false;
            payButton.textContent = "Try again";
          }
        }
      },
    }, [
      el("div", { className: "field" }, [
        el("label", { for: "card-number" }, ["Mock card number"]),
        cardNumber,
      ]),
      el("label", { className: "checkbox-field", for: "decline-payment" }, [
        decline,
        el("span", { textContent: "Simulate declined payment" }),
      ]),
      paymentError,
      payButton,
    ]),
  ]);

  document.querySelector("#event-layout")?.append(section);
  clearInterval(countdownTimer);
  const updateCountdown = () => {
    const remaining = Math.max(0, expiresAt - Date.now());
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    countdown.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (remaining === 0) {
      void finishExpiredHold();
    }
  };
  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 1000);
}

function render() {
  app.replaceChildren();
  app.append(el("a", { className: "back-link", href: "./index.html" }, ["← Back to events"]));

  app.append(el("div", { id: "event-layout", className: "event-layout" }));
  const layout = document.querySelector("#event-layout");
  layout.append(
    el("article", { className: "event-details" }, [
      el("p", { className: "event-city", textContent: event.city }),
      el("h1", { textContent: event.title }),
      el("p", { className: "muted", textContent: event.venue }),
      el("p", { textContent: formatDate(event.startsAt) }),
    ]),
  );

  const tierSection = el("section", { className: "tiers" });
  tierSection.append(el("h2", { textContent: "Choose tickets" }));
  for (const tier of event.tiers) {
    const soldOut = tier.available <= 0;
    const button = el("button", {
      className: "tier-button",
      type: "button",
      disabled: soldOut ? "disabled" : undefined,
    }, [
      el("span", { className: "tier-name", textContent: tier.name }),
      el("span", { textContent: formatPrice(tier.priceCents) }),
      el("span", { className: soldOut ? "sold-out" : "seats-left", textContent: soldOut ? "Sold out" : `${tier.available} seats left` }),
    ]);
    button.addEventListener("click", () => {
      selectedTier = tier;
      quantity = 1;
      checkout = null;
      clearInterval(countdownTimer);
      document.querySelector("#checkout")?.remove();
      renderTierButtons();
      setQuantity(1);
    });
    tierSection.append(button);
  }
  layout.append(tierSection);

  const quantityField = el("div", { className: "quantity-and-total" });
  const quantityInput = el("input", {
    id: "ticket-quantity",
    type: "number",
    min: "1",
    max: "10",
    value: "1",
  });
  quantityField.append(
    el("div", { className: "field quantity-field" }, [
      el("label", { for: "ticket-quantity" }, ["Quantity"]),
      el("div", { className: "quantity-picker" }, [
        el("button", { type: "button", "aria-label": "Decrease quantity", onclick: () => setQuantity(quantity - 1) }, ["−"]),
        quantityInput,
        el("button", { type: "button", "aria-label": "Increase quantity", onclick: () => setQuantity(quantity + 1) }, ["＋"]),
      ]),
    ]),
    el("p", { id: "booking-total", className: "booking-total", textContent: "Select a tier" }),
  );
  quantityInput.addEventListener("input", () => setQuantity(quantityInput.value));
  layout.append(quantityField);

  const reserveButton = el("button", { id: "reserve-button", className: "button", type: "button", disabled: "disabled" }, ["Choose a tier"]);
  reserveButton.addEventListener("click", async () => {
    if (!selectedTier) return;
    reserveButton.disabled = true;
    reserveButton.textContent = "Holding seats…";
    try {
      checkout = await createBooking({ tierId: selectedTier.id, quantity });
      selectedTier.available -= quantity;
      selectedTier.sold += quantity;
      reserveButton.textContent = "Seats held";
      renderTierButtons();
      renderCheckout();
    } catch (error) {
      reserveButton.disabled = false;
      reserveButton.textContent = "Try again";
      const errorNode = el("p", { className: "error", role: "alert", textContent: error.message });
      layout.append(errorNode);
    }
  });
  layout.append(reserveButton);
  renderTierButtons();
  updateTotals();
}

function renderTierButtons() {
  document.querySelectorAll(".tier-button").forEach((button) => {
    button.classList.remove("selected");
  });
  event.tiers.forEach((tier, index) => {
    const button = document.querySelectorAll(".tier-button")[index];
    if (!button) return;
    const soldOut = tier.available <= 0;
    button.disabled = soldOut || Boolean(checkout);
    if (selectedTier?.id === tier.id) button.classList.add("selected");
    const status = button.querySelector(".sold-out, .seats-left");
    if (status) {
      status.textContent = soldOut ? "Sold out" : `${tier.available} seats left`;
      status.className = soldOut ? "sold-out" : "seats-left";
    }
  });
  const reserveButton = document.querySelector("#reserve-button");
  if (reserveButton) {
    reserveButton.disabled = Boolean(checkout) || !selectedTier || selectedTier.available <= 0;
    reserveButton.textContent = checkout
      ? "Seats held"
      : selectedTier
        ? `Hold ${quantity} ticket${quantity === 1 ? "" : "s"}`
        : "Choose a tier";
  }
}

async function init() {
  app.append(el("p", { className: "status", textContent: "Loading event…" }));
  try {
    if (!eventId) throw new Error("No event was specified");
    event = await getEvent(eventId);
    render();
  } catch (error) {
    app.replaceChildren(el("p", { className: "error", role: "alert", textContent: error.message }));
  }
}

init();
