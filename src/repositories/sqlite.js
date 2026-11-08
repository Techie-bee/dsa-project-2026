import { createDatabase } from "../db/connection.js";

function mapEvent(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    city: row.city,
    venue: row.venue,
    startsAt: row.starts_at,
    status: row.status,
  };
}

function mapTier(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    sold: row.sold,
    available: row.capacity - row.sold,
  };
}

function mapBooking(row) {
  if (!row) return undefined;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    eventId: row.event_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    status: row.status,
    createdAt: row.created_at,
  };
}

export class SqliteRepository {
  #database;

  constructor({ database, databasePath } = {}) {
    this.#database = database ?? createDatabase(databasePath);
  }

  #ensureUser(userId) {
    this.#database
      .prepare("INSERT OR IGNORE INTO users (id) VALUES (?)")
      .run(userId);
  }

  async createEvent(event) {
    this.#ensureUser(event.organizerId);
    this.#database
      .prepare(
        `INSERT INTO events
          (id, organizer_id, title, city, venue, starts_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        event.id,
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status
      );
    return event;
  }

  async getEvent(id) {
    const row = this.#database
      .prepare("SELECT * FROM events WHERE id = ?")
      .get(id);
    return mapEvent(row);
  }

  async listEvents() {
    const rows = this.#database
      .prepare("SELECT * FROM events ORDER BY id")
      .all();
    return rows.map(mapEvent);
  }

  async updateEvent(event) {
    const result = this.#database
      .prepare(
        `UPDATE events
         SET organizer_id = ?, title = ?, city = ?, venue = ?, starts_at = ?, status = ?
         WHERE id = ?`
      )
      .run(
        event.organizerId,
        event.title,
        event.city,
        event.venue,
        event.startsAt,
        event.status,
        event.id
      );
    return result.changes ? event : undefined;
  }

  async createTier(tier) {
    this.#database
      .prepare(
        `INSERT INTO ticket_tiers
          (id, event_id, name, price_cents, capacity, sold)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        tier.id,
        tier.eventId,
        tier.name,
        tier.priceCents,
        tier.capacity,
        tier.sold
      );
    return tier;
  }

  async getTier(id) {
    const row = this.#database
      .prepare("SELECT * FROM ticket_tiers WHERE id = ?")
      .get(id);
    return mapTier(row);
  }

  async listTiersForEvent(eventId) {
    const rows = this.#database
      .prepare("SELECT * FROM ticket_tiers WHERE event_id = ? ORDER BY id")
      .all(eventId);
    return rows.map(mapTier);
  }

  async updateTier(tier) {
    const result = this.#database
      .prepare(
        `UPDATE ticket_tiers
         SET event_id = ?, name = ?, price_cents = ?, capacity = ?, sold = ?
         WHERE id = ?`
      )
      .run(
        tier.eventId,
        tier.name,
        tier.priceCents,
        tier.capacity,
        tier.sold,
        tier.id
      );
    return result.changes ? tier : undefined;
  }

  async createBooking(booking) {
    this.#ensureUser(booking.userId);
    this.#database
      .prepare(
        `INSERT INTO bookings
          (id, reference, user_id, event_id, tier_id, quantity, amount_cents, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.eventId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt
      );
    return booking;
  }

  async getBookingByReference(reference) {
    const row = this.#database
      .prepare("SELECT * FROM bookings WHERE reference = ?")
      .get(reference);
    return mapBooking(row);
  }

  async updateBooking(booking) {
    const result = this.#database
      .prepare(
        `UPDATE bookings
         SET user_id = ?, event_id = ?, tier_id = ?, quantity = ?,
             amount_cents = ?, status = ?, created_at = ?
         WHERE id = ?`
      )
      .run(
        booking.userId,
        booking.eventId,
        booking.tierId,
        booking.quantity,
        booking.amountCents,
        booking.status,
        booking.createdAt,
        booking.id
      );
    return result.changes ? booking : undefined;
  }

  async listBookings() {
    const rows = this.#database
      .prepare("SELECT * FROM bookings ORDER BY id")
      .all();
    return rows.map(mapBooking);
  }

  close() {
    this.#database.close();
  }
}

export function createSqliteRepository(options) {
  return new SqliteRepository(options);
}
