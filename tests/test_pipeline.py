from __future__ import annotations

from src.pipeline import administrative_call_summaries, booking_overview, derive_batch


def _payload(*calls: dict) -> dict:
    return {
        "clinic": {
            "name": "Harbourside Dental",
            "suburb": "Balmain",
            "state": "NSW",
            "business_hours": "Mon-Fri 8:00-17:00, closed weekends",
            "recording_enabled": True,
        },
        "period": {"label": "Weekend"},
        "calls": list(calls),
    }


def _call(call_id: str, **overrides: object) -> dict:
    call = {
        "id": call_id,
        "started_at": "2026-11-16T10:18:42+11:00",
        "duration_seconds": 95,
        "caller_number": "+61417550284",
        "caller_name": "Sophie Wright",
        "outcome": "booked",
        "intent": "new_patient",
        "summary": "Private clinical detail that must never be retained.",
        "appointment": {
            "date": "2026-11-26",
            "time": "13:00",
            "type": "New patient exam",
            "practitioner": "Dr Mark Bennett",
        },
        "recording_available": True,
        "sentiment": "positive",
    }
    call.update(overrides)
    return call


def test_derive_batch_excludes_raw_summary_and_builds_screen_models() -> None:
    batch = derive_batch(_payload(_call("c001")))

    assert "Private clinical detail" not in repr(batch)
    assert batch.calls[0].source_event_id == "c001"
    assert batch.calls[0].booking_result == "booked"

    bookings = booking_overview(batch)
    assert bookings == [
        {
            "appointment_id": batch.appointments[0].id,
            "call_event_id": batch.calls[0].id,
            "caller_name": "Sophie Wright",
            "caller_number": "+61417550284",
            "date": "2026-11-26",
            "time": "13:00",
            "appointment_type": "New patient exam",
            "practitioner": "Dr Mark Bennett",
            "validation_status": "recorded",
            "validation_reasons": [],
            "related_work_item_count": 0,
        }
    ]

    summaries = administrative_call_summaries(batch)
    assert summaries[0]["administrative_note"] == "Jade recorded a booking."
    assert "summary" not in summaries[0]


def test_contact_grouping_requires_same_full_phone_and_non_empty_name() -> None:
    batch = derive_batch(
        _payload(
            _call("c001"),
            _call("c002", caller_number="0417 550 284"),
            _call("c003", caller_name="Different Person"),
            _call("c004", caller_name=None),
        )
    )

    assert batch.calls[0].contact_group_id == batch.calls[1].contact_group_id
    assert batch.calls[2].contact_group_id is None
    assert batch.calls[3].contact_group_id is None
    assert any(issue.issue_code == "identity_conflict" for issue in batch.data_issues)
    assert any(issue.issue_code == "missing_caller_name" for issue in batch.data_issues)


def test_invalid_callback_flag_and_weekend_booking_create_specific_issues() -> None:
    call = _call(
        "c009",
        outcome="failed_callback_number",
        appointment={
            "date": "2026-11-22",
            "time": "09:30",
            "type": "Check-up",
            "practitioner": "Dr Mark Bennett",
        },
        flagged="bad_data",
    )
    batch = derive_batch(_payload(call))

    issue_codes = {issue.issue_code for issue in batch.data_issues}
    assert "callback_number_invalid" in issue_codes
    assert "appointment_closed_day" in issue_codes
    assert batch.appointments[0].validation_status == "verify_date"


def test_missing_core_fields_are_issues_not_work_items() -> None:
    batch = derive_batch(
        _payload(
            _call(
                "c004",
                caller_name=None,
                caller_number=None,
                intent=None,
                outcome=None,
                appointment=None,
            )
        )
    )

    affected = {(issue.issue_code, issue.affected_field) for issue in batch.data_issues}
    assert ("missing_caller_name", "caller_name") in affected
    assert ("missing_caller_number", "caller_number") in affected
    assert ("missing_intent", "intent") in affected
    assert ("missing_booking_result", "outcome") in affected
    assert batch.work_items == ()


def test_booked_call_with_missing_time_remains_visible_for_verification() -> None:
    batch = derive_batch(
        _payload(
            _call(
                "c010",
                appointment={
                    "date": "2026-11-20",
                    "time": None,
                    "type": "Check-up",
                    "practitioner": "Dr Rebecca Foster",
                },
            )
        )
    )

    rows = booking_overview(batch)
    assert len(rows) == 1
    assert rows[0]["time"] is None
    assert rows[0]["validation_status"] == "missing_data"
    assert "appointment_time" in rows[0]["validation_reasons"]


def test_invalid_payload_is_rejected() -> None:
    try:
        derive_batch({"clinic": {}, "calls": "not-a-list"})
    except ValueError as error:
        assert "calls" in str(error)
    else:
        raise AssertionError("derive_batch should reject a non-list calls value")
