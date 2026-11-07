## Build 1

### Prompt 1: Build 1 prompt (domain core implementation)

- **What I asked:** Help me build the event ticketing and booking system's domain core using plain JavaScript ES modules, following the capstone requirements.
- **What came back:** Code and guidance for creating domain errors, generating unique IDs and booking references, implementing a FIFO queue using a linked list, creating events and ticket tiers, booking and cancelling tickets, looking up bookings by reference, managing the waitlist, and creating the demo and benchmark scripts.
- **What was wrong (or "nothing"):** The initial code needed to be implemented and tested step by step. During testing, I verified that failed bookings did not reduce available capacity, cancellation restored tickets, and the waitlist preserved its order. Further review of input validation and the complete requirements is still needed.

### Prompt 2: Test the demo and benchmark scripts

- **What I asked:** Help me test the event ticketing demo and compare booking lookups using `Array.find()` and `Map.get()`.
- **What came back:** The demo showed successful bookings, a rejected booking with the `SOLD_OUT` error, booking lookup by reference, cancellation, and the next person in the waitlist. The benchmark compared 500 lookups among 100,000 bookings and showed that `Map.get()` was much faster in the test run.
- **What was wrong (or "nothing"):** Nothing was wrong with the benchmark execution. It completed 500 lookups across 100,000 bookings. The measured times varied between runs, but Map.get() was much faster than Array.find() in both runs.

## Build 2

### Prompt 1: Build 2 domain, search, sorting, and tests
- **What I asked:** Implement Build 2 event lifecycle, search and filters, booking criteria, and automated tests while preserving the existing demo.
- **What came back:** Added event summaries and lifecycle helpers, Build 2 tests, and an `npm test` command.
- **What was wrong (or "nothing"):** The active checkout had an earlier event shape (`name`/`date`) and no Build 2 documentation or tests. The implementation supports both the existing demo shape and the Build 2 `title`/`city`/`venue`/`startsAt` shape. I initially forgot to add the S04's acceptance criteria before feeding the prompt to AI but I later did and prompted it again. S04's missing  criteria were represented as three tests: publishing requires tiers, published events are public, and unpublishing hides an event without deleting its tiers.

## Build 3

### Prompt 1: Build 3 architecture, state machine, and HTTP server
- **What I asked:** Add the layered architecture diagrams, booking state machine, minimal HTTP router and static server, server configuration, startup script, and tests without changing working behavior.
- **What came back:** Added the requested Build 3 modules, documentation, static entry page, and tests while keeping the existing Build 1 demo and Build 2 domain tests unchanged.
- **What was wrong (or "nothing"):** The active checkout had no HTTP server, test coverage for these features, or public directory. Added a public index page and tests for malformed JSON, API 404 responses, static traversal protection, router matching, and every booking-state transition.

## Build 4

### Prompt 1: Build 4 in-memory REST API
- **What I asked:** Add the in-memory repository, injected services, mock payment gateway, REST endpoints, API examples, and live HTTP tests while following the documented layers.
- **What came back:** Added async repository methods, event and booking services, injected API routes, payment handling, and end-to-end HTTP tests for the create-to-pay flow and cancellation.
- **What was wrong (or "nothing"):** The existing server parsed JSON but discarded the parsed body, so I updated the app to pass request data into route handlers and serialize their results while preserving the existing `/health`, static-file, and error behavior. Payment tests verify that card details are not passed to the gateway and that declined payments remain retryable.
