from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ClinicRecord:
    id: str
    name: str
    suburb: str | None
    state: str | None
    business_hours: str | None
    recording_enabled: bool | None


@dataclass(frozen=True)
class ContactGroupRecord:
    id: str
    clinic_id: str
    identity_key: str
    caller_name: str
    normalized_phone: str


@dataclass(frozen=True)
class CallEventRecord:
    id: str
    clinic_id: str
    source_event_id: str
    contact_group_id: str | None
    received_at: str | None
    duration_seconds: int | None
    caller_name: str | None
    caller_number: str | None
    normalized_phone: str | None
    intent: str | None
    outcome: str | None
    booking_result: str | None
    recording_available: bool | None
    flagged: str | None
    repeat_caller: bool | None
    administrative_note: str


@dataclass(frozen=True)
class AppointmentRecord:
    id: str
    clinic_id: str
    source_call_event_id: str
    source_status: str
    appointment_date: str | None
    appointment_time: str | None
    appointment_type: str | None
    practitioner: str | None
    source_action: str | None
    validation_status: str
    validation_reasons: tuple[str, ...]


@dataclass(frozen=True)
class WorkItemRecord:
    id: str
    clinic_id: str
    contact_group_id: str | None
    source_call_event_id: str | None
    related_appointment_id: str | None
    item_type: str
    priority: str
    state: str
    reason_code: str
    next_action: str


@dataclass(frozen=True)
class DataIssueRecord:
    id: str
    clinic_id: str
    source_call_event_id: str
    issue_code: str
    affected_field: str
    severity: str
    rule_version: str = "v1"
    review_state: str = "open"


@dataclass(frozen=True)
class DerivedBatch:
    clinic: ClinicRecord
    contact_groups: tuple[ContactGroupRecord, ...]
    calls: tuple[CallEventRecord, ...]
    appointments: tuple[AppointmentRecord, ...]
    work_items: tuple[WorkItemRecord, ...]
    data_issues: tuple[DataIssueRecord, ...]
    source_period: dict[str, Any]
