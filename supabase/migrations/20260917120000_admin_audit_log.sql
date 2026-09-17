-- Phase 9: immutable audit trail for administrative actions.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_employee_id uuid,
  actor_auth_user_id uuid,
  actor_name text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  entity_label text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_action_valid
    check (length(trim(action)) between 3 and 80),
  constraint admin_audit_logs_entity_type_valid
    check (length(trim(entity_type)) between 3 and 80),
  constraint admin_audit_logs_actor_name_valid
    check (length(trim(actor_name)) between 1 and 160)
);

create index if not exists admin_audit_logs_created_at_idx
  on public.admin_audit_logs(created_at desc);
create index if not exists admin_audit_logs_actor_idx
  on public.admin_audit_logs(actor_employee_id, created_at desc);
create index if not exists admin_audit_logs_entity_idx
  on public.admin_audit_logs(entity_type, entity_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

create or replace function public.prevent_admin_audit_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Los registros de auditoria son inmutables.';
end;
$$;

drop trigger if exists admin_audit_logs_prevent_mutation on public.admin_audit_logs;
create trigger admin_audit_logs_prevent_mutation
  before update or delete on public.admin_audit_logs
  for each row execute function public.prevent_admin_audit_mutation();

drop policy if exists "Admins can read audit logs" on public.admin_audit_logs;
create policy "Admins can read audit logs"
on public.admin_audit_logs
for select
to authenticated
using (public.is_admin());

revoke all on table public.admin_audit_logs from public, anon;
revoke insert, update, delete on table public.admin_audit_logs from authenticated;
grant select on table public.admin_audit_logs to authenticated;
revoke all on function public.prevent_admin_audit_mutation() from public, anon, authenticated;
