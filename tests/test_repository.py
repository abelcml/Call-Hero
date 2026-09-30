from __future__ import annotations

from dataclasses import replace

from src.domain import WorkItemRecord
from src.pipeline import derive_batch
from src.repository import (
    InMemoryRepository,
    ingest_payload,
    load_booking_overview,
    load_call_summaries,
)
from src.supabase_repository import SupabaseRepository


def _payload() -> dict:
    return {
        "clinic": {
            "name": "Harbourside Dental",
            "suburb": "Balmain",
            "state": "NSW",
            "business_hours": "Mon-Fri 8:00-17:00, closed weekends",
            "recording_enabled": True,
        },
        "period": {"label": "Weekend"},
        "calls": [
            {
                "id": "c001",
                "started_at": "2026-11-14T17:04:22+11:00",
                "duration_seconds": 94,
                "caller_number": "+61412887301",
                "caller_name": "John Smith",
                "outcome": "booked",
                "intent": "new_patient",
                "summary": "Sensitive source content.",
                "appointment": {
                    "date": "2026-11-19",
                    "time": "14:30",
                    "type": "Check-up and clean",
                    "practitioner": "Dr Rebecca Foster",
                },
                "recording_available": True,
            }
        ],
    }


def test_in_memory_ingestion_is_idempotent_and_queries_are_stable() -> None:
    repository = InMemoryRepository()

    first = ingest_payload(_payload(), repository)
    second = ingest_payload(_payload(), repository)

    assert first == second
    assert repository.counts() == {
        "clinics": 1,
        "contact_groups": 1,
        "call_events": 1,
        "appointments": 1,
        "work_items": 0,
        "data_issues": 0,
    }
    assert load_booking_overview(repository, first.clinic.id)[0]["caller_name"] == "John Smith"
    summary = load_call_summaries(repository, first.clinic.id)[0]
    assert summary["administrative_note"] == "Jade recorded a booking."
    assert "Sensitive source content" not in repr(summary)


def test_first_screen_counts_only_open_related_work_items() -> None:
    batch = derive_batch(_payload())
    appointment = batch.appointments[0]
    open_item = WorkItemRecord(
        id="work-open",
        clinic_id=batch.clinic.id,
        contact_group_id=batch.calls[0].contact_group_id,
        source_call_event_id=batch.calls[0].id,
        related_appointment_id=appointment.id,
        item_type="verify_contact",
        priority="soon",
        state="pending",
        reason_code="phone_check",
        next_action="Verify contact details",
    )
    handled_item = replace(open_item, id="work-handled", state="handled")
    repository = InMemoryRepository()
    repository.save_batch(replace(batch, work_items=(open_item, handled_item)))

    assert repository.list_booking_overview(batch.clinic.id)[0]["related_work_item_count"] == 1

    ingest_payload(_payload(), repository)
    assert repository.list_booking_overview(batch.clinic.id)[0]["related_work_item_count"] == 1


class _Response:
    data: list[dict] = []


class _Table:
    def __init__(
        self,
        name: str,
        calls: list[tuple[str, list[dict], str | None, bool]],
    ) -> None:
        self.name = name
        self.calls = calls

    def upsert(
        self,
        rows: list[dict],
        on_conflict: str | None = None,
        ignore_duplicates: bool = False,
    ) -> "_Table":
        self.calls.append((self.name, rows, on_conflict, ignore_duplicates))
        return self

    def execute(self) -> _Response:
        return _Response()


class _Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, list[dict], str | None, bool]] = []

    def table(self, name: str) -> _Table:
        return _Table(name, self.calls)


def test_supabase_upserts_in_foreign_key_order_without_source_summary() -> None:
    batch = derive_batch(_payload())
    client = _Client()

    SupabaseRepository(client).save_batch(batch)

    assert [name for name, _, _, _ in client.calls] == [
        "clinics",
        "contact_groups",
        "call_events",
        "appointments",
    ]
    call_rows = next(
        rows for name, rows, _, _ in client.calls if name == "call_events"
    )
    assert "summary" not in call_rows[0]
    assert "Sensitive source content" not in repr(client.calls)
    conflicts = {name: conflict for name, _, conflict, _ in client.calls}
    assert conflicts["call_events"] == "clinic_id,source_event_id"
    immutable = {name: ignore for name, _, _, ignore in client.calls}
    assert immutable["call_events"] is True
