import { createSqliteRepository } from "../src/repositories/sqlite.js";
import { createEventService } from "../src/services/eventService.js";

const repository = createSqliteRepository();

try {
  const existingEvents = await repository.listEvents();
  if (existingEvents.length > 0) {
    console.log("Database already contains events; seed skipped.");
  } else {
    const events = createEventService(repository);
    const event = await events.createEvent("seed-organizer", {
      title: "Lagos Tech Meetup",
      city: "Lagos",
      venue: "Yaba Hub",
      startsAt: "2027-12-05T17:00:00Z",
    });
    await events.addTier("seed-organizer", event.id, {
      name: "General",
      priceCents: 500000,
      capacity: 100,
    });
    await events.publishEvent("seed-organizer", event.id);
    console.log(`Seeded "${event.title}" (${event.id}).`);
  }
} catch (error) {
  console.error("Could not seed the database:", error);
  process.exitCode = 1;
} finally {
  repository.close();
}
