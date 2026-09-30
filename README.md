# Call Hero — Monday Morning Screen

Hackathon prototype for the **Monday Morning Screen** challenge.

## Brief

Harbourside Dental closed at 5 pm Friday. Over the weekend, **31 calls** came in and Jade answered every one. At 8:00 am Monday, the practice owner has **90 seconds** before the first patient arrives.

The product question is not "what happened on every call?" It is:

> **What does the owner need to know, and what does she need to do about it?**

## Product principle

The screen compresses 31 conversations into three layers:

1. **What happened?** — weekend summary.
2. **What needs attention now?** — prioritised action queue.
3. **What can wait?** — resolved / low-priority calls stay out of the owner's way.

The prototype separates source ingestion, safe domain records, persistence and
screen queries. The first-screen booking overview and third-screen
administrative summary share one repository contract; the second-screen owner
can add workflow rules through the shared `work_items` schema.

## Team discussion

We are also exploring a more ambitious product direction:

> **From call-level automation to system-level booking optimisation.**

Instead of treating each call independently, Jade could combine caller preferences, failed booking attempts, cancellations and current schedule availability to recommend the best next booking action.

See: [docs/BOOKING_OPTIMISATION_DIRECTION.md](docs/BOOKING_OPTIMISATION_DIRECTION.md)

This is intentionally marked as an **exploratory direction**, not a committed implementation.

## Run locally

    pip install -r requirements.txt
    streamlit run app.py

## Shared logic and Supabase

The repository now includes a privacy-filtered transformation pipeline, a
reproducible Supabase migration and an idempotent importer. Raw call `summary`
text is not persisted or returned to the screen models.

See [docs/LOGIC_LAYER.md](docs/LOGIC_LAYER.md) for the schema, setup, importer
and the exact first-/second-/third-screen query contracts.

## Current structure

    .
    ├── app.py
    ├── requirements.txt
    ├── data/
    │   └── weekend_calls.json
    ├── docs/
    │   ├── BOOKING_OPTIMISATION_DIRECTION.md
    │   ├── LOGIC_LAYER.md
    │   └── MONDAY_MORNING_SCREEN_SPEC.md
    ├── scripts/
    │   └── ingest_calls.py
    ├── supabase/migrations/
    │   └── 20260930000000_create_callhero_logic.sql
    └── src/
        ├── domain.py
        ├── pipeline.py
        ├── repository.py
        ├── supabase_repository.py
        └── prioritise.py

## Next build steps

- Replace synthetic calls with the official hackathon dataset.
- Validate the priority logic against Call Hero's actual Jade rules.
- Decide whether the screen remains action-first or becomes a booking-control-tower prototype.
- Add structured AI classification (JEV / LLM) only where rules are insufficient.
- Connect the UI to the shared repository contract.
- Polish the single-screen hierarchy after we learn the judging criteria.
