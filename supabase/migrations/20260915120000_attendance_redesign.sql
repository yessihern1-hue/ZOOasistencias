-- Attendance redesign for Supabase.
-- This migration intentionally creates the new model next to the prototype
-- tables, so existing data can be migrated safely before old tables are removed.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$
begin
  create type public.employee_role as enum ('admin', 'employee');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.employment_status as enum ('active', 'inactive');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.absence_type as enum ('vacation', 'permission');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.absence_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attendance_session_status as enum ('open', 'completed', 'corrected', 'cancelled');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.attendance_arrival_status as enum ('on_time', 'late');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  full_name text not null,
  email text not null,
  role public.employee_role not null default 'employee',
  employment_status public.employment_status not null default 'active',
  department text,
  position text,
  avatar_tone text not null default 'blue',
  hire_date date,
  termination_date date,
  inactive_reason text,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employees_email_not_blank check (length(trim(email)) > 0),
  constraint employees_full_name_not_blank check (length(trim(full_name)) > 0),
  constraint employees_termination_after_hire check (
    termination_date is null
    or hire_date is null
    or termination_date >= hire_date
  )
);

create unique index if not exists employees_email_lower_key
  on public.employees (lower(email));

create index if not exists employees_auth_user_id_idx
  on public.employees (auth_user_id);

create table if not exists public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Guatemala',
  late_tolerance_minutes integer not null default 10,
  early_checkin_minutes integer not null default 0,
  reentry_delay_minutes integer not null default 60,
  max_sessions_per_day integer not null default 2,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shifts_name_not_blank check (length(trim(name)) > 0),
  constraint work_shifts_non_negative_config check (
    late_tolerance_minutes >= 0
    and early_checkin_minutes >= 0
    and reentry_delay_minutes >= 0
  ),
  constraint work_shifts_max_sessions_positive check (max_sessions_per_day > 0)
);

-- The prototype already has public.work_shifts with only name/start_time/end_time.
-- CREATE TABLE IF NOT EXISTS does not add missing columns, so make the table
-- compatible with the redesigned attendance model before functions/views use it.
alter table public.work_shifts
  add column if not exists start_time time,
  add column if not exists end_time time,
  add column if not exists timezone text not null default 'America/Guatemala',
  add column if not exists late_tolerance_minutes integer not null default 10,
  add column if not exists early_checkin_minutes integer not null default 0,
  add column if not exists reentry_delay_minutes integer not null default 60,
  add column if not exists max_sessions_per_day integer not null default 2,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  alter table public.work_shifts
    add constraint work_shifts_non_negative_config
    check (
      late_tolerance_minutes >= 0
      and early_checkin_minutes >= 0
      and reentry_delay_minutes >= 0
    );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.work_shifts
    add constraint work_shifts_max_sessions_positive
    check (max_sessions_per_day > 0);
exception
  when duplicate_object then null;
end $$;

create table if not exists public.work_shift_days (
  id uuid primary key default gen_random_uuid(),
  work_shift_id uuid not null references public.work_shifts (id) on delete cascade,
  day_of_week integer not null,
  start_time time not null,
  end_time time not null,
  unpaid_break_minutes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint work_shift_days_day_range check (day_of_week between 0 and 6),
  constraint work_shift_days_break_non_negative check (unpaid_break_minutes >= 0),
  constraint work_shift_days_unique_day unique (work_shift_id, day_of_week)
);

insert into public.work_shift_days (
  work_shift_id,
  day_of_week,
  start_time,
  end_time
)
select
  ws.id,
  day.day_of_week,
  ws.start_time,
  ws.end_time
from public.work_shifts ws
cross join generate_series(1, 5) as day(day_of_week)
where ws.start_time is not null
  and ws.end_time is not null
  and not exists (
    select 1
    from public.work_shift_days wsd
    where wsd.work_shift_id = ws.id
      and wsd.day_of_week = day.day_of_week
  );

create table if not exists public.employee_shift_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  work_shift_id uuid not null references public.work_shifts (id) on delete restrict,
  start_date date not null,
  end_date date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_shift_assignments_date_order check (
    end_date is null or end_date >= start_date
  )
);

do $$
begin
  alter table public.employee_shift_assignments
    add constraint employee_shift_assignments_no_overlap
    exclude using gist (
      employee_id with =,
      daterange(start_date, coalesce(end_date, 'infinity'::date), '[]') with &&
    )
    where (active);
exception
  when duplicate_object then null;
end $$;

create index if not exists employee_shift_assignments_employee_idx
  on public.employee_shift_assignments (employee_id, active, start_date desc);

create table if not exists public.employee_absences (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete cascade,
  absence_type public.absence_type not null,
  status public.absence_status not null default 'pending',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  requested_by_employee_id uuid references public.employees (id) on delete set null,
  approved_by_employee_id uuid references public.employees (id) on delete set null,
  approved_at timestamptz,
  reason text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_absences_time_order check (ends_at > starts_at),
  constraint employee_absences_approval_consistency check (
    (status = 'approved' and approved_by_employee_id is not null and approved_at is not null)
    or status <> 'approved'
  )
);

create index if not exists employee_absences_employee_time_idx
  on public.employee_absences (employee_id, starts_at, ends_at);

create index if not exists employee_absences_status_idx
  on public.employee_absences (status);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  work_shift_id uuid not null references public.work_shifts (id) on delete restrict,
  assignment_id uuid references public.employee_shift_assignments (id) on delete set null,
  work_date date not null,
  session_sequence integer not null,
  check_in_at timestamptz not null,
  check_out_at timestamptz,
  check_in_photo_path text,
  check_out_photo_path text,
  arrival_status public.attendance_arrival_status not null default 'on_time',
  session_status public.attendance_session_status not null default 'open',
  worked_minutes integer,
  next_allowed_check_in_at timestamptz,
  observation text,
  corrected_by_employee_id uuid references public.employees (id) on delete set null,
  correction_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_sequence_positive check (session_sequence > 0),
  constraint attendance_sessions_checkout_after_checkin check (
    check_out_at is null or check_out_at >= check_in_at
  ),
  constraint attendance_sessions_worked_minutes_non_negative check (
    worked_minutes is null or worked_minutes >= 0
  ),
  constraint attendance_sessions_unique_sequence unique (employee_id, work_date, session_sequence)
);

create unique index if not exists attendance_sessions_one_open_per_employee
  on public.attendance_sessions (employee_id)
  where session_status = 'open';

create index if not exists attendance_sessions_employee_date_idx
  on public.attendance_sessions (employee_id, work_date desc);

create index if not exists attendance_sessions_shift_date_idx
  on public.attendance_sessions (work_shift_id, work_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_attendance_session_derived_fields()
returns trigger
language plpgsql
as $$
declare
  v_reentry_delay integer;
begin
  if new.check_out_at is not null and new.check_out_at < new.check_in_at then
    raise exception 'La salida no puede ser anterior a la entrada.';
  end if;

  if new.check_out_at is null then
    new.worked_minutes = null;
    new.next_allowed_check_in_at = null;
    return new;
  end if;

  select reentry_delay_minutes
    into v_reentry_delay
  from public.work_shifts
  where id = new.work_shift_id;

  new.worked_minutes = greatest(
    0,
    floor(extract(epoch from (new.check_out_at - new.check_in_at)) / 60)::integer
  );

  new.next_allowed_check_in_at =
    new.check_out_at + make_interval(mins => coalesce(v_reentry_delay, 0));

  return new;
end;
$$;

drop trigger if exists employees_set_updated_at on public.employees;
create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

drop trigger if exists work_shifts_set_updated_at on public.work_shifts;
create trigger work_shifts_set_updated_at
  before update on public.work_shifts
  for each row execute function public.set_updated_at();

drop trigger if exists work_shift_days_set_updated_at on public.work_shift_days;
create trigger work_shift_days_set_updated_at
  before update on public.work_shift_days
  for each row execute function public.set_updated_at();

drop trigger if exists employee_shift_assignments_set_updated_at on public.employee_shift_assignments;
create trigger employee_shift_assignments_set_updated_at
  before update on public.employee_shift_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists employee_absences_set_updated_at on public.employee_absences;
create trigger employee_absences_set_updated_at
  before update on public.employee_absences
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_sessions_set_derived_fields on public.attendance_sessions;
create trigger attendance_sessions_set_derived_fields
  before insert or update of check_in_at, check_out_at, work_shift_id
  on public.attendance_sessions
  for each row execute function public.set_attendance_session_derived_fields();

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.employees
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees
    where auth_user_id = auth.uid()
      and role = 'admin'
      and employment_status = 'active'
  );
$$;

create or replace function public.clock_in(
  p_photo_path text,
  p_observation text default null
)
returns setof public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_assignment record;
  v_shift_day record;
  v_local_date date;
  v_local_timestamp timestamp;
  v_shift_start_timestamp timestamp;
  v_existing_count integer;
  v_next_sequence integer;
  v_last_next_allowed timestamptz;
  v_arrival_status public.attendance_arrival_status;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  if nullif(trim(coalesce(p_photo_path, '')), '') is null then
    raise exception 'Debe subir una fotografia para registrar la entrada.';
  end if;

  select id
    into v_employee_id
  from public.employees
  where auth_user_id = auth.uid()
    and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'El empleado no esta activo.';
  end if;

  if exists (
    select 1
    from public.employee_absences
    where employee_id = v_employee_id
      and status = 'approved'
      and now() >= starts_at
      and now() < ends_at
  ) then
    raise exception 'El empleado tiene vacaciones o permiso aprobado en este momento.';
  end if;

  if exists (
    select 1
    from public.attendance_sessions
    where employee_id = v_employee_id
      and session_status = 'open'
  ) then
    raise exception 'Ya existe una entrada abierta. Registra la salida primero.';
  end if;

  select max(next_allowed_check_in_at)
    into v_last_next_allowed
  from public.attendance_sessions
  where employee_id = v_employee_id
    and session_status = 'completed'
    and next_allowed_check_in_at is not null;

  if v_last_next_allowed is not null and v_last_next_allowed > now() then
    raise exception 'Todavia no se puede registrar otra entrada.';
  end if;

  select
    esa.id as assignment_id,
    esa.work_shift_id,
    ws.timezone,
    ws.late_tolerance_minutes,
    ws.early_checkin_minutes,
    ws.max_sessions_per_day
    into v_assignment
  from public.employee_shift_assignments esa
  join public.work_shifts ws on ws.id = esa.work_shift_id
  where esa.employee_id = v_employee_id
    and esa.active
    and ws.active
    and esa.start_date <= (now() at time zone ws.timezone)::date
    and (esa.end_date is null or esa.end_date >= (now() at time zone ws.timezone)::date)
  order by esa.start_date desc
  limit 1;

  if not found then
    raise exception 'No hay una jornada activa asignada.';
  end if;

  v_local_timestamp := now() at time zone v_assignment.timezone;
  v_local_date := v_local_timestamp::date;

  select *
    into v_shift_day
  from public.work_shift_days
  where work_shift_id = v_assignment.work_shift_id
    and day_of_week = extract(dow from v_local_date)::integer;

  if not found then
    raise exception 'La jornada no tiene horario configurado para hoy.';
  end if;

  select count(*)
    into v_existing_count
  from public.attendance_sessions
  where employee_id = v_employee_id
    and work_date = v_local_date
    and session_status <> 'cancelled';

  if v_existing_count >= v_assignment.max_sessions_per_day then
    raise exception 'Se alcanzo el maximo de sesiones permitidas para hoy.';
  end if;

  v_shift_start_timestamp := v_local_date::timestamp + v_shift_day.start_time;

  if v_local_timestamp < (
    v_shift_start_timestamp - make_interval(mins => v_assignment.early_checkin_minutes)
  ) then
    raise exception 'Todavia no se puede registrar entrada para esta jornada.';
  end if;

  v_arrival_status := case
    when v_local_timestamp > (
      v_shift_start_timestamp + make_interval(mins => v_assignment.late_tolerance_minutes)
    ) then 'late'::public.attendance_arrival_status
    else 'on_time'::public.attendance_arrival_status
  end;

  v_next_sequence := v_existing_count + 1;

  return query
  insert into public.attendance_sessions (
    employee_id,
    work_shift_id,
    assignment_id,
    work_date,
    session_sequence,
    check_in_at,
    check_in_photo_path,
    arrival_status,
    session_status,
    observation
  )
  values (
    v_employee_id,
    v_assignment.work_shift_id,
    v_assignment.assignment_id,
    v_local_date,
    v_next_sequence,
    now(),
    p_photo_path,
    v_arrival_status,
    'open',
    p_observation
  )
  returning *;
end;
$$;

create or replace function public.clock_out(
  p_photo_path text,
  p_observation text default null
)
returns setof public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_session_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  if nullif(trim(coalesce(p_photo_path, '')), '') is null then
    raise exception 'Debe subir una fotografia para registrar la salida.';
  end if;

  select id
    into v_employee_id
  from public.employees
  where auth_user_id = auth.uid()
    and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'El empleado no esta activo.';
  end if;

  select id
    into v_session_id
  from public.attendance_sessions
  where employee_id = v_employee_id
    and session_status = 'open'
  order by check_in_at desc
  limit 1
  for update;

  if v_session_id is null then
    raise exception 'No hay una entrada abierta para cerrar.';
  end if;

  return query
  update public.attendance_sessions
  set
    check_out_at = now(),
    check_out_photo_path = p_photo_path,
    session_status = 'completed',
    observation = coalesce(p_observation, observation)
  where id = v_session_id
  returning *;
end;
$$;

create or replace view public.employee_effective_status
with (security_invoker = true)
as
select
  e.id,
  e.auth_user_id,
  e.full_name,
  e.email,
  e.role,
  e.employment_status,
  case
    when e.employment_status = 'inactive' then 'inactive'
    when active_absence.absence_type = 'vacation' then 'vacation'
    when active_absence.absence_type = 'permission' then 'permission'
    else 'active'
  end as effective_status,
  active_absence.id as active_absence_id,
  e.department,
  e.position,
  e.avatar_tone,
  e.created_at,
  e.updated_at
from public.employees e
left join lateral (
  select a.id, a.absence_type
  from public.employee_absences a
  where a.employee_id = e.id
    and a.status = 'approved'
    and now() >= a.starts_at
    and now() < a.ends_at
  order by a.starts_at desc
  limit 1
) active_absence on true;

create or replace view public.attendance_daily_overview
with (security_invoker = true)
as
select
  s.employee_id,
  s.work_date,
  min(s.check_in_at) as first_check_in_at,
  max(s.check_out_at) as last_check_out_at,
  count(*) filter (where s.session_status <> 'cancelled') as session_count,
  coalesce(sum(s.worked_minutes) filter (where s.session_status = 'completed'), 0)::integer as worked_minutes,
  case
    when bool_or(s.arrival_status = 'late') then 'late'
    when count(*) filter (where s.session_status <> 'cancelled') > 0 then 'present'
    else 'pending'
  end as attendance_status
from public.attendance_sessions s
group by s.employee_id, s.work_date;

create or replace view public.attendance_weekly_totals
with (security_invoker = true)
as
select
  s.employee_id,
  date_trunc(
    'week',
    s.check_in_at at time zone coalesce(ws.timezone, 'America/Guatemala')
  )::date as week_start_date,
  count(*) filter (where s.session_status = 'completed') as completed_sessions,
  coalesce(sum(s.worked_minutes) filter (where s.session_status = 'completed'), 0)::integer as worked_minutes,
  round(
    coalesce(sum(s.worked_minutes) filter (where s.session_status = 'completed'), 0)::numeric / 60,
    2
  ) as worked_hours
from public.attendance_sessions s
join public.work_shifts ws on ws.id = s.work_shift_id
group by s.employee_id, date_trunc('week', s.check_in_at at time zone coalesce(ws.timezone, 'America/Guatemala'));

alter table public.employees enable row level security;
alter table public.work_shifts enable row level security;
alter table public.work_shift_days enable row level security;
alter table public.employee_shift_assignments enable row level security;
alter table public.employee_absences enable row level security;
alter table public.attendance_sessions enable row level security;

revoke all on public.employees from anon;
revoke all on public.work_shifts from anon;
revoke all on public.work_shift_days from anon;
revoke all on public.employee_shift_assignments from anon;
revoke all on public.employee_absences from anon;
revoke all on public.attendance_sessions from anon;

grant select, insert, update, delete on public.employees to authenticated;
grant select, insert, update, delete on public.work_shifts to authenticated;
grant select, insert, update, delete on public.work_shift_days to authenticated;
grant select, insert, update, delete on public.employee_shift_assignments to authenticated;
grant select, insert, update, delete on public.employee_absences to authenticated;
grant select, insert, update, delete on public.attendance_sessions to authenticated;
grant select on public.employee_effective_status to authenticated;
grant select on public.attendance_daily_overview to authenticated;
grant select on public.attendance_weekly_totals to authenticated;
revoke all on function public.current_employee_id() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.clock_in(text, text) from public, anon;
revoke all on function public.clock_out(text, text) from public, anon;
grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.clock_in(text, text) to authenticated;
grant execute on function public.clock_out(text, text) to authenticated;

create policy "Employees can read themselves and admins can read all"
on public.employees
for select
to authenticated
using (id = public.current_employee_id() or public.is_admin());

create policy "Admins can manage employees"
on public.employees
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read active shifts"
on public.work_shifts
for select
to authenticated
using (active or public.is_admin());

create policy "Admins can manage shifts"
on public.work_shifts
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read shift days"
on public.work_shift_days
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.work_shifts ws
    where ws.id = work_shift_days.work_shift_id
      and ws.active
  )
);

create policy "Admins can manage shift days"
on public.work_shift_days
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Employees can read own assignments and admins can read all"
on public.employee_shift_assignments
for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_admin());

create policy "Admins can manage assignments"
on public.employee_shift_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Employees can read own absences and admins can read all"
on public.employee_absences
for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_admin());

create policy "Employees can request their own absences"
on public.employee_absences
for insert
to authenticated
with check (
  employee_id = public.current_employee_id()
  and requested_by_employee_id = public.current_employee_id()
  and status = 'pending'
);

create policy "Employees can cancel own pending absences"
on public.employee_absences
for update
to authenticated
using (
  employee_id = public.current_employee_id()
  and status = 'pending'
)
with check (
  employee_id = public.current_employee_id()
  and status = 'cancelled'
);

create policy "Admins can manage absences"
on public.employee_absences
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Employees can read own attendance and admins can read all"
on public.attendance_sessions
for select
to authenticated
using (employee_id = public.current_employee_id() or public.is_admin());

create policy "Admins can manage attendance"
on public.attendance_sessions
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('attendance-photos', 'attendance-photos', false)
on conflict (id) do update
set public = false;

create policy "Employees can upload attendance photos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'attendance-photos'
  and owner_id = (select auth.uid())::text
);

create policy "Employees can read own attendance photos and admins can read all"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'attendance-photos'
  and (
    owner_id = (select auth.uid())::text
    or public.is_admin()
  )
);

create policy "Admins can manage attendance photos"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'attendance-photos'
  and public.is_admin()
)
with check (
  bucket_id = 'attendance-photos'
  and public.is_admin()
);
