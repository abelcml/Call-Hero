create extension if not exists pgcrypto;

create table public.clinics (
    id uuid primary key,
    name text not null,
    suburb text,
    state text,
    business_hours text,
    recording_enabled boolean,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.contact_groups (
    id uuid primary key,
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    identity_key text not null,
    caller_name text not null,
    normalized_phone text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (clinic_id, identity_key)
);

create table public.call_events (
    id uuid primary key,
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    source_event_id text not null,
    contact_group_id uuid references public.contact_groups(id) on delete set null,
    received_at timestamptz,
    duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
    caller_name text,
    caller_number text,
    normalized_phone text,
    intent text,
    outcome text,
    booking_result text check (booking_result in ('booked', 'cancelled', 'not_booked') or booking_result is null),
    recording_available boolean,
    flagged text,
    repeat_caller boolean,
    administrative_note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (clinic_id, source_event_id)
);

create table public.appointments (
    id uuid primary key,
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    source_call_event_id uuid not null references public.call_events(id) on delete cascade,
    source_status text not null,
    appointment_date date,
    appointment_time time,
    appointment_type text,
    practitioner text,
    source_action text,
    validation_status text not null check (validation_status in ('recorded', 'verify_date', 'verify_time', 'missing_data')),
    validation_reasons text[] not null default '{}',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_call_event_id)
);

create table public.work_items (
    id uuid primary key default gen_random_uuid(),
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    contact_group_id uuid references public.contact_groups(id) on delete set null,
    source_call_event_id uuid references public.call_events(id) on delete set null,
    related_appointment_id uuid references public.appointments(id) on delete set null,
    item_type text not null check (item_type in (
        'practitioner_review',
        'billing_complaint',
        'waiting_list',
        'booking_recovery',
        'verify_contact',
        'rebook',
        'referral',
        'verify_open_slot'
    )),
    priority text not null check (priority in ('immediate', 'soon', 'planned')),
    state text not null default 'pending' check (state in ('pending', 'in_progress', 'handled', 'unreachable')),
    reason_code text not null,
    next_action text not null,
    owner text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.work_item_events (
    id uuid primary key default gen_random_uuid(),
    work_item_id uuid not null references public.work_items(id) on delete cascade,
    from_state text check (from_state in ('pending', 'in_progress', 'handled', 'unreachable') or from_state is null),
    to_state text not null check (to_state in ('pending', 'in_progress', 'handled', 'unreachable')),
    actor text,
    note text,
    created_at timestamptz not null default now()
);

create table public.data_issues (
    id uuid primary key,
    clinic_id uuid not null references public.clinics(id) on delete cascade,
    source_call_event_id uuid not null references public.call_events(id) on delete cascade,
    issue_code text not null,
    affected_field text not null,
    severity text not null check (severity in ('minor', 'important', 'blocking')),
    rule_version text not null,
    review_state text not null default 'open' check (review_state in ('open', 'reviewed', 'dismissed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (source_call_event_id, issue_code, affected_field)
);

create index contact_groups_clinic_id_idx on public.contact_groups(clinic_id);
create index call_events_clinic_received_at_idx on public.call_events(clinic_id, received_at desc);
create index appointments_clinic_date_time_idx on public.appointments(clinic_id, appointment_date, appointment_time);
create index work_items_clinic_state_priority_idx on public.work_items(clinic_id, state, priority);
create index data_issues_clinic_review_state_idx on public.data_issues(clinic_id, review_state);

alter table public.clinics enable row level security;
alter table public.contact_groups enable row level security;
alter table public.call_events enable row level security;
alter table public.appointments enable row level security;
alter table public.work_items enable row level security;
alter table public.work_item_events enable row level security;
alter table public.data_issues enable row level security;

revoke all on table public.clinics from anon, authenticated;
revoke all on table public.contact_groups from anon, authenticated;
revoke all on table public.call_events from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.work_items from anon, authenticated;
revoke all on table public.work_item_events from anon, authenticated;
revoke all on table public.data_issues from anon, authenticated;

grant all on table public.clinics to service_role;
grant all on table public.contact_groups to service_role;
grant all on table public.call_events to service_role;
grant all on table public.appointments to service_role;
grant all on table public.work_items to service_role;
grant all on table public.work_item_events to service_role;
grant all on table public.data_issues to service_role;
