import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBooking,
  expireBooking,
  getEvent,
  pay,
} from "../public/js/api.js";

describe("mock booking hold expiry", () => {
  it("expires once, releases the seats, and rejects payment after the deadline", async () => {
    const eventId = "evt-abuja-music";
    const tierId = "tier-abuja-standard";
    const originalEvent = await getEvent(eventId);
    const originalTier = originalEvent.tiers.find((tier) => tier.id === tierId);

    const booking = await createBooking({ tierId, quantity: 2 });
    const heldEvent = await getEvent(eventId);
    const heldTier = heldEvent.tiers.find((tier) => tier.id === tierId);
    assert.equal(heldTier.available, originalTier.available - 2);

    const stillHeld = await expireBooking(
      booking.reference,
      Date.parse(booking.createdAt) + 1
    );
    assert.equal(stillHeld.status, "pending");

    const expired = await expireBooking(
      booking.reference,
      Date.parse(booking.holdExpiresAt)
    );
    assert.equal(expired.status, "expired");

    const releasedEvent = await getEvent(eventId);
    const releasedTier = releasedEvent.tiers.find((tier) => tier.id === tierId);
    assert.equal(releasedTier.available, originalTier.available);

    await expireBooking(booking.reference, Date.parse(booking.holdExpiresAt));
    const unchangedEvent = await getEvent(eventId);
    const unchangedTier = unchangedEvent.tiers.find((tier) => tier.id === tierId);
    assert.equal(unchangedTier.available, originalTier.available);

    const replacementBooking = await createBooking({ tierId, quantity: 2 });
    assert.equal(replacementBooking.status, "pending");
    const replacementHold = await getEvent(eventId);
    assert.equal(
      replacementHold.tiers.find((tier) => tier.id === tierId).available,
      originalTier.available - 2
    );
    const paidReplacement = await pay(replacementBooking.reference);
    assert.equal(paidReplacement.status, "paid");

    await assert.rejects(pay(booking.reference), { code: "BOOKING_EXPIRED" });
  });
});
