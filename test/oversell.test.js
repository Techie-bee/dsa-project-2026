import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDatabase } from "../src/db/connection.js";
import { createMockPaymentGateway } from "../src/lib/mockPaymentGateway.js";
import { createSqliteRepository } from "../src/repositories/sqlite.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createEventService } from "../src/services/eventService.js";

describe("SQLite overselling protection", () => {
  it("allows exactly one of 50 simultaneous bookings for the last seat", async () => {
    const database = createDatabase(":memory:");
    const repository = createSqliteRepository({ database });

    try {
      const eventService = createEventService(repository);
      const bookingService = createBookingService(
        repository,
        createMockPaymentGateway()
      );
      const event = await eventService.createEvent("organizer-1", {
        title: "Last Seat Event",
        city: "Lagos",
        venue: "Main Hall",
        startsAt: "2027-12-05T17:00:00Z",
      });
      const tier = await eventService.addTier("organizer-1", event.id, {
        name: "General",
        priceCents: 1000,
        capacity: 1,
      });
      await eventService.publishEvent("organizer-1", event.id);

      const results = await Promise.allSettled(
        Array.from({ length: 50 }, (_, index) =>
          bookingService.createBooking(`attendee-${index}`, {
            tierId: tier.id,
            quantity: 1,
          })
        )
      );
      const successful = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");
      const soldOut = rejected.filter(
        (result) => result.reason?.code === "SOLD_OUT"
      );
      const finalTier = await repository.getTier(tier.id);

      assert.equal(successful.length, 1);
      assert.equal(soldOut.length, 49);
      assert.equal(rejected.length, 49);
      assert.equal(finalTier.sold, 1);
      assert.ok(finalTier.sold <= finalTier.capacity);
      assert.equal((await repository.listBookings()).length, 1);
    } finally {
      repository.close();
    }
  });
});
