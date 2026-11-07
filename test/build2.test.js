import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  unpublishEvent,
} from "../src/domain/inventory.js";
import { filterEvents, searchEvents, sortEvents } from "../src/domain/eventSearch.js";
import { DomainError } from "../src/domain/errors.js";
import { mergeSort } from "../src/domain/sorting.js";

const isDomainError = (code) => (error) =>
  error instanceof DomainError && error.code === code;

function makeEvent(store, {
  title,
  city = "Lagos",
  venue = "Main Hall",
  startsAt = "2026-12-05T17:00:00Z",
  tiers = [],
} = {}) {
  const event = createEvent(store, { title, city, venue, startsAt });
  for (const tier of tiers) addTier(store, event.id, tier);
  return event;
}

function summary(overrides = {}) {
  return {
    id: "event-1",
    title: "Lagos Tech Meetup",
    city: "Lagos",
    venue: "Yaba Hub",
    startsAt: "2026-12-05T17:00:00Z",
    status: "published",
    tierCount: 1,
    minPriceCents: 5000,
    seatsLeft: 3,
    ...overrides,
  };
}

describe("Build 2 event lifecycle and summaries", () => {
  it("creates a draft event with a new id and hides it from the public list", () => {
    const store = createStore();
    const event = makeEvent(store, {
      title: "Lagos Tech Meetup",
      tiers: [{ name: "General", priceCents: 500000, capacity: 100 }],
    });

    assert.ok(event.id);
    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
    assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
  });

  it("rejects a missing title, city, venue, or invalid date without saving an event", () => {
    const store = createStore();
    const invalidEvents = [
      { title: " ", city: "Lagos", venue: "Hall", startsAt: "2026-12-05" },
      { title: "Meetup", city: " ", venue: "Hall", startsAt: "2026-12-05" },
      { title: "Meetup", city: "Lagos", venue: " ", startsAt: "2026-12-05" },
      { title: "Meetup", city: "Lagos", venue: "Hall", startsAt: "2026-02-31" },
    ];

    for (const input of invalidEvents) {
      assert.throws(() => createEvent(store, input), isDomainError("VALIDATION"));
    }
    assert.equal(store.events.size, 0);
  });

  it("adds a tier with zero tickets sold and the requested capacity", () => {
    const store = createStore();
    const event = makeEvent(store, { title: "Meetup" });
    const tier = addTier(store, event.id, {
      name: "General",
      priceCents: 500000,
      capacity: 100,
    });

    assert.equal(tier.sold, 0);
    assert.equal(tier.available, 100);
    assert.equal(event.tierIds.includes(tier.id), true);
  });

  it("rejects fractional prices and capacities below one", () => {
    const store = createStore();
    const event = makeEvent(store, { title: "Meetup" });

    assert.throws(
      () => addTier(store, event.id, { name: "General", priceCents: 19.99, capacity: 5 }),
      isDomainError("VALIDATION"),
    );
    assert.throws(
      () => addTier(store, event.id, { name: "General", priceCents: 100, capacity: 0 }),
      isDomainError("VALIDATION"),
    );
  });

  it("rejects adding a tier to an unknown event", () => {
    assert.throws(
      () => addTier(createStore(), "missing-event", {
        name: "General",
        priceCents: 100,
        capacity: 1,
      }),
      isDomainError("NOT_FOUND"),
    );
  });

  it("requires a tier before publishing", () => {
    const store = createStore();
    const event = makeEvent(store, { title: "Meetup" });

    assert.throws(() => publishEvent(store, event.id), isDomainError("INVALID_STATE"));
    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
  });

  it("publishes an event into the public list", () => {
    const store = createStore();
    const event = makeEvent(store, {
      title: "Meetup",
      tiers: [{ name: "General", priceCents: 100, capacity: 2 }],
    });

    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
    publishEvent(store, event.id);
    assert.equal(event.status, "published");
    assert.equal(listEventSummaries(store)[0].title, "Meetup");
  });

  it("unpublishes an event without deleting its tiers", () => {
    const store = createStore();
    const event = makeEvent(store, {
      title: "Meetup",
      tiers: [{ name: "General", priceCents: 100, capacity: 2 }],
    });
    const tierId = event.tierIds[0];
    publishEvent(store, event.id);
    assert.equal(event.status, "published");
    assert.equal(listEventSummaries(store).length, 1);

    unpublishEvent(store, event.id);
    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
    assert.equal(listEventSummaries(store, { publishedOnly: false })[0].tierCount, 1);
    assert.equal(store.tiers.has(tierId), true);
  });
});

describe("Build 2 event search and sorting", () => {
  it("searches event titles and venues without case sensitivity", () => {
    const events = [
      summary(),
      summary({ id: "event-2", title: "Abuja Jazz Night", city: "Abuja", venue: "Civic Centre" }),
    ];
    assert.deepEqual(filterEvents(events, { q: "JAZZ" }), [events[1]]);
    assert.deepEqual(filterEvents(events, { q: "yaba" }), [events[0]]);
  });

  it("filters by city without case sensitivity", () => {
    const events = [
      summary(),
      summary({ id: "event-2", title: "Abuja Jazz Night", city: "Abuja", venue: "Civic Centre" }),
    ];
    assert.deepEqual(filterEvents(events, { city: "lagos" }), [events[0]]);
  });

  it("filters at the cheapest tier price and sorts cheapest first", () => {
    const events = [
      summary({ id: "expensive", minPriceCents: 5000 }),
      summary({ id: "cheap", minPriceCents: 1000 }),
      summary({ id: "no-tier", minPriceCents: null, tierCount: 0 }),
    ];

    assert.deepEqual(
      searchEvents(events, { maxPriceCents: 3000 }, "price").map((event) => event.id),
      ["cheap"],
    );
  });

  it("sorts unpriced events last and most available events first", () => {
    const priced = summary({ id: "priced", minPriceCents: 500 });
    const noPrice = summary({ id: "no-price", minPriceCents: null, tierCount: 0 });
    const soldOut = summary({ id: "sold-out", seatsLeft: 0 });
    const available = summary({ id: "available", seatsLeft: 4 });

    assert.deepEqual(sortEvents([noPrice, priced], "price").map((event) => event.id), [
      "priced",
      "no-price",
    ]);
    assert.deepEqual(
      sortEvents([soldOut, available], "availability").map((event) => event.id),
      ["available", "sold-out"],
    );
  });

  it("sorts dates earliest first and breaks same-date ties by title", () => {
    const events = [
      summary({ id: "z", title: "Zulu", startsAt: "2026-12-05T17:00:00Z" }),
      summary({ id: "later", title: "Aardvark", startsAt: "2026-12-06T09:00:00Z" }),
      summary({ id: "a", title: "Alpha", startsAt: "2026-12-05T17:00:00Z" }),
    ];

    assert.deepEqual(sortEvents(events, "date").map((event) => event.id), ["a", "z", "later"]);
  });

  it("includes the whole date in an inclusive date-only upper bound", () => {
    const event = summary({ startsAt: "2026-12-05T23:59:59Z" });
    assert.deepEqual(filterEvents([event], { to: "2026-12-05" }), [event]);
  });

  it("treats the lower date bound as inclusive", () => {
    const event = summary({ startsAt: "2026-12-05T00:00:00Z" });
    assert.deepEqual(filterEvents([event], { from: "2026-12-05" }), [event]);
  });

  it("rejects bad dates, non-whole prices, and unknown sort options", () => {
    const events = [summary()];

    assert.throws(() => filterEvents(events, { from: "2026-02-31" }), isDomainError("VALIDATION"));
    assert.throws(() => filterEvents(events, { maxPriceCents: 12.5 }), isDomainError("VALIDATION"));
    assert.throws(() => sortEvents(events, "popular"), isDomainError("VALIDATION"));
  });

  it("does not mutate the source list during filtering, sorting, or searching", () => {
    const events = [
      summary({ id: "b", title: "Zulu", minPriceCents: 2000 }),
      summary({ id: "a", title: "Alpha", minPriceCents: 1000 }),
    ];
    const original = [...events];

    filterEvents(events, { city: "Lagos" });
    sortEvents(events, "price");
    searchEvents(events, { q: "a" }, "date");
    assert.deepEqual(events, original);
    assert.notEqual(sortEvents(events, "price"), events);
  });

  it("supports empty input lists", () => {
    assert.deepEqual(filterEvents([], { q: "anything" }), []);
    assert.deepEqual(sortEvents([], "availability"), []);
    assert.deepEqual(searchEvents([], {}), []);
  });

  it("filters out sold-out events when onlyAvailable is enabled", () => {
    const available = summary({ id: "available", seatsLeft: 1 });
    const soldOut = summary({ id: "sold-out", seatsLeft: 0 });
    assert.deepEqual(filterEvents([available, soldOut], { onlyAvailable: true }), [available]);
  });

  it("uses a stable merge sort and returns a new array", () => {
    const input = [
      { key: 1, order: "first" },
      { key: 0, order: "middle" },
      { key: 1, order: "last" },
    ];
    const sorted = mergeSort(input, (a, b) => a.key - b.key);

    assert.deepEqual(sorted.map((item) => item.order), ["middle", "first", "last"]);
    assert.notEqual(sorted, input);
    assert.deepEqual(input.map((item) => item.order), ["first", "middle", "last"]);
  });
});

describe("Build 2 booking rules", () => {
  function bookingFixture() {
    const store = createStore();
    const event = makeEvent(store, {
      title: "Meetup",
      tiers: [{ name: "General", priceCents: 2500, capacity: 3 }],
    });
    publishEvent(store, event.id);
    return { store, event, tier: store.tiers.get(event.tierIds[0]) };
  }

  it("books available tickets with a pending status and whole-cent price", () => {
    const { store, event, tier } = bookingFixture();
    const booking = bookTickets(store, event.id, tier.id, { name: "Ada", quantity: 2 });

    assert.equal(booking.status, "pending");
    assert.equal(booking.quantity, 2);
    assert.equal(booking.totalPriceInCents, 5000);
    assert.equal(tier.available, 1);
    assert.equal(tier.sold, 2);
  });

  it("rejects an oversized booking without changing capacity or bookings", () => {
    const { store, event, tier } = bookingFixture();
    bookTickets(store, event.id, tier.id, { name: "Ada", quantity: 2 });
    const bookingsBefore = store.bookings.size;

    assert.throws(
      () => bookTickets(store, event.id, tier.id, { name: "Bayo", quantity: 2 }),
      isDomainError("SOLD_OUT"),
    );
    assert.equal(tier.available, 1);
    assert.equal(tier.sold, 2);
    assert.equal(store.bookings.size, bookingsBefore);
  });

  it("rejects quantities outside 1 through 10", () => {
    const { store, event, tier } = bookingFixture();

    for (const quantity of [0, -1, 1.5, 11]) {
      assert.throws(
        () => bookTickets(store, event.id, tier.id, { name: "Ada", quantity }),
        isDomainError("VALIDATION"),
      );
    }
  });
});
