import { createDatabase } from "../src/db/connection.js";
import { createSqliteRepository } from "../src/repositories/sqlite.js";
import { createEventService } from "../src/services/eventService.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createMockPaymentGateway } from "../src/lib/mockPaymentGateway.js";

const database = createDatabase(":memory:");
const repository = createSqliteRepository({ database });

try {
  const eventService = createEventService(repository);
  const bookingService = createBookingService(
    repository,
    createMockPaymentGateway()
  );
  const event = await eventService.createEvent("oversell-organizer", {
    title: "Last Seat Concurrency Demo",
    city: "Lagos",
    venue: "Demo Hall",
    startsAt: "2027-12-05T17:00:00Z",
  });
  const tier = await eventService.addTier("oversell-organizer", event.id, {
    name: "Last Seat",
    priceCents: 1000,
    capacity: 1,
  });
  await eventService.publishEvent("oversell-organizer", event.id);

  const results = await Promise.allSettled(
    Array.from({ length: 50 }, (_, index) =>
      bookingService.createBooking(`attendee-${index + 1}`, {
        tierId: tier.id,
        quantity: 1,
      })
    )
  );
  const succeeded = results.filter((result) => result.status === "fulfilled");
  const soldOut = results.filter(
    (result) =>
      result.status === "rejected" && result.reason?.code === "SOLD_OUT"
  );
  const unexpected = results.find(
    (result) =>
      result.status === "rejected" && result.reason?.code !== "SOLD_OUT"
  );
  if (unexpected) throw unexpected.reason;

  const finalTier = await repository.getTier(tier.id);
  console.log(`Booking requests: ${results.length}`);
  console.log(`Bookings succeeded: ${succeeded.length}`);
  console.log(`Bookings rejected as SOLD_OUT: ${soldOut.length}`);
  console.log(`Seats recorded as sold: ${finalTier.sold}`);
} finally {
  repository.close();
}
