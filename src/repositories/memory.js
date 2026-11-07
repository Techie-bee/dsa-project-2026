export class MemoryRepository {
  #events = new Map();
  #tiers = new Map();
  #bookings = new Map();
  #bookingsByReference = new Map();

  async createEvent(event) {
    this.#events.set(event.id, event);
    return event;
  }

  async getEvent(id) {
    return this.#events.get(id);
  }

  async listEvents() {
    return [...this.#events.values()];
  }

  async createTier(tier) {
    this.#tiers.set(tier.id, tier);
    return tier;
  }

  async getTier(id) {
    return this.#tiers.get(id);
  }

  async listTiersForEvent(eventId) {
    return [...this.#tiers.values()].filter((tier) => tier.eventId === eventId);
  }

  async updateTier(tier) {
    if (!this.#tiers.has(tier.id)) return undefined;
    this.#tiers.set(tier.id, tier);
    return tier;
  }

  async createBooking(booking) {
    this.#bookings.set(booking.id, booking);
    this.#bookingsByReference.set(booking.reference, booking);
    return booking;
  }

  async getBookingByReference(reference) {
    return this.#bookingsByReference.get(reference);
  }

  async updateBooking(booking) {
    if (!this.#bookings.has(booking.id)) return undefined;
    this.#bookings.set(booking.id, booking);
    this.#bookingsByReference.set(booking.reference, booking);
    return booking;
  }

  async listBookings() {
    return [...this.#bookings.values()];
  }
}

export function createMemoryRepository() {
  return new MemoryRepository();
}
