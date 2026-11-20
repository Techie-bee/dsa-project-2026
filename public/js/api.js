import { mockEvents } from "./mockData.js";

let nextReference = 1001;
const bookings = new Map();

function summarize(event) {
  return {
    id: event.id,
    title: event.title,
    city: event.city,
    venue: event.venue,
    startsAt: event.startsAt,
    status: event.status,
    tierCount: event.tiers.length,
    minPriceCents: Math.min(...event.tiers.map((tier) => tier.priceCents)),
    seatsLeft: event.tiers.reduce((total, tier) => total + tier.available, 0),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export async function listEvents(options = {}) {
  const { q = "", city = "", maxPriceCents, sortBy = "date" } = options;
  let results = mockEvents
    .filter((event) => event.status === "published")
    .filter((event) => !q || `${event.title} ${event.venue} ${event.city}`.toLowerCase().includes(q.toLowerCase()))
    .filter((event) => !city || event.city.toLowerCase() === city.toLowerCase())
    .filter((event) => maxPriceCents === undefined || event.tiers.some((tier) => tier.priceCents <= maxPriceCents));

  if (sortBy === "price") {
    results = [...results].sort((a, b) => Math.min(...a.tiers.map((t) => t.priceCents)) - Math.min(...b.tiers.map((t) => t.priceCents)));
  } else if (sortBy === "availability") {
    results = [...results].sort((a, b) => b.tiers.reduce((n, t) => n + t.available, 0) - a.tiers.reduce((n, t) => n + t.available, 0));
  } else {
    results = [...results].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  }
  return clone(results.map(summarize));
}

export async function getEvent(eventId) {
  const event = mockEvents.find((item) => item.id === eventId);
  if (!event) throw new Error("Event not found");
  return clone(event);
}

export async function createBooking({ tierId, quantity }) {
  let foundTier;
  let foundEvent;
  for (const event of mockEvents) {
    foundTier = event.tiers.find((tier) => tier.id === tierId);
    if (foundTier) {
      foundEvent = event;
      break;
    }
  }
  if (!foundEvent || !foundTier || foundTier.available <= 0) throw new Error("Not enough tickets available");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10 || quantity > foundTier.available) {
    throw new Error("Quantity must be between 1 and the available seats");
  }
  foundTier.available -= quantity;
  foundTier.sold += quantity;
  const reference = `TKT${nextReference++}`;
  const createdAt = new Date();
  const booking = {
    id: `booking-${reference}`,
    reference,
    userId: "attendee-1",
    eventId: foundEvent.id,
    tierId,
    quantity,
    amountCents: foundTier.priceCents * quantity,
    status: "pending",
    createdAt: createdAt.toISOString(),
    holdExpiresAt: new Date(createdAt.getTime() + 10 * 60 * 1000).toISOString(),
  };
  bookings.set(reference, booking);
  return clone(booking);
}

function expirePendingBooking(booking, now) {
  if (booking.status !== "pending" || Date.parse(booking.holdExpiresAt) > now) {
    return false;
  }

  const event = mockEvents.find((item) => item.id === booking.eventId);
  const tier = event?.tiers.find((item) => item.id === booking.tierId);
  if (!tier) throw new Error("Ticket tier for booking was not found");

  tier.available += booking.quantity;
  tier.sold -= booking.quantity;
  booking.status = "expired";
  booking.expiredAt = new Date(now).toISOString();
  return true;
}

export async function expireBooking(reference, now = Date.now()) {
  const booking = bookings.get(reference);
  if (!booking) throw new Error("Booking not found");
  if (!Number.isFinite(now)) throw new TypeError("now must be a timestamp");
  expirePendingBooking(booking, now);
  return clone(booking);
}

export async function pay(reference, { decline = false } = {}) {
  const booking = bookings.get(reference);
  if (!booking) throw new Error("Booking not found");
  if (typeof decline !== "boolean") throw new Error("decline must be a boolean");
  expirePendingBooking(booking, Date.now());
  if (booking.status === "expired") {
    const error = new Error("The booking hold has expired");
    error.code = "BOOKING_EXPIRED";
    throw error;
  }
  if (decline) {
    const error = new Error("Payment was declined");
    error.code = "PAYMENT_DECLINED";
    throw error;
  }
  booking.status = "paid";
  return clone(booking);
}
