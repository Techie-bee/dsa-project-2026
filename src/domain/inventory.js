
import { DomainError } from "./errors.js";
import { newId, newReference } from "./ids.js";
import { Queue } from "./waitlistQueue.js";
import { summarizeEvent } from "./eventSearch.js";

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
  };
}

function isValidIsoDate(value) {
  if (typeof value !== "string") return false;
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!datePart) return false;

  const [, year, month, day] = datePart.map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    return false;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    ) && !Number.isNaN(Date.parse(value))
  );
}

export function createEvent(store, input = {}) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new DomainError("Event details must be an object", "VALIDATION");
  }

  const title = input.title ?? input.name;
  const dateValue = input.startsAt ?? input.date;
  if (typeof title !== "string" || title.trim() === "") {
    throw new DomainError("Event title is required", "VALIDATION");
  }

  const legacyInput = input.title === undefined && input.startsAt === undefined;
  if (!legacyInput && (typeof input.city !== "string" || input.city.trim() === "")) {
    throw new DomainError("Event city is required", "VALIDATION");
  }
  if (
    !legacyInput &&
    (typeof input.venue !== "string" || input.venue.trim() === "")
  ) {
    throw new DomainError("Event venue is required", "VALIDATION");
  }
  if (!isValidIsoDate(dateValue)) {
    throw new DomainError("Event date must be a valid ISO date", "VALIDATION");
  }

  const startsAt = new Date(dateValue).toISOString();
  const city = input.city?.trim() ?? "";
  const venue = input.venue?.trim() ?? "";
  const event = {
    id: newId(),
    name: title.trim(),
    title: title.trim(),
    city,
    venue,
    date: startsAt,
    startsAt,
    organizerId: input.organizerId,
    status: "draft",
    tiers: new Map(),
    tierIds: [],
  };

  store.events.set(event.id, event);

  return event;
}


export function addTier(store, eventId, tierDetails = {}) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  if (
    !tierDetails ||
    typeof tierDetails !== "object" ||
    Array.isArray(tierDetails)
  ) {
    throw new DomainError("Tier details must be an object", "VALIDATION");
  }
  const { name, capacity, priceCents } = tierDetails;

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Tier name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new DomainError(
      "Capacity must be a positive whole number",
      "VALIDATION"
    );
  }

  if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
    throw new DomainError(
      "Price must be a non-negative whole number",
      "VALIDATION"
    );
  }

  const tier = {
    id: newId(),
    eventId,
    name: name.trim(),
    capacity,
    available: capacity,
    sold: 0,
    priceCents,
    waitlist: new Queue(),
  };

  event.tiers.set(tier.id, tier);
  store.tiers.set(tier.id, tier);
  event.tierIds.push(tier.id);

  return tier;
}

export function publishEvent(store, eventId) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }
  if (event.tierIds.length === 0) {
    throw new DomainError(
      "Add at least one ticket tier before publishing",
      "INVALID_STATE"
    );
  }
  event.status = "published";
  return event;
}

export function unpublishEvent(store, eventId) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  const event = store.events.get(eventId);
  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }
  event.status = "draft";
  return event;
}

export function listEventSummaries(store, options = {}) {
  if (!store || !(store.events instanceof Map) || !(store.tiers instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new DomainError("Options must be an object", "VALIDATION");
  }
  const { publishedOnly = true } = options;
  if (typeof publishedOnly !== "boolean") {
    throw new DomainError("publishedOnly must be a boolean", "VALIDATION");
  }
  return [...store.events.values()]
    .filter((event) => !publishedOnly || event.status === "published")
    .map((event) => {
      const tiers = event.tierIds.map((tierId) => store.tiers.get(tierId));
      return summarizeEvent(event, tiers);
    });
}

export function bookTickets(store, eventId, tierId, bookingDetails = {}) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  if (
    !bookingDetails ||
    typeof bookingDetails !== "object" ||
    Array.isArray(bookingDetails)
  ) {
    throw new DomainError("Booking details must be an object", "VALIDATION");
  }
  const { name, quantity } = bookingDetails;

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  const tier = event.tiers.get(tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Customer name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError(
      "Quantity must be a whole number between 1 and 10",
      "VALIDATION"
    );
  }

  if (tier.available < quantity) {
    throw new DomainError("Not enough tickets available", "SOLD_OUT");
  }
  if (!Number.isSafeInteger(tier.priceCents * quantity)) {
    throw new DomainError("Booking total exceeds the supported range", "VALIDATION");
  }

  const booking = {
    id: newId(),
    reference: newReference(),
    eventId,
    tierId,
    name: name.trim(),
    quantity,
    totalPriceInCents: tier.priceCents * quantity,
    status: "pending",
  };

  tier.available -= quantity;
  tier.sold += quantity;

  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(booking.reference, booking);

  return booking;
}

export function findBookingByReference(store, reference) {
  if (!store || !(store.bookingsByReference instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    throw new DomainError("Booking reference is required", "VALIDATION");
  }

  const booking = store.bookingsByReference.get(reference.trim());

  if (!booking) {
    throw new DomainError("Booking not found", "NOT_FOUND");
  }

  return booking;
}

export function cancelBooking(store, reference) {
  if (!store || !(store.bookingsByReference instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    throw new DomainError("Booking reference is required", "VALIDATION");
  }

  const booking = store.bookingsByReference.get(reference.trim());

  if (!booking) {
    throw new DomainError("Booking not found", "NOT_FOUND");
  }

  if (booking.status === "cancelled" || booking.status === "CANCELLED") {
    throw new DomainError("Booking is already cancelled", "INVALID_STATE");
  }

  const event = store.events.get(booking.eventId);
  const tier = event?.tiers.get(booking.tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  tier.available += booking.quantity;
  tier.sold -= booking.quantity;
  booking.status = "cancelled";

  const nextPerson = tier.waitlist.peek();

  return {
    booking,
    nextPerson,
  };
}

export function joinWaitlist(store, eventId, tierId, entryDetails = {}) {
  if (!store || !(store.events instanceof Map)) {
    throw new DomainError("Invalid store", "VALIDATION");
  }
  if (
    !entryDetails ||
    typeof entryDetails !== "object" ||
    Array.isArray(entryDetails)
  ) {
    throw new DomainError("Waitlist details must be an object", "VALIDATION");
  }
  const { name, quantity } = entryDetails;

  const event = store.events.get(eventId);

  if (!event) {
    throw new DomainError("Event not found", "NOT_FOUND");
  }

  const tier = event.tiers.get(tierId);

  if (!tier) {
    throw new DomainError("Ticket tier not found", "NOT_FOUND");
  }

  if (typeof name !== "string" || name.trim() === "") {
    throw new DomainError("Customer name is required", "VALIDATION");
  }

  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) {
    throw new DomainError(
      "Quantity must be a whole number between 1 and 10",
      "VALIDATION"
    );
  }

  if (tier.available >= quantity) {
    throw new DomainError(
      "Tickets are still available for this quantity",
      "VALIDATION"
    );
  }

  const entry = {
    id: newId(),
    name: name.trim(),
    quantity,
    eventId,
    tierId,
    joinedAt: new Date().toISOString(),
  };

  tier.waitlist.enqueue(entry);

  return entry;
}