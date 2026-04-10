# Roadmap: Undo/Redo Reliability Milestone

**Created:** 2026-04-10
**Milestone:** Undo/Redo Reliability
**Granularity:** Fine
**Core Value:** Undo/redo must be reliable across every field type and every save scenario. History should only clear on explicit hydration or unmount, never silently during saves, retries, or transport events.

## Strategy

This is a reliability milestone inside an existing, published library (`react-hook-form-autosave` v3.3.1). The plan is deliberately test-first:

1. **Build the harness (Phase 1).** A reusable driver that mounts `useRhfAutosave` with a configurable schema and exposes programmatic change / undo / redo / hydrate / save / abort / retry hooks. Nothing else can move until this exists.
2. **Fill the matrix in parallel (Phases 2-7).** Once the harness is green, six independent axes of coverage can run concurrently: field types, multi-change flows, save lifecycle, hydration, and transport presets. These phases only depend on Phase 1 and share no files beyond the harness, so they can be executed in parallel without merge conflicts.
3. **Triage and fix (Phase 8).** The matrix will expose the intermittent history-clearing bugs. Phase 8 consumes the failing tests, performs root-cause analysis, lands targeted fixes in place, and re-runs the full suite.

No public API changes. No data-structure redesign. Fix in place.

## Phases

- [ ] **Phase 1: Undo/Redo Test Harness** - Reusable test driver that exposes programmatic change/undo/redo/save/hydrate control
- [ ] **Phase 2: Scalar Field Type Matrix** - Basic undo/redo tests across text, number, checkbox, radio, select, and date fields
- [ ] **Phase 3: Nested & Array Field Matrix** - Undo/redo tests for nested objects, primitive arrays, and field arrays
- [ ] **Phase 4: Multi-Change Flow Matrix** - N-step undo/redo walks, interleaved sequences, and redo-stack invalidation
- [ ] **Phase 5: Save Lifecycle Matrix** - Undo/redo behavior during in-flight saves, retries, aborts, and post-save state
- [ ] **Phase 6: Hydration Interaction Matrix** - Undo/redo behavior around explicit hydration, post-hydration first change, and mid-save hydration
- [ ] **Phase 7: Transport Preset Matrix** - End-to-end undo/redo with fetchTransport and serverActionTransport on success and failure paths
- [ ] **Phase 8: Bug Triage & Fix** - Root-cause every failing matrix scenario, land targeted fixes, and verify the full suite is green

## Phase Details

### Phase 1: Undo/Redo Test Harness
**Goal**: A reusable test harness exists that lets every downstream phase mount `useRhfAutosave` against a configurable schema and drive change / undo / redo / save / abort / retry / hydrate deterministically.
**Depends on**: Nothing (foundation phase)
**Requirements**: MATRIX-01
**Success Criteria** (what must be TRUE):
  1. A harness module lives in `src/testing/` (or `tests/helpers/`) and can be imported from any test file without circular deps
  2. The harness accepts a form schema (default values + field shape) and returns `{ result, act, change(path, value), undo(), redo(), hydrate(values), save(), abort(), waitForIdle() }` style controls
  3. The harness integrates a controllable mock transport so tests can script success, failure, delay, and abort responses
  4. At least one smoke test using the harness mounts the hook, performs a change, undoes it, redoes it, and asserts the value round-trips — proving the harness itself works
  5. The harness uses the existing Jest + RTL + user-event + jsdom stack and fake timers; no new dev dependencies
**Plans**: 4 plans
  - [x] 01-01-PLAN.md — Wire jest.config.cjs + tsconfig.json for tests/ root and @test-helpers alias (Wave 1)
  - [x] 01-02-PLAN.md — createControllableTransport primitive + unit test (Wave 1)
  - [x] 01-03-PLAN.md — mountAutosaveHarness factory + schemas + log capture + failure diagnostics (Wave 2)
  - [x] 01-04-PLAN.md — Three-path smoke test + phase-closing gate sweep (Wave 3)

### Phase 2: Scalar Field Type Matrix
**Goal**: Every scalar field type (text, number, checkbox, radio, select, date) has a single-change undo/redo test that proves the value round-trips.
**Depends on**: Phase 1
**Requirements**: MATRIX-02, MATRIX-03, MATRIX-04, MATRIX-05, MATRIX-06, MATRIX-07
**Success Criteria** (what must be TRUE):
  1. A test file exists per field type (or a parameterised suite) covering text, number, checkbox, radio, select, and date inputs
  2. Each test drives a single change through the harness, calls undo, and asserts the form value equals the original baseline
  3. Each test then calls redo and asserts the form value equals the post-change value
  4. All scalar-field tests are deterministic (no setTimeout-dependent flakes) and run under fake timers
  5. Failing scenarios produced by this phase (if any) are captured as-is — they become inputs to Phase 8, not hidden by skips
**Plans**: 1 plan
Plans:
- [ ] 02-01-PLAN.md — Parameterised scalar field matrix (text, number, boolean, radio, select, date) + gate sweep

### Phase 3: Nested & Array Field Matrix
**Goal**: Nested object fields, primitive arrays, and `useFieldArray` arrays-of-objects all have undo/redo tests covering value restoration including add/remove/reorder.
**Depends on**: Phase 1
**Requirements**: MATRIX-08, MATRIX-09, MATRIX-10
**Success Criteria** (what must be TRUE):
  1. A nested-object test (e.g. `user.profile.name`) changes a nested value, undoes, and asserts the deep path restores
  2. A primitive-array test exercises add, remove, and reorder against a `string[]` field and verifies undo/redo restores array identity and order
  3. A `useFieldArray` test exercises add, remove, and reorder of object items and verifies undo/redo restores the full array state
  4. Tests use the harness's change helpers and do not rely on internal private refs
  5. Any failures are surfaced cleanly with a descriptive assertion so Phase 8 can root-cause them
**Plans**: TBD
**UI hint**: yes

### Phase 4: Multi-Change Flow Matrix
**Goal**: Multi-step undo/redo flows behave deterministically — walking forward and backward across history, interleaving operations, and correctly invalidating the redo stack on new edits.
**Depends on**: Phase 1
**Requirements**: MULTI-01, MULTI-02, MULTI-03, MULTI-04
**Success Criteria** (what must be TRUE):
  1. A test performs N sequential changes on one field, undoes N times, and asserts each intermediate value is visited in reverse order, then redoes N times and asserts forward order
  2. A test performs N sequential changes across different fields, undoes N times, and asserts field-by-field walk-back, then redoes N times and asserts walk-forward
  3. A test runs an interleaved sequence (change, undo, change, undo, redo) and asserts the final state matches documented undo/redo semantics with no lost history
  4. A test makes a new change partway through a redo stack and asserts the redo stack clears (standard semantics) while undo history is preserved
  5. All flows run under fake timers and complete without polling or arbitrary sleeps
**Plans**: TBD

### Phase 5: Save Lifecycle Matrix
**Goal**: Undo/redo history survives the full save lifecycle — in-flight saves, successful completions, retries, aborts, and new edits mid-save.
**Depends on**: Phase 1
**Requirements**: SAVE-01, SAVE-02, SAVE-03, SAVE-04, SAVE-05, SAVE-06
**Success Criteria** (what must be TRUE):
  1. A test triggers a save, performs undo/redo while the transport is in flight, and asserts history is intact after the save resolves
  2. A test runs change → save success → more changes → undo, and asserts both pre-save and post-save entries are present in correct order
  3. A test simulates a transport failure that triggers a retry, performs undo/redo during retry, and asserts no history is dropped
  4. A test aborts an in-flight save and asserts undo/redo history is preserved exactly as it was at the moment of abort
  5. A test runs save failure → retry scheduled → new edit during retry and asserts history is not silently cleared at any point in that sequence
**Plans**: TBD

### Phase 6: Hydration Interaction Matrix
**Goal**: Hydration behavior is pinned down — explicit hydration clears history intentionally, first-change-after-hydration is captured, mid-save hydration does not corrupt state, and back-to-back hydrations are deterministic.
**Depends on**: Phase 1
**Requirements**: HYD-01, HYD-02, HYD-03, HYD-04
**Success Criteria** (what must be TRUE):
  1. A test calls explicit hydrate and asserts history is cleared as documented behavior (regression lock, not a bug)
  2. A test hydrates, then makes a single user change, then undoes, and asserts that first change is recorded in history (regression test for v3.3.0 fix)
  3. A test hydrates while a save is in flight and asserts history is not corrupted and in-flight user edits are not lost (regression test for v3.3.1 fix)
  4. A test runs multiple back-to-back hydrations and asserts the resulting history/state is deterministic and matches the final hydration
  5. Each hydration test documents in a code comment the exact expected behavior so future regressions are self-explaining
**Plans**: TBD

### Phase 7: Transport Preset Matrix
**Goal**: `fetchTransport` and `serverActionTransport` both preserve undo/redo history end-to-end on success and failure paths.
**Depends on**: Phase 1
**Requirements**: XPORT-01, XPORT-02, XPORT-03, XPORT-04
**Success Criteria** (what must be TRUE):
  1. A test wires the harness to `fetchTransport` (with mocked `global.fetch`) and runs change → save → undo → redo end-to-end on a 2xx success path
  2. A test wires the harness to `fetchTransport` and simulates an HTTP error and a network error, runs change → save → retry-or-abort → undo → redo, and asserts history is preserved
  3. A test wires the harness to `serverActionTransport` (with a mock server action) and runs change → save → undo → redo end-to-end on a success path
  4. A test wires the harness to `serverActionTransport` and simulates a server-action failure, runs change → save → retry-or-abort → undo → redo, and asserts history is preserved
  5. Tests are resilient to the abort-signal inconsistency documented in CONCERNS.md — failures caused by that inconsistency are captured as assertions, not masked
**Plans**: TBD

### Phase 8: Bug Triage & Fix
**Goal**: Every failing scenario produced by Phases 2-7 has a documented root cause and a targeted in-place fix; the entire test suite and build pipeline are green.
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
**Requirements**: BUG-01, BUG-02, BUG-03, BUG-04, BUG-05, BUG-06
**Success Criteria** (what must be TRUE):
  1. Every matrix test from Phases 2-7 is deterministic (zero flakes over at least 3 consecutive full runs) with a clear pass/fail state
  2. A triage document (inline in PR description or `.planning` notes) lists each failing scenario, the owning hook/file, and the root cause
  3. Each identified history-clearing bug has a targeted fix landed in place (no data-structure redesign) with a regression test that was red before the fix and green after
  4. `npm test`, `npm run lint`, `npm run type-check`, and `npm run build` all pass with zero regressions against the prior suite
  5. `CHANGELOG.md` has an entry describing the fix(es) and enumerating the newly covered scenarios, so downstream users can understand what changed
**Plans**: TBD

## Parallelization Notes

Phases 2-7 depend only on Phase 1 (the harness) and share no source files beyond the harness module. They can be executed in parallel by independent workers without merge conflict, provided each phase writes its test files into distinct test files/directories. Phase 8 serialises after all of 2-7 complete, because its input is the set of failing tests those phases produce.

Safe parallelization order:
- Sequential: Phase 1
- Parallel: Phase 2, Phase 3, Phase 4, Phase 5, Phase 6, Phase 7
- Sequential: Phase 8

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Undo/Redo Test Harness | 4/4 | Complete | 2026-04-10 |
| 2. Scalar Field Type Matrix | 0/1 | Planning | - |
| 3. Nested & Array Field Matrix | 0/0 | Not started | - |
| 4. Multi-Change Flow Matrix | 0/0 | Not started | - |
| 5. Save Lifecycle Matrix | 0/0 | Not started | - |
| 6. Hydration Interaction Matrix | 0/0 | Not started | - |
| 7. Transport Preset Matrix | 0/0 | Not started | - |
| 8. Bug Triage & Fix | 0/0 | Not started | - |

## Coverage

- v1 requirements total: 34
- Mapped to phases: 34
- Unmapped: 0
- Coverage: 100%

---
*Roadmap created: 2026-04-10*
