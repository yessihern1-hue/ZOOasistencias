-- Phase 3: authoritative attendance workflow, cooldown state, observations and
-- early-departure detection.

do $$
begin
  create type public.attendance_departure_status as enum ('on_time', 'early');
exception
  when duplicate_object then null;
end $$;

alter table public.work_shifts
  add column if not exists early_departure_tolerance_minutes integer not null default 0,
  alter column start_time drop not null,
  alter column end_time drop not null;

do $$
begin
  alter table public.work_shifts
    add constraint work_shifts_early_departure_tolerance_non_negative
    check (early_departure_tolerance_minutes >= 0);
exception
  when duplicate_object then null;
end $$;

alter table public.attendance_sessions
  add column if not exists departure_status public.attendance_departure_status,
  add column if not exists check_in_observation text,
  add column if not exists check_out_observation text;

update public.attendance_sessions
set check_in_observation = observation
where check_in_observation is null
  and nullif(trim(coalesce(observation, '')), '') is not null;

create or replace function public.set_attendance_observation_fields()
returns trigger
language plpgsql
as $$
begin
  if new.check_in_observation is null then
    new.check_in_observation := nullif(trim(coalesce(new.observation, '')), '');
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_sessions_set_observation_fields
  on public.attendance_sessions;
create trigger attendance_sessions_set_observation_fields
  before insert on public.attendance_sessions
  for each row execute function public.set_attendance_observation_fields();

create or replace function public.set_attendance_session_derived_fields()
returns trigger
language plpgsql
as $$
declare
  v_shift record;
  v_shift_day record;
  v_shift_end_local timestamp;
  v_shift_end_at timestamptz;
begin
  if new.check_out_at is not null and new.check_out_at < new.check_in_at then
    raise exception 'La salida no puede ser anterior a la entrada.';
  end if;

  if new.check_out_at is null then
    new.worked_minutes := null;
    new.next_allowed_check_in_at := null;
    new.departure_status := null;
    return new;
  end if;

  select
    ws.reentry_delay_minutes,
    ws.early_departure_tolerance_minutes,
    ws.timezone
  into v_shift
  from public.work_shifts ws
  where ws.id = new.work_shift_id;

  new.worked_minutes := greatest(
    0,
    floor(extract(epoch from (new.check_out_at - new.check_in_at)) / 60)::integer
  );
  new.next_allowed_check_in_at :=
    new.check_out_at + make_interval(mins => coalesce(v_shift.reentry_delay_minutes, 0));

  select wsd.start_time, wsd.end_time
  into v_shift_day
  from public.work_shift_days wsd
  where wsd.work_shift_id = new.work_shift_id
    and wsd.day_of_week = extract(dow from new.work_date)::integer;

  if not found then
    new.departure_status := null;
    return new;
  end if;

  v_shift_end_local := new.work_date::timestamp + v_shift_day.end_time;
  if v_shift_day.end_time <= v_shift_day.start_time then
    v_shift_end_local := v_shift_end_local + interval '1 day';
  end if;

  v_shift_end_at := v_shift_end_local at time zone coalesce(
    v_shift.timezone,
    'America/Guatemala'
  );

  new.departure_status := case
    when new.check_out_at < (
      v_shift_end_at - make_interval(
        mins => coalesce(v_shift.early_departure_tolerance_minutes, 0)
      )
    ) then 'early'::public.attendance_departure_status
    else 'on_time'::public.attendance_departure_status
  end;

  return new;
end;
$$;

-- Recalculate derived fields for sessions that already have a checkout.
update public.attendance_sessions
set check_out_at = check_out_at
where check_out_at is not null;

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

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

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

  -- Only the first entry of the day determines punctuality. Reentries after a
  -- completed session must not be classified as late against the shift start.
  v_arrival_status := case
    when v_existing_count = 0
      and v_local_timestamp > (
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
    nullif(trim(coalesce(p_observation, '')), '')
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
  v_clean_observation text;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

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

  v_clean_observation := nullif(trim(coalesce(p_observation, '')), '');

  return query
  update public.attendance_sessions
  set
    check_out_at = now(),
    check_out_photo_path = p_photo_path,
    session_status = 'completed',
    check_out_observation = v_clean_observation,
    observation = case
      when v_clean_observation is null then observation
      when nullif(trim(coalesce(observation, '')), '') is null then v_clean_observation
      else observation || E'\n' || v_clean_observation
    end
  where id = v_session_id
  returning *;
end;
$$;

create or replace function public.get_my_attendance_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_employee record;
  v_open_session record;
  v_assignment record;
  v_shift_day record;
  v_local_date date;
  v_local_timestamp timestamp;
  v_session_count integer := 0;
  v_next_allowed timestamptz;
  v_earliest_check_in timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  select e.id, e.employment_status
  into v_employee
  from public.employees e
  where e.auth_user_id = auth.uid();

  if not found then
    return jsonb_build_object(
      'availability', 'blocked',
      'next_action', null,
      'session_count', 0,
      'max_sessions', 0,
      'reentry_delay_minutes', 0,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'Tu cuenta no esta asociada a un empleado.'
    );
  end if;

  if v_employee.employment_status <> 'active' then
    return jsonb_build_object(
      'availability', 'blocked',
      'next_action', null,
      'session_count', 0,
      'max_sessions', 0,
      'reentry_delay_minutes', 0,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'El empleado no esta activo.'
    );
  end if;

  -- An open session must always be closable, even if the assignment changed.
  select
    s.work_date,
    ws.max_sessions_per_day,
    ws.reentry_delay_minutes
  into v_open_session
  from public.attendance_sessions s
  join public.work_shifts ws on ws.id = s.work_shift_id
  where s.employee_id = v_employee.id
    and s.session_status = 'open'
  order by s.check_in_at desc
  limit 1;

  if found then
    select count(*)
    into v_session_count
    from public.attendance_sessions s
    where s.employee_id = v_employee.id
      and s.work_date = v_open_session.work_date
      and s.session_status <> 'cancelled';

    return jsonb_build_object(
      'availability', 'working',
      'next_action', 'check-out',
      'session_count', v_session_count,
      'max_sessions', v_open_session.max_sessions_per_day,
      'reentry_delay_minutes', v_open_session.reentry_delay_minutes,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'Tienes una entrada abierta. Registra tu salida cuando termines.'
    );
  end if;

  select
    esa.id as assignment_id,
    esa.work_shift_id,
    ws.timezone,
    ws.early_checkin_minutes,
    ws.reentry_delay_minutes,
    ws.max_sessions_per_day
  into v_assignment
  from public.employee_shift_assignments esa
  join public.work_shifts ws on ws.id = esa.work_shift_id
  where esa.employee_id = v_employee.id
    and esa.active
    and ws.active
    and esa.start_date <= (now() at time zone ws.timezone)::date
    and (esa.end_date is null or esa.end_date >= (now() at time zone ws.timezone)::date)
  order by esa.start_date desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'availability', 'blocked',
      'next_action', null,
      'session_count', 0,
      'max_sessions', 0,
      'reentry_delay_minutes', 0,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'No tienes una jornada activa asignada.'
    );
  end if;

  v_local_timestamp := now() at time zone v_assignment.timezone;
  v_local_date := v_local_timestamp::date;

  select wsd.start_time, wsd.end_time
  into v_shift_day
  from public.work_shift_days wsd
  where wsd.work_shift_id = v_assignment.work_shift_id
    and wsd.day_of_week = extract(dow from v_local_date)::integer;

  if not found then
    return jsonb_build_object(
      'availability', 'blocked',
      'next_action', null,
      'session_count', 0,
      'max_sessions', v_assignment.max_sessions_per_day,
      'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'Tu jornada no tiene horario configurado para hoy.'
    );
  end if;

  select count(*)
  into v_session_count
  from public.attendance_sessions s
  where s.employee_id = v_employee.id
    and s.work_date = v_local_date
    and s.session_status <> 'cancelled';

  select max(s.next_allowed_check_in_at)
  into v_next_allowed
  from public.attendance_sessions s
  where s.employee_id = v_employee.id
    and s.session_status = 'completed'
    and s.next_allowed_check_in_at is not null;

  if exists (
    select 1
    from public.employee_absences a
    where a.employee_id = v_employee.id
      and a.status = 'approved'
      and now() >= a.starts_at
      and now() < a.ends_at
  ) then
    return jsonb_build_object(
      'availability', 'blocked',
      'next_action', null,
      'session_count', v_session_count,
      'max_sessions', v_assignment.max_sessions_per_day,
      'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'Tienes vacaciones o un permiso aprobado en este momento.'
    );
  end if;

  if v_session_count >= v_assignment.max_sessions_per_day then
    return jsonb_build_object(
      'availability', 'completed',
      'next_action', null,
      'session_count', v_session_count,
      'max_sessions', v_assignment.max_sessions_per_day,
      'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
      'next_allowed_check_in_at', null,
      'server_now', now(),
      'message', 'Completaste el maximo de sesiones permitidas para hoy.'
    );
  end if;

  v_earliest_check_in := (
    v_local_date::timestamp
    + v_shift_day.start_time
    - make_interval(mins => v_assignment.early_checkin_minutes)
  ) at time zone v_assignment.timezone;

  if now() < v_earliest_check_in then
    return jsonb_build_object(
      'availability', 'cooldown',
      'next_action', null,
      'session_count', v_session_count,
      'max_sessions', v_assignment.max_sessions_per_day,
      'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
      'next_allowed_check_in_at', v_earliest_check_in,
      'server_now', now(),
      'message', 'La jornada aun no esta habilitada para registrar entrada.'
    );
  end if;

  if v_next_allowed is not null and v_next_allowed > now() then
    return jsonb_build_object(
      'availability', 'cooldown',
      'next_action', null,
      'session_count', v_session_count,
      'max_sessions', v_assignment.max_sessions_per_day,
      'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
      'next_allowed_check_in_at', v_next_allowed,
      'server_now', now(),
      'message', 'Jornada completada. La siguiente entrada se habilitara al terminar la espera.'
    );
  end if;

  return jsonb_build_object(
    'availability', 'ready',
    'next_action', 'check-in',
    'session_count', v_session_count,
    'max_sessions', v_assignment.max_sessions_per_day,
    'reentry_delay_minutes', v_assignment.reentry_delay_minutes,
    'next_allowed_check_in_at', null,
    'server_now', now(),
    'message', case
      when v_session_count = 0 then 'Puedes registrar tu entrada.'
      else 'La espera termino. Puedes iniciar otra sesion.'
    end
  );
end;
$$;

revoke all on function public.get_my_attendance_state() from public, anon;
grant execute on function public.get_my_attendance_state() to authenticated;

drop policy if exists "Employees can delete own attendance photos"
  on storage.objects;
create policy "Employees can delete own attendance photos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'attendance-photos'
  and owner_id = (select auth.uid())::text
);
