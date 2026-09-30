from __future__ import annotations

from dataclasses import asdict
from typing import Any

from src.domain import DerivedBatch


class SupabaseRepository:
    def __init__(self, client: Any) -> None:
        self._client = client

    @staticmethod
    def _row(record: object) -> dict[str, Any]:
        row = asdict(record)
        if "validation_reasons" in row:
            row["validation_reasons"] = list(row["validation_reasons"])
        return row

    def _upsert(
        self,
        table: str,
        records: tuple,
        on_conflict: str = "id",
        ignore_duplicates: bool = False,
    ) -> None:
        if not records:
            return
        rows = [self._row(record) for record in records]
        self._client.table(table).upsert(
            rows,
            on_conflict=on_conflict,
            ignore_duplicates=ignore_duplicates,
        ).execute()

    def save_batch(self, batch: DerivedBatch) -> None:
        self._upsert("clinics", (batch.clinic,))
        self._upsert(
            "contact_groups",
            batch.contact_groups,
            on_conflict="clinic_id,identity_key",
        )
        self._upsert(
            "call_events",
            batch.calls,
            on_conflict="clinic_id,source_event_id",
            ignore_duplicates=True,
        )
        self._upsert(
            "appointments",
            batch.appointments,
            on_conflict="source_call_event_id",
            ignore_duplicates=True,
        )
        self._upsert("work_items", batch.work_items)
        self._upsert(
            "data_issues",
            batch.data_issues,
            on_conflict="source_call_event_id,issue_code,affected_field",
            ignore_duplicates=True,
        )

    def _select(self, table: str, clinic_id: str) -> list[dict[str, Any]]:
        response = (
            self._client.table(table)
            .select("*")
            .eq("clinic_id", clinic_id)
            .execute()
        )
        return list(response.data or [])

    def list_booking_overview(self, clinic_id: str) -> list[dict]:
        calls = {row["id"]: row for row in self._select("call_events", clinic_id)}
        work_items = self._select("work_items", clinic_id)
        rows = []
        for appointment in self._select("appointments", clinic_id):
            if appointment["source_status"] != "booked":
                continue
            call = calls.get(appointment["source_call_event_id"], {})
            rows.append(
                {
                    "appointment_id": appointment["id"],
                    "call_event_id": appointment["source_call_event_id"],
                    "caller_name": call.get("caller_name"),
                    "caller_number": call.get("caller_number"),
                    "date": appointment.get("appointment_date"),
                    "time": appointment.get("appointment_time"),
                    "appointment_type": appointment.get("appointment_type"),
                    "practitioner": appointment.get("practitioner"),
                    "validation_status": appointment["validation_status"],
                    "validation_reasons": appointment.get("validation_reasons", []),
                    "related_work_item_count": sum(
                        item.get("related_appointment_id") == appointment["id"]
                        and item.get("state") != "handled"
                        for item in work_items
                    ),
                }
            )
        return sorted(rows, key=lambda row: (row["date"] or "", row["time"] or ""))

    def list_call_summaries(self, clinic_id: str) -> list[dict]:
        appointments = {
            row["source_call_event_id"]: row["id"]
            for row in self._select("appointments", clinic_id)
        }
        work_items: dict[str, list[str]] = {}
        for item in self._select("work_items", clinic_id):
            call_id = item.get("source_call_event_id")
            if call_id:
                work_items.setdefault(call_id, []).append(item["id"])
        return [
            {
                "call_event_id": call["id"],
                "source_event_id": call["source_event_id"],
                "received_at": call.get("received_at"),
                "caller_name": call.get("caller_name"),
                "caller_number": call.get("caller_number"),
                "intent": call.get("intent"),
                "outcome": call.get("outcome"),
                "administrative_note": call["administrative_note"],
                "recording_available": call.get("recording_available"),
                "related_appointment_id": appointments.get(call["id"]),
                "related_work_item_ids": work_items.get(call["id"], []),
            }
            for call in self._select("call_events", clinic_id)
        ]

    def list_open_work_items(self, clinic_id: str) -> list[dict]:
        return [
            item
            for item in self._select("work_items", clinic_id)
            if item.get("state") != "handled"
        ]
