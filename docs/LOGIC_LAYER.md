# Call Hero shared logic layer

This layer turns Jade's weekend-call export into safe, linked records for the
three-screen demo. It deliberately does not implement the second screen's
work-item derivation rules; that screen owns its workflow logic and writes to
the shared `work_items` tables.

## What is implemented

The pipeline in `src/pipeline.py`:

1. validates the clinic and call collection;
2. normalises Australian phone numbers without changing the source value;
3. groups calls only when the full normalised phone and a non-empty name agree;
4. creates separate call, contact, appointment and data-issue records;
5. checks missing Jade fields and configured weekday/business-hour boundaries;
6. produces first-screen booking rows and third-screen administrative summaries.

Raw `summary` text is neither copied into the domain records nor represented by
a database column. This prevents volunteered clinical details from reaching
the dashboard models. The administrative note is selected from the structured
`outcome`; it is not a paraphrase of the source free text.

## Database tables

| Table | Owner and purpose |
| --- | --- |
| `clinics` | Shared clinic configuration. |
| `contact_groups` | Evidence-backed grouping by full phone and non-empty name. |
| `call_events` | Safe structured outcome for one Jade source event. |
| `appointments` | Appointment or cancellation event and its validation result. |
| `work_items` | Shared interface; the second-screen owner derives and updates these. |
| `work_item_events` | Audit trail for second-screen state changes. |
| `data_issues` | Field-specific missing, invalid or conflicting data. |

All seven tables have row-level security enabled. The migration revokes table
access from `anon` and `authenticated`; server-side code uses the service-role
key. Do not place that key in Streamlit, browser code, Git or Vercel public
environment variables.

## State vocabulary

- appointment validation: `recorded`, `verify_date`, `verify_time`, `missing_data`
- work-item priority: `immediate`, `soon`, `planned`
- work-item state: `pending`, `in_progress`, `handled`, `unreachable`
- work-item types: `practitioner_review`, `billing_complaint`, `waiting_list`,
  `booking_recovery`, `verify_contact`, `rebook`, `referral`, `verify_open_slot`

A `DataIssue` is not automatically a `WorkItem`. Missing fields remain visible
for data-quality review without manufacturing a callback task.

## Apply the migration

Recommended team workflow: keep
`supabase/migrations/20260930000000_create_callhero_logic.sql` in Git and apply
the same migration in every environment.

For a hackathon project without a local Supabase CLI:

1. Open **supabase.com/dashboard** and select the Call Hero project.
2. Go to **SQL Editor → New query**. The left sidebar should show the Supabase
   logo and items including Table Editor and SQL Editor.
3. Paste the complete migration file and select **Run** once.
4. Open **Table Editor** and confirm the seven tables listed above exist.

For an already linked Supabase CLI project, run `supabase db push` from the
repository root instead. Do not edit the production schema separately after
the team adopts migrations.

## Import the supplied JSON

Keep the source export outside the public repository. In PowerShell, set the
two server-side values for the current terminal and run the importer:

```powershell
$env:SUPABASE_URL = "https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY = "YOUR_SERVER_ONLY_KEY"
python -m scripts.ingest_calls "C:\path\to\weekend-calls.json"
```

The importer prints counts only. It does not print names, phone numbers or the
source free text. Source call events, appointments and issues use conflict keys
and ignore duplicate inserts, so a re-import does not overwrite the immutable
source-derived rows. Intentional staff workflow updates belong in `work_items`
and `work_item_events`.

## Screen query contracts

The UI should depend on the `CallHeroRepository` interface, not on source JSON.

### First screen — booking overview

`repository.list_booking_overview(clinic_id)` returns:

- appointment and source call IDs;
- caller name and source phone;
- date, time, appointment type and practitioner;
- `validation_status` and specific `validation_reasons`;
- count of related work items that are not handled.

Only source events marked `booked` appear here. A booked event with missing
appointment data remains visible with `missing_data`.

### Second screen — teammate-owned workflow

`repository.list_open_work_items(clinic_id)` returns every item whose state is
not `handled`. The teammate may create the agreed work-item types and append a
`work_item_events` row on each state transition. This package does not derive,
prioritise or close those items.

### Third screen — administrative call summary

`repository.list_call_summaries(clinic_id)` returns the safe structured intent,
outcome, administrative note, recording availability and related appointment /
work-item IDs. It never returns the source `summary` or a transcript.

## Verification

Run from the repository root:

```powershell
python -m pytest -v
git diff --check
```

The test suite covers privacy filtering, contact grouping, appointment
validation, field-specific issues, migration permissions, idempotent imports
and both screen query models. Passing unit tests do not prove that a live
Supabase project has received the migration; verify Table Editor after applying
it.
