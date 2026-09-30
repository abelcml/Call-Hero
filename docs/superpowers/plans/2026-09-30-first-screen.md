# Booking-first Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Streamlit screen as a dark, booking-first Monday morning dashboard using the supplied weekend call payload, with explicit booking verification and one safe priority action.

**Architecture:** Keep source ingestion and view-model rules in `src/first_screen.py`; keep Streamlit layout and session-only interaction in `app.py`. The UI consumes booking rows, priority items and data issues without recalculating business rules.

**Tech Stack:** Python 3, Streamlit 1.39+, pytest, Streamlit AppTest, JSON fixture data.

**Spec:** `docs/superpowers/specs/2026-09-30-monday-morning-screen-design.md` and `docs/MONDAY_MORNING_SCREEN_SPEC.md`

## Global Constraints

- The booked-appointments list is the largest area on the first screen.
- Show a booked person's name, masked contact field, appointment time, practitioner and verification status.
- Treat `outcome = booked` as a source record, not proof of live-calendar confirmation.
- Do not display clinical free text from `summary` anywhere on the first screen.
- Preserve contradictory source dates and mark them for staff verification.
- Show only source-marked urgency; do not infer diagnosis or urgency from free text.
- Prototype work-item state lasts only for the Streamlit session and must visibly change when the user acts.
- Do not modify or delete the existing synthetic `data/weekend_calls.json`.
- Do not touch the untracked `tmp/` directory.

## Design tokens

- `night`: `#07111F`, the page base.
- `ledger`: `#0E1B2A`, the booking board.
- `porcelain`: `#F3F7F8`, primary copy.
- `aqua`: `#5FD1C8`, recorded bookings and calm confirmation.
- `amber`: `#F0B35A`, date or time verification.
- `violet`: `#9C8CF8`, staff action.
- `coral`: `#FF6B6B`, source-marked urgent review.
- Typography: Helvetica Neue / Segoe UI fallback. Use tabular numerals for appointment times and phone fields.
- Layout: one horizontal morning briefing. The appointment ledger occupies roughly two thirds; review items occupy one third. On narrow screens the top action comes first, followed by appointments and review items.
- Distinctive element: appointment time is the visual anchor of each row, like a clinical day sheet. Avoid a grid of identical SaaS cards.

The first pass originally risked becoming another dark dashboard with coloured cards. The revision removes decorative metric cards and gradients. The screen is instead organised as an operational ledger with one coral action strip and a dense, calm appointment sheet.

## Review Focus

- A booked record missing an appointment object remains visible and says exactly what is missing.
- Saturday, Sunday and 17:00 boundary bookings are not presented as verified.
- A source-marked urgent call never exposes its clinical summary.
- Missing or malformed phone numbers render as `Contact unavailable`, with no active call action.
- An empty or malformed payload produces a visible data-status message rather than claiming that Jade handled everything.

---

### Task 1: Source adapter and booking validation

**Files:**
- Create: `data/weekend_calls_official.json`
- Create: `src/first_screen.py`
- Create: `tests/test_first_screen.py`
- Modify: `requirements.txt`

**Interfaces:**
- Consumes: the supplied `{clinic, period, calls}` JSON structure.
- Produces: `load_source(path: Path) -> dict`, `build_booking_rows(payload: dict) -> list[dict]`, `mask_phone(number: str | None) -> str`.

- [ ] **Step 1: Add pytest and write failing adapter tests**

Add `pytest>=8.3` to `requirements.txt`. Create `tests/test_first_screen.py` with focused fixtures and these tests:

```python
from datetime import date

from src.first_screen import build_booking_rows, mask_phone


def payload_with(*calls):
    return {
        "clinic": {
            "name": "Harbourside Dental",
            "business_hours": "Mon-Fri 8:00-17:00, closed weekends",
        },
        "period": {"to": "2026-11-17T08:00:00+11:00"},
        "calls": list(calls),
    }


def booked_call(call_id="c1", appointment=None, number="+61412887301"):
    return {
        "id": call_id,
        "caller_name": "John Smith",
        "caller_number": number,
        "outcome": "booked",
        "appointment": appointment,
    }


def test_mask_phone_keeps_country_code_and_last_three_digits():
    assert mask_phone("+61412887301") == "+61 ••• •• 301"


def test_mask_phone_reports_missing_contact():
    assert mask_phone(None) == "Contact unavailable"


def test_booking_row_keeps_complete_weekday_booking():
    payload = payload_with(
        booked_call(
            appointment={
                "date": "2026-11-19",
                "time": "14:30",
                "type": "Check-up and clean",
                "practitioner": "Dr Rebecca Foster",
            }
        )
    )

    rows = build_booking_rows(payload)

    assert rows[0]["booking_status"] == "recorded"
    assert rows[0]["status_reason"] == "Booking recorded by Jade"
    assert rows[0]["display_phone"] == "+61 ••• •• 301"


def test_weekend_booking_requires_date_verification():
    payload = payload_with(
        booked_call(
            appointment={
                "date": "2026-11-21",
                "time": "16:00",
                "type": "Check-up",
                "practitioner": "Dr Rebecca Foster",
            }
        )
    )

    row = build_booking_rows(payload)[0]

    assert date.fromisoformat(row["appointment_date"]).weekday() == 5
    assert row["booking_status"] == "verify_date"
    assert row["status_reason"] == "Date falls outside Monday-Friday opening days"


def test_closing_time_booking_requires_time_verification():
    payload = payload_with(
        booked_call(
            appointment={
                "date": "2026-12-02",
                "time": "17:00",
                "type": "Check-up",
                "practitioner": "Dr Mark Bennett",
            }
        )
    )

    row = build_booking_rows(payload)[0]

    assert row["booking_status"] == "verify_time"
    assert row["status_reason"] == "Starts at clinic closing time; duration not supplied"


def test_missing_appointment_stays_visible_for_verification():
    row = build_booking_rows(payload_with(booked_call(appointment=None)))[0]

    assert row["booking_status"] == "missing_data"
    assert row["status_reason"] == "Appointment details missing"
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `python -m pytest tests/test_first_screen.py -v`

Expected: collection fails because `src.first_screen` does not exist.

- [ ] **Step 3: Add the official source payload**

Create `data/weekend_calls_official.json` from the JSON supplied in the conversation. Preserve the source fields exactly. Do not derive or append priority fields inside the data file. This file is the hackathon fixture, not a claim of live clinic data.

- [ ] **Step 4: Implement minimal adapter functions**

Create `src/first_screen.py`:

```python
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any


def load_source(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as source_file:
        payload = json.load(source_file)

    if not isinstance(payload, dict) or not isinstance(payload.get("calls"), list):
        raise ValueError("Expected clinic payload with a calls list")
    return payload


def mask_phone(number: str | None) -> str:
    if not number or len(number) < 6:
        return "Contact unavailable"
    prefix = "+61" if number.startswith("+61") else number[:3]
    return f"{prefix} ••• •• {number[-3:]}"


def booking_validation(appointment: dict[str, Any] | None) -> tuple[str, str]:
    if not appointment:
        return "missing_data", "Appointment details missing"
    if not appointment.get("date") or not appointment.get("time"):
        return "missing_data", "Appointment date or time missing"

    appointment_day = date.fromisoformat(appointment["date"])
    if appointment_day.weekday() >= 5:
        return "verify_date", "Date falls outside Monday-Friday opening days"
    if appointment["time"] >= "17:00":
        return "verify_time", "Starts at clinic closing time; duration not supplied"
    return "recorded", "Booking recorded by Jade"


def build_booking_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    rows = []
    for call in payload.get("calls", []):
        if call.get("outcome") != "booked":
            continue

        appointment = call.get("appointment") or {}
        booking_status, status_reason = booking_validation(call.get("appointment"))
        rows.append(
            {
                "source_id": call.get("id"),
                "caller_name": call.get("caller_name") or "Name not provided",
                "display_phone": mask_phone(call.get("caller_number")),
                "appointment_date": appointment.get("date"),
                "appointment_time": appointment.get("time"),
                "appointment_type": appointment.get("type") or "Type not provided",
                "practitioner": appointment.get("practitioner") or "Practitioner not provided",
                "booking_status": booking_status,
                "status_reason": status_reason,
            }
        )

    return sorted(
        rows,
        key=lambda row: (row["appointment_date"] or "9999-12-31", row["appointment_time"] or "99:99"),
    )
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `python -m pytest tests/test_first_screen.py -v`

Expected: all adapter and booking-validation tests pass.

- [ ] **Step 6: Add official-payload regression assertions**

Append:

```python
from pathlib import Path

from src.first_screen import load_source


def test_official_payload_produces_expected_booking_review_counts():
    payload = load_source(Path("data/weekend_calls_official.json"))
    rows = build_booking_rows(payload)

    assert len(rows) == 12
    assert sum(row["booking_status"] == "verify_date" for row in rows) == 3
    assert sum(row["booking_status"] == "verify_time" for row in rows) == 1
```

Run: `python -m pytest tests/test_first_screen.py -v`

Expected: 12 booking rows, 3 date reviews and 1 time review pass.

- [ ] **Step 7: Commit Task 1**

```powershell
git add -- requirements.txt data/weekend_calls_official.json src/first_screen.py tests/test_first_screen.py
git commit -m "feat: prepare first-screen booking data"
```

---

### Task 2: Safe priority item and mutable prototype state

**Files:**
- Modify: `src/first_screen.py`
- Modify: `tests/test_first_screen.py`

**Interfaces:**
- Consumes: the validated source payload and `work_item_states: dict[str, str]`.
- Produces: `build_priority_items(payload, work_item_states=None) -> list[dict]`, `build_first_screen(payload, work_item_states=None) -> dict`.

- [ ] **Step 1: Write failing priority and privacy tests**

Append:

```python
from src.first_screen import build_first_screen, build_priority_items


def test_priority_item_uses_neutral_copy_not_clinical_summary():
    payload = payload_with(
        {
            "id": "c019",
            "caller_name": "Peter Young",
            "caller_number": "+61452008914",
            "outcome": "urgent_flagged",
            "intent": "urgent",
            "summary": "Clinical free text must not be displayed",
            "flagged": "urgent",
        }
    )

    item = build_priority_items(payload)[0]

    assert item["reason"] == "Source marked urgent; practitioner review required"
    assert "Clinical free text" not in repr(item)


def test_handled_priority_item_leaves_pending_count():
    payload = payload_with(
        {
            "id": "c019",
            "caller_name": "Peter Young",
            "caller_number": "+61452008914",
            "outcome": "urgent_flagged",
            "intent": "urgent",
            "summary": "Do not expose",
            "flagged": "urgent",
        }
    )

    view = build_first_screen(payload, {"urgent-c019": "handled"})

    assert view["first_action"] is None
    assert view["pending_work_count"] == 0


def test_first_screen_never_copies_call_summary():
    payload = payload_with(
        booked_call(
            appointment={
                "date": "2026-11-19",
                "time": "14:30",
                "type": "Check-up",
                "practitioner": "Dr Rebecca Foster",
            }
        )
    )
    payload["calls"][0]["summary"] = "Private clinical text"

    view = build_first_screen(payload)

    assert "Private clinical text" not in repr(view)
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python -m pytest tests/test_first_screen.py -v`

Expected: import fails because the priority and screen builders do not exist.

- [ ] **Step 3: Implement priority and view-model builders**

Append to `src/first_screen.py`:

```python
def build_priority_items(
    payload: dict[str, Any],
    work_item_states: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    states = work_item_states or {}
    items = []
    for call in payload.get("calls", []):
        is_urgent = call.get("outcome") == "urgent_flagged" or call.get("flagged") == "urgent"
        if not is_urgent:
            continue

        item_id = f"urgent-{call.get('id')}"
        state = states.get(item_id, "pending")
        if state == "handled":
            continue
        items.append(
            {
                "item_id": item_id,
                "source_id": call.get("id"),
                "caller_name": call.get("caller_name") or "Name not provided",
                "display_phone": mask_phone(call.get("caller_number")),
                "reason": "Source marked urgent; practitioner review required",
                "recommended_action": "Start practitioner review",
                "state": state,
            }
        )
    return items


def build_first_screen(
    payload: dict[str, Any],
    work_item_states: dict[str, str] | None = None,
) -> dict[str, Any]:
    booking_rows = build_booking_rows(payload)
    priority_items = build_priority_items(payload, work_item_states)
    data_issues = [row for row in booking_rows if row["booking_status"] != "recorded"]
    return {
        "clinic_name": payload.get("clinic", {}).get("name", "Clinic name unavailable"),
        "call_count": len(payload.get("calls", [])),
        "booking_rows": booking_rows,
        "booking_count": len(booking_rows),
        "priority_items": priority_items,
        "first_action": priority_items[0] if priority_items else None,
        "pending_work_count": len(priority_items),
        "data_issues": data_issues,
    }
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `python -m pytest tests/test_first_screen.py -v`

Expected: all view-model and privacy tests pass.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/first_screen.py tests/test_first_screen.py
git commit -m "feat: build safe first-screen view model"
```

---

### Task 3: Render and verify the dark booking ledger

**Files:**
- Modify: `app.py`
- Create: `tests/test_app.py`

**Interfaces:**
- Consumes: `load_source()` and `build_first_screen()` from Task 2.
- Produces: one default Streamlit screen with header, top action, booking ledger, review panel and session-state actions.

- [ ] **Step 1: Write a failing Streamlit smoke test**

Create `tests/test_app.py`:

```python
from streamlit.testing.v1 import AppTest


def test_first_screen_renders_booking_led_dashboard():
    app = AppTest.from_file("app.py").run()

    assert not app.exception
    assert app.title[0].value == "Monday, 8:00 am"
    assert any("12 bookings recorded" in item.value for item in app.markdown)
    assert any("Booked appointments" in item.value for item in app.markdown)
    assert any("Needs review" in item.value for item in app.markdown)


def test_start_review_changes_the_prototype_state():
    app = AppTest.from_file("app.py").run()
    review_button = next(button for button in app.button if button.label == "Start review")

    app = review_button.click().run()

    assert any("Review in progress" in item.value for item in app.markdown)
```

- [ ] **Step 2: Run the app tests and verify RED**

Run: `python -m pytest tests/test_app.py -v`

Expected: assertions fail because the existing app renders the old action queue.

- [ ] **Step 3: Replace only the first-screen layout in `app.py`**

Use `data/weekend_calls_official.json`, initialise `st.session_state.work_item_states`, and call `build_first_screen()`. Add one CSS block using the approved palette. Render:

1. title and two-line morning context;
2. one coral action strip with `Start review` or `Mark handled`;
3. a two-column body, booking ledger on the left and review issues on the right;
4. booking-row expanders containing only administrative fields and the source ID;
5. a quiet footer stating that work-item state is stored only in this demo session.

Do not render `call["summary"]`. Do not add charts, gradients, external fonts, telephony or database calls.

The state transitions are:

```python
pending -> in_progress -> handled
```

Use the button labels `Start review`, `Mark handled` and `Reopen`. A click updates `st.session_state.work_item_states[item_id]`, rebuilds the view and calls `st.rerun()`.

- [ ] **Step 4: Run app tests and verify GREEN**

Run: `python -m pytest tests/test_app.py -v`

Expected: the first screen renders without Streamlit exceptions and the review state changes.

- [ ] **Step 5: Run the complete suite**

Run: `python -m pytest -v`

Expected: all tests pass with no collection errors.

- [ ] **Step 6: Launch the screen for visual review**

Run: `python -m streamlit run app.py --server.headless true`

Expected: Streamlit reports a local URL and the page loads. Capture the screen, inspect desktop and narrow layouts, and fix only visible hierarchy, contrast, overflow or privacy problems. Re-run `python -m pytest -v` after any fix.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- app.py tests/test_app.py
git commit -m "feat: build booking-first Monday screen"
```

---

### Task 4: Documentation and final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the finished first screen.
- Produces: accurate local run and prototype-boundary documentation.

- [ ] **Step 1: Update README scope**

Document that the default screen is booking-first, uses the supplied hackathon fixture, masks phone numbers, flags source conflicts and stores action state only in the current session. Remove the stale statement that `data/weekend_calls.json` is the only input. Do not claim live calendar, telephony or database integration.

- [ ] **Step 2: Run verification**

Run:

```powershell
python -m pytest -v
git diff --check
```

Expected: all tests pass and `git diff --check` prints no errors.

- [ ] **Step 3: Commit documentation**

```powershell
git add -- README.md
git commit -m "docs: explain booking-first prototype"
```

- [ ] **Step 4: Review changed scope**

Run: `git diff --stat origin/main...HEAD` and `git status --short`.

Expected: only the plan, first-screen implementation, official fixture, tests and README are tracked changes; `tmp/` remains untracked and untouched.
