from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, time
from typing import Any
from uuid import NAMESPACE_URL, uuid5

from src.domain import (
    AppointmentRecord,
    CallEventRecord,
    ClinicRecord,
    ContactGroupRecord,
    DataIssueRecord,
    DerivedBatch,
)


ADMINISTRATIVE_NOTES = {
    "booked": "Jade recorded a booking.",
    "cancelled": "Jade recorded a cancellation.",
    "question_answered": "Jade answered an administrative clinic question.",
    "message_taken": "Jade recorded a message for staff follow-up.",
    "no_availability": "No suitable appointment was recorded.",
    "failed_callback_number": "Callback details require verification.",
    "urgent_flagged": "Practitioner review requested.",
    "hung_up": "Call ended before the administrative request was captured.",
    "wrong_number": "Wrong number.",
}


def _stable_id(kind: str, *parts: object) -> str:
    value = ":".join("" if part is None else str(part) for part in parts)
    return str(uuid5(NAMESPACE_URL, f"callhero:{kind}:{value}"))


def _normalise_phone(value: object) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return None
    digits = re.sub(r"\D", "", value)
    if digits.startswith("61") and len(digits) == 11:
        digits = "0" + digits[2:]
    if len(digits) != 10 or not digits.startswith("0"):
        return None
    return digits


def _booking_result(outcome: object) -> str | None:
    if not isinstance(outcome, str) or not outcome:
        return None
    if outcome == "booked":
        return "booked"
    if outcome == "cancelled":
        return "cancelled"
    return "not_booked"


def _validate_appointment(appointment: dict[str, Any]) -> tuple[str, tuple[str, ...]]:
    missing = tuple(
        field
        for field in ("date", "time", "type", "practitioner")
        if not appointment.get(field)
    )
    if missing:
        return "missing_data", tuple(f"appointment_{field}" for field in missing)

    try:
        appointment_date = date.fromisoformat(str(appointment["date"]))
    except ValueError:
        return "verify_date", ("appointment_date_format",)
    if appointment_date.weekday() >= 5:
        return "verify_date", ("appointment_closed_day",)

    try:
        appointment_time = time.fromisoformat(str(appointment["time"]))
    except ValueError:
        return "verify_time", ("appointment_time_format",)
    if appointment_time < time(8, 0) or appointment_time >= time(17, 0):
        return "verify_time", ("appointment_outside_hours",)
    return "recorded", ()


def derive_batch(payload: dict[str, Any]) -> DerivedBatch:
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    clinic_source = payload.get("clinic")
    calls_source = payload.get("calls")
    if not isinstance(calls_source, list):
        raise ValueError("calls must be a list")
    if not isinstance(clinic_source, dict) or not clinic_source.get("name"):
        raise ValueError("clinic.name is required")

    clinic_id = _stable_id(
        "clinic",
        clinic_source["name"],
        clinic_source.get("suburb"),
        clinic_source.get("state"),
    )
    clinic = ClinicRecord(
        id=clinic_id,
        name=str(clinic_source["name"]),
        suburb=clinic_source.get("suburb"),
        state=clinic_source.get("state"),
        business_hours=clinic_source.get("business_hours"),
        recording_enabled=clinic_source.get("recording_enabled"),
    )

    phone_names: dict[str, set[str]] = defaultdict(set)
    prepared: list[tuple[dict[str, Any], str, str | None, str | None]] = []
    for index, source in enumerate(calls_source):
        if not isinstance(source, dict):
            raise ValueError(f"calls[{index}] must be an object")
        source_id = str(source.get("id") or f"internal-row-{index + 1}")
        phone = _normalise_phone(source.get("caller_number"))
        name = source.get("caller_name")
        clean_name = name.strip() if isinstance(name, str) and name.strip() else None
        if phone and clean_name:
            phone_names[phone].add(clean_name.casefold())
        prepared.append((source, source_id, phone, clean_name))

    groups: dict[str, ContactGroupRecord] = {}
    call_records: list[CallEventRecord] = []
    appointment_records: list[AppointmentRecord] = []
    issues: list[DataIssueRecord] = []

    def add_issue(
        call_event_id: str,
        issue_code: str,
        affected_field: str,
        severity: str = "important",
    ) -> None:
        issues.append(
            DataIssueRecord(
                id=_stable_id("issue", call_event_id, issue_code, affected_field),
                clinic_id=clinic_id,
                source_call_event_id=call_event_id,
                issue_code=issue_code,
                affected_field=affected_field,
                severity=severity,
            )
        )

    for source, source_id, phone, clean_name in prepared:
        call_id = _stable_id("call", clinic_id, source_id)
        contact_group_id = None
        if phone and clean_name and len(phone_names[phone]) == 1:
            identity_key = f"{phone}:{clean_name.casefold()}"
            contact_group_id = _stable_id("contact", clinic_id, identity_key)
            groups.setdefault(
                identity_key,
                ContactGroupRecord(
                    id=contact_group_id,
                    clinic_id=clinic_id,
                    identity_key=identity_key,
                    caller_name=clean_name,
                    normalized_phone=phone,
                ),
            )
        elif phone and clean_name and len(phone_names[phone]) > 1:
            add_issue(call_id, "identity_conflict", "caller_identity")

        if clean_name is None:
            add_issue(call_id, "missing_caller_name", "caller_name", "minor")
        raw_number = source.get("caller_number")
        if not raw_number:
            add_issue(call_id, "missing_caller_number", "caller_number")
        elif phone is None:
            add_issue(call_id, "caller_number_invalid", "caller_number")
        if not source.get("intent"):
            add_issue(call_id, "missing_intent", "intent")
        if _booking_result(source.get("outcome")) is None:
            add_issue(call_id, "missing_booking_result", "outcome")
        if source.get("flagged") == "bad_data" or source.get("outcome") == "failed_callback_number":
            add_issue(call_id, "callback_number_invalid", "callback_number")

        call_record = CallEventRecord(
            id=call_id,
            clinic_id=clinic_id,
            source_event_id=source_id,
            contact_group_id=contact_group_id,
            received_at=source.get("started_at"),
            duration_seconds=source.get("duration_seconds"),
            caller_name=clean_name,
            caller_number=source.get("caller_number"),
            normalized_phone=phone,
            intent=source.get("intent"),
            outcome=source.get("outcome"),
            booking_result=_booking_result(source.get("outcome")),
            recording_available=source.get("recording_available"),
            flagged=source.get("flagged"),
            repeat_caller=source.get("repeat_caller"),
            administrative_note=ADMINISTRATIVE_NOTES.get(
                source.get("outcome"), "Administrative content not provided."
            ),
        )
        call_records.append(call_record)

        appointment_source = source.get("appointment")
        if isinstance(appointment_source, dict):
            status, reasons = _validate_appointment(appointment_source)
            appointment_id = _stable_id("appointment", call_id)
            appointment_records.append(
                AppointmentRecord(
                    id=appointment_id,
                    clinic_id=clinic_id,
                    source_call_event_id=call_id,
                    source_status=str(source.get("outcome") or "unknown"),
                    appointment_date=appointment_source.get("date"),
                    appointment_time=appointment_source.get("time"),
                    appointment_type=appointment_source.get("type"),
                    practitioner=appointment_source.get("practitioner"),
                    source_action=appointment_source.get("action"),
                    validation_status=status,
                    validation_reasons=reasons,
                )
            )
            for reason in reasons:
                if reason in {"appointment_closed_day", "appointment_date_format"}:
                    add_issue(call_id, reason, "appointment.date")
                elif reason in {"appointment_outside_hours", "appointment_time_format"}:
                    add_issue(call_id, reason, "appointment.time")
                elif reason.startswith("appointment_"):
                    add_issue(call_id, f"missing_{reason}", reason)

    return DerivedBatch(
        clinic=clinic,
        contact_groups=tuple(groups.values()),
        calls=tuple(call_records),
        appointments=tuple(appointment_records),
        work_items=(),
        data_issues=tuple(issues),
        source_period=dict(payload.get("period") or {}),
    )


def booking_overview(batch: DerivedBatch) -> list[dict[str, Any]]:
    calls = {call.id: call for call in batch.calls}
    rows = []
    for appointment in batch.appointments:
        if appointment.source_status != "booked":
            continue
        call = calls[appointment.source_call_event_id]
        related_count = sum(
            item.related_appointment_id == appointment.id and item.state != "handled"
            for item in batch.work_items
        )
        rows.append(
            {
                "appointment_id": appointment.id,
                "call_event_id": call.id,
                "caller_name": call.caller_name,
                "caller_number": call.caller_number,
                "date": appointment.appointment_date,
                "time": appointment.appointment_time,
                "appointment_type": appointment.appointment_type,
                "practitioner": appointment.practitioner,
                "validation_status": appointment.validation_status,
                "validation_reasons": list(appointment.validation_reasons),
                "related_work_item_count": related_count,
            }
        )
    return sorted(rows, key=lambda row: (row["date"] or "", row["time"] or ""))


def administrative_call_summaries(batch: DerivedBatch) -> list[dict[str, Any]]:
    appointment_by_call = {
        appointment.source_call_event_id: appointment.id
        for appointment in batch.appointments
    }
    work_items_by_call: dict[str, list[str]] = defaultdict(list)
    for item in batch.work_items:
        if item.source_call_event_id:
            work_items_by_call[item.source_call_event_id].append(item.id)

    return [
        {
            "call_event_id": call.id,
            "source_event_id": call.source_event_id,
            "received_at": call.received_at,
            "caller_name": call.caller_name,
            "caller_number": call.caller_number,
            "intent": call.intent,
            "outcome": call.outcome,
            "administrative_note": call.administrative_note,
            "recording_available": call.recording_available,
            "related_appointment_id": appointment_by_call.get(call.id),
            "related_work_item_ids": work_items_by_call.get(call.id, []),
        }
        for call in batch.calls
    ]
