import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTransition,
  BOOKING_STATES,
  canTransition,
} from "../src/domain/bookingStateMachine.js";
import { DomainError } from "../src/domain/errors.js";

const allowedTransitions = [
  ["pending", "paid"],
  ["pending", "cancelled"],
  ["paid", "checked_in"],
  ["paid", "refunded"],
  ["paid", "cancelled"],
];

describe("booking state machine", () => {
  it("defines the booking states as data", () => {
    assert.deepEqual(BOOKING_STATES, [
      "pending",
      "paid",
      "cancelled",
      "refunded",
      "checked_in",
    ]);
  });

  for (const [from, to] of allowedTransitions) {
    it(`allows ${from} to ${to}`, () => {
      assert.equal(canTransition(from, to), true);
      assert.equal(assertTransition(from, to), true);
    });
  }

  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      if (allowedTransitions.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to)) {
        continue;
      }

      it(`rejects ${from} to ${to}`, () => {
        assert.equal(canTransition(from, to), false);
        assert.throws(
          () => assertTransition(from, to),
          (error) =>
            error instanceof DomainError && error.code === "INVALID_TRANSITION"
        );
      });
    }
  }

  it("rejects unknown states", () => {
    assert.equal(canTransition("unknown", "paid"), false);
    assert.throws(
      () => assertTransition("pending", "unknown"),
      (error) =>
        error instanceof DomainError && error.code === "INVALID_TRANSITION"
    );
  });
});
