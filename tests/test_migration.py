from __future__ import annotations

import re
from pathlib import Path


MIGRATION = Path("supabase/migrations/20260930000000_create_callhero_logic.sql")


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8").lower()


def test_migration_creates_shared_logic_tables() -> None:
    sql = _sql()
    for table in (
        "clinics",
        "contact_groups",
        "call_events",
        "appointments",
        "work_items",
        "work_item_events",
        "data_issues",
    ):
        assert f"create table public.{table}" in sql


def test_call_import_and_related_records_have_idempotency_constraints() -> None:
    sql = _sql()
    assert "unique (clinic_id, source_event_id)" in sql
    assert "unique (source_call_event_id)" in sql
    assert "unique (source_call_event_id, issue_code, affected_field)" in sql


def test_work_item_vocabulary_is_constrained() -> None:
    sql = _sql()
    assert "check (priority in ('immediate', 'soon', 'planned'))" in sql
    assert "check (state in ('pending', 'in_progress', 'handled', 'unreachable'))" in sql
    for item_type in (
        "practitioner_review",
        "billing_complaint",
        "waiting_list",
        "booking_recovery",
        "verify_contact",
        "rebook",
        "referral",
        "verify_open_slot",
    ):
        assert f"'{item_type}'" in sql


def test_clinic_tables_use_rls_and_revoke_client_access() -> None:
    sql = _sql()
    for table in (
        "clinics",
        "contact_groups",
        "call_events",
        "appointments",
        "work_items",
        "work_item_events",
        "data_issues",
    ):
        assert f"alter table public.{table} enable row level security" in sql
        assert re.search(
            rf"revoke all on table public\.{table} from anon, authenticated", sql
        )


def test_call_events_schema_has_no_free_text_summary_column() -> None:
    sql = _sql()
    match = re.search(
        r"create table public\.call_events\s*\((.*?)\);", sql, re.DOTALL
    )
    assert match
    columns = match.group(1)
    assert not re.search(r"\b(summary|transcript|clinical_notes?)\b", columns)
