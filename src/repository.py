from __future__ import annotations

from collections.abc import Mapping
from typing import Protocol

from src.domain import DerivedBatch
from src.pipeline import administrative_call_summaries, booking_overview, derive_batch


class CallHeroRepository(Protocol):
    def save_batch(self, batch: DerivedBatch) -> None: ...

    def list_booking_overview(self, clinic_id: str) -> list[dict]: ...

    def list_call_summaries(self, clinic_id: str) -> list[dict]: ...

    def list_open_work_items(self, clinic_id: str) -> list[dict]: ...


class InMemoryRepository:
    def __init__(self) -> None:
        self._batches: dict[str, DerivedBatch] = {}

    def save_batch(self, batch: DerivedBatch) -> None:
        self._batches[batch.clinic.id] = batch

    def list_booking_overview(self, clinic_id: str) -> list[dict]:
        batch = self._batches.get(clinic_id)
        return booking_overview(batch) if batch else []

    def list_call_summaries(self, clinic_id: str) -> list[dict]:
        batch = self._batches.get(clinic_id)
        return administrative_call_summaries(batch) if batch else []

    def list_open_work_items(self, clinic_id: str) -> list[dict]:
        batch = self._batches.get(clinic_id)
        if not batch:
            return []
        return [
            {
                "id": item.id,
                "clinic_id": item.clinic_id,
                "contact_group_id": item.contact_group_id,
                "source_call_event_id": item.source_call_event_id,
                "related_appointment_id": item.related_appointment_id,
                "item_type": item.item_type,
                "priority": item.priority,
                "state": item.state,
                "reason_code": item.reason_code,
                "next_action": item.next_action,
            }
            for item in batch.work_items
            if item.state != "handled"
        ]

    def counts(self) -> dict[str, int]:
        batches = tuple(self._batches.values())
        return {
            "clinics": len(batches),
            "contact_groups": sum(len(batch.contact_groups) for batch in batches),
            "call_events": sum(len(batch.calls) for batch in batches),
            "appointments": sum(len(batch.appointments) for batch in batches),
            "work_items": sum(len(batch.work_items) for batch in batches),
            "data_issues": sum(len(batch.data_issues) for batch in batches),
        }


def ingest_payload(payload: Mapping, repository: CallHeroRepository) -> DerivedBatch:
    batch = derive_batch(dict(payload))
    repository.save_batch(batch)
    return batch


def load_booking_overview(
    repository: CallHeroRepository, clinic_id: str
) -> list[dict]:
    return repository.list_booking_overview(clinic_id)


def load_call_summaries(
    repository: CallHeroRepository, clinic_id: str
) -> list[dict]:
    return repository.list_call_summaries(clinic_id)
