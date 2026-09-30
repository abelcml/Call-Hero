# Shared Logic Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the supplied weekend-call payload into safe, linked records that Supabase can persist and that the booking-overview and administrative-summary screens can query.

**Architecture:** Pure Python functions validate and derive records without database access. A repository boundary persists the derived batch; the Supabase implementation uses server-side credentials and migrations. Screen query functions return stable dictionaries and do not recalculate business rules.

**Tech Stack:** Python 3, pytest, PostgreSQL/Supabase, supabase-py.

**Spec:** `docs/MONDAY_MORNING_SCREEN_SPEC.md`, especially sections 3–8, 9.1, 9.3, 10 and 13.

## Global Constraints

- Do not implement the second screen's work-item derivation or interaction rules; a teammate owns them.
- Create the `work_items` and `work_item_events` schema and read contract only, so the teammate has a stable interface.
- Never persist or return raw clinical `summary` text.
- Use full normalised phone plus non-empty caller name for automatic contact grouping; otherwise leave the event ungrouped and produce a data issue when evidence conflicts.
- Preserve source values and source IDs. Do not silently repair dates, times or phone digits.
- Migrations enable RLS and grant no `anon` or `authenticated` access to clinic records.
- Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` outside Git.
- Database writes are idempotent on `(clinic_id, source_event_id)`.

## Review Focus

- The urgent clinical source summary never reaches a database row or screen model.
- Reimporting the same source event produces one `call_events` row.
- Calls with the same phone but conflicting names are not automatically grouped.
- Missing core Jade fields create field-specific data issues without automatically creating work items.
- First- and third-screen query models remain usable when no related work item or recording exists.

---

### Task 1: Pure domain transformation

**Files:**
- Create: `src/domain.py`
- Create: `src/pipeline.py`
- Create: `tests/test_pipeline.py`

**Produces:**
- `derive_batch(payload: dict) -> DerivedBatch`
- `booking_overview(batch: DerivedBatch) -> list[dict]`
- `administrative_call_summaries(batch: DerivedBatch) -> list[dict]`

**Steps:**

- [ ] Write failing tests for source validation, safe administrative notes, exact-evidence contact grouping, booking validation, core-field data issues and first/third-screen output.
- [ ] Run `python -m pytest tests/test_pipeline.py -v` and verify RED because the modules do not exist.
- [ ] Add small frozen dataclasses for `ClinicRecord`, `ContactGroupRecord`, `CallEventRecord`, `AppointmentRecord`, `DataIssueRecord` and `DerivedBatch`.
- [ ] Implement `derive_batch()` with deterministic IDs based on clinic/source identity, never summary text.
- [ ] Implement `booking_overview()` and `administrative_call_summaries()` from derived records.
- [ ] Run `python -m pytest tests/test_pipeline.py -v` and verify GREEN.
- [ ] Commit as `feat: derive safe dashboard records`.

### Task 2: Reproducible Supabase schema

**Files:**
- Create: `supabase/migrations/20260930000000_create_callhero_logic.sql`
- Create: `tests/test_migration.py`

**Produces:**
- Tables: `clinics`, `contact_groups`, `call_events`, `appointments`, `work_items`, `work_item_events`, `data_issues`.

**Steps:**

- [ ] Write failing migration-contract tests that require primary/foreign keys, idempotency constraints, work-item state checks, RLS, revoked client grants and no raw-summary column.
- [ ] Run `python -m pytest tests/test_migration.py -v` and verify RED because the migration does not exist.
- [ ] Add one lowercase PostgreSQL migration containing the seven tables, indexes, constraints, update timestamps, RLS and least-privilege grants.
- [ ] Run `python -m pytest tests/test_migration.py -v` and verify GREEN.
- [ ] Commit as `feat: add Supabase logic schema`.

### Task 3: Repository and idempotent ingestion

**Files:**
- Create: `src/repository.py`
- Create: `src/supabase_repository.py`
- Create: `scripts/ingest_calls.py`
- Create: `tests/test_repository.py`
- Modify: `requirements.txt`
- Create: `.env.example`
- Create or modify: `.gitignore`

**Produces:**
- `CallHeroRepository` protocol.
- `InMemoryRepository` used by tests and offline demos.
- `SupabaseRepository` using an injected Supabase client.
- `ingest_payload(payload, repository) -> DerivedBatch`.
- `load_booking_overview(repository, clinic_id)` and `load_call_summaries(repository, clinic_id)`.

**Steps:**

- [ ] Write failing fake-client tests for ordered table upserts, duplicate imports and screen queries.
- [ ] Run `python -m pytest tests/test_repository.py -v` and verify RED.
- [ ] Implement the repository protocol and in-memory implementation.
- [ ] Implement Supabase bulk upserts in foreign-key order without importing environment variables inside domain code.
- [ ] Add a CLI that reads a JSON path, constructs a server-side client from environment variables and prints inserted record counts only.
- [ ] Add `supabase>=2.0`, `.env.example` names only, and ignore `.env`/`.streamlit/secrets.toml`.
- [ ] Run `python -m pytest tests/test_repository.py -v` and then the full suite.
- [ ] Commit as `feat: persist dashboard records in Supabase`.

### Task 4: Documentation and integration handoff

**Files:**
- Create: `docs/LOGIC_LAYER.md`
- Modify: `README.md`

**Produces:**
- Exact setup, migration, ingestion and screen-query instructions.
- The second-screen interface boundary for the teammate.

**Steps:**

- [ ] Document table ownership, safe fields, state vocabulary and the three screen query contracts.
- [ ] Document Supabase Dashboard setup without including keys.
- [ ] Run `python -m pytest -v`, `git diff --check` and a secret-pattern scan.
- [ ] If credentials exist, apply the migration and ingest the supplied payload; otherwise report this one external blocker without claiming a live database result.
- [ ] Commit as `docs: explain shared logic layer`.
