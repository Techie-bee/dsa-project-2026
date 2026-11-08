import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { createApp } from "../src/http/app.js";
import { createDatabase } from "../src/db/connection.js";
import { createSqliteRepository } from "../src/repositories/sqlite.js";

let directory;
let databasePath;
let server;
let repository;
let baseUrl;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "ticketing-sqlite-"));
  databasePath = path.join(directory, "test.sqlite");
});

after(async () => {
  if (server?.listening) await closeServer(server);
  repository?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

function closeServer(target) {
  return new Promise((resolve, reject) => {
    target.close((error) => (error ? reject(error) : resolve()));
  });
}

async function startApi() {
  repository = createSqliteRepository({ databasePath });
  server = createServer(createApp({ repository }));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function stopApi() {
  await closeServer(server);
  server = undefined;
  repository.close();
  repository = undefined;
}

async function api(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options);
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("SQLite repository", () => {
  it("persists event data across API server restarts", async () => {
    await startApi();
    const created = await api("/api/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "persisted-organizer",
      },
      body: JSON.stringify({
        title: "Persisted Meetup",
        city: "Lagos",
        venue: "Yaba Hub",
        startsAt: "2027-12-05T17:00:00Z",
      }),
    });
    assert.equal(created.status, 201);

    const tier = await api(`/api/events/${created.body.id}/tiers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "persisted-organizer",
      },
      body: JSON.stringify({
        name: "General",
        priceCents: 500000,
        capacity: 10,
      }),
    });
    assert.equal(tier.status, 201);

    const published = await api(`/api/events/${created.body.id}/publish`, {
      method: "POST",
      headers: { "x-user-id": "persisted-organizer" },
    });
    assert.equal(published.status, 200);

    const booking = await api("/api/bookings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-id": "persisted-attendee",
      },
      body: JSON.stringify({ tierId: tier.body.id, quantity: 2 }),
    });
    assert.equal(booking.status, 201);
    await stopApi();

    await startApi();
    const events = await api("/api/events?q=persisted");
    assert.equal(events.status, 200);
    assert.equal(events.body.length, 1);
    assert.equal(events.body[0].title, "Persisted Meetup");
    assert.equal(events.body[0].minPriceCents, 500000);
    assert.equal(events.body[0].seatsLeft, 8);
    const storedBooking = await repository.getBookingByReference(
      booking.body.reference
    );
    assert.equal(storedBooking.userId, "persisted-attendee");
    assert.equal(storedBooking.status, "pending");
  });

  it("enforces database constraints, including the sold capacity bound", () => {
    const database = createDatabase(":memory:");
    try {
      database.prepare("INSERT INTO users (id) VALUES (?)").run("organizer");
      database
        .prepare(
          `INSERT INTO events
            (id, organizer_id, title, city, venue, starts_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          "event",
          "organizer",
          "Meetup",
          "Lagos",
          "Hall",
          "2027-12-05T17:00:00.000Z",
          "draft"
        );
      database
        .prepare(
          `INSERT INTO ticket_tiers
            (id, event_id, name, price_cents, capacity, sold)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run("tier", "event", "General", 100, 1, 0);

      assert.throws(() =>
        database
          .prepare("UPDATE ticket_tiers SET sold = ? WHERE id = ?")
          .run(2, "tier")
      );
      assert.throws(() =>
        database
          .prepare(
            `INSERT INTO ticket_tiers
              (id, event_id, name, price_cents, capacity, sold)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .run("duplicate-tier", "event", "General", 100, 1, 0)
      );
    } finally {
      database.close();
    }
  });
});
