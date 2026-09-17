-- Phase 7: configurable attendance locations and authoritative geofence checks.

create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  allowed_radius_meters integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_locations_name_not_blank check (length(trim(name)) > 0),
  constraint attendance_locations_latitude_range check (latitude between -90 and 90),
  constraint attendance_locations_longitude_range check (longitude between -180 and 180),
  constraint attendance_locations_radius_range check (allowed_radius_meters between 10 and 10000)
);

alter table public.attendance_locations enable row level security;

drop policy if exists "Admins can read attendance locations" on public.attendance_locations;
create policy "Admins can read attendance locations"
on public.attendance_locations for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can manage attendance locations" on public.attendance_locations;
create policy "Admins can manage attendance locations"
on public.attendance_locations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop trigger if exists attendance_locations_set_updated_at on public.attendance_locations;
create trigger attendance_locations_set_updated_at
  before update on public.attendance_locations
  for each row execute function public.set_updated_at();

alter table public.attendance_sessions
  add column if not exists check_in_location_id uuid references public.attendance_locations(id),
  add column if not exists check_in_latitude double precision,
  add column if not exists check_in_longitude double precision,
  add column if not exists check_in_accuracy_meters double precision,
  add column if not exists check_in_distance_meters double precision,
  add column if not exists check_out_location_id uuid references public.attendance_locations(id),
  add column if not exists check_out_latitude double precision,
  add column if not exists check_out_longitude double precision,
  add column if not exists check_out_accuracy_meters double precision,
  add column if not exists check_out_distance_meters double precision;

do $$
begin
  alter table public.attendance_sessions
    add constraint attendance_sessions_check_in_latitude_range
    check (check_in_latitude is null or check_in_latitude between -90 and 90);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.attendance_sessions
    add constraint attendance_sessions_check_in_longitude_range
    check (check_in_longitude is null or check_in_longitude between -180 and 180);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.attendance_sessions
    add constraint attendance_sessions_check_out_latitude_range
    check (check_out_latitude is null or check_out_latitude between -90 and 90);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.attendance_sessions
    add constraint attendance_sessions_check_out_longitude_range
    check (check_out_longitude is null or check_out_longitude between -180 and 180);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.attendance_sessions
    add constraint attendance_sessions_geo_measurements_non_negative
    check (
      coalesce(check_in_accuracy_meters, 0) >= 0 and
      coalesce(check_in_distance_meters, 0) >= 0 and
      coalesce(check_out_accuracy_meters, 0) >= 0 and
      coalesce(check_out_distance_meters, 0) >= 0
    );
exception when duplicate_object then null;
end $$;

create index if not exists attendance_locations_active_idx
  on public.attendance_locations(active);

create or replace function public.calculate_distance_meters(
  p_latitude_a double precision,
  p_longitude_a double precision,
  p_latitude_b double precision,
  p_longitude_b double precision
)
returns double precision
language sql
immutable
strict
set search_path = public
as $$
  select 6371000 * 2 * asin(
    sqrt(
      least(
        1::double precision,
        greatest(
          0::double precision,
          power(sin(radians(p_latitude_b - p_latitude_a) / 2), 2) +
          cos(radians(p_latitude_a)) * cos(radians(p_latitude_b)) *
          power(sin(radians(p_longitude_b - p_longitude_a) / 2), 2)
        )
      )
    )
  );
$$;

-- Remove the previous signatures so geolocation cannot be bypassed by calling
-- an older RPC directly.
drop function if exists public.clock_in(text, text);
drop function if exists public.clock_out(text, text);

create or replace function public.clock_in(
  p_photo_path text,
  p_observation text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
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
  v_location record;
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

  if p_latitude is null or p_latitude not between -90 and 90 or
     p_longitude is null or p_longitude not between -180 and 180 or
     p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 10000 then
    raise exception 'La ubicacion recibida no es valida.';
  end if;

  select
    location.id,
    location.name,
    location.allowed_radius_meters,
    public.calculate_distance_meters(
      p_latitude,
      p_longitude,
      location.latitude,
      location.longitude
    ) as distance_meters
  into v_location
  from public.attendance_locations location
  where location.active
  order by public.calculate_distance_meters(
    p_latitude,
    p_longitude,
    location.latitude,
    location.longitude
  )
  limit 1;

  if not found then
    raise exception 'No hay una ubicacion activa configurada. Contacta al administrador.';
  end if;

  if v_location.distance_meters > v_location.allowed_radius_meters then
    raise exception 'Estas fuera del area permitida para registrar asistencia.';
  end if;

  select id into v_employee_id
  from public.employees
  where auth_user_id = auth.uid() and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'El empleado no esta activo.';
  end if;

  if exists (
    select 1 from public.employee_absences
    where employee_id = v_employee_id
      and status = 'approved'
      and now() >= starts_at
      and now() < ends_at
  ) then
    raise exception 'El empleado tiene vacaciones o permiso aprobado en este momento.';
  end if;

  if exists (
    select 1 from public.attendance_sessions
    where employee_id = v_employee_id and session_status = 'open'
  ) then
    raise exception 'Ya existe una entrada abierta. Registra la salida primero.';
  end if;

  select max(next_allowed_check_in_at) into v_last_next_allowed
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

  select * into v_shift_day
  from public.work_shift_days
  where work_shift_id = v_assignment.work_shift_id
    and day_of_week = extract(dow from v_local_date)::integer;

  if not found then
    raise exception 'La jornada no tiene horario configurado para hoy.';
  end if;

  select count(*) into v_existing_count
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
    when v_existing_count = 0 and v_local_timestamp > (
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
    check_in_location_id,
    check_in_latitude,
    check_in_longitude,
    check_in_accuracy_meters,
    check_in_distance_meters,
    arrival_status,
    session_status,
    observation
  ) values (
    v_employee_id,
    v_assignment.work_shift_id,
    v_assignment.assignment_id,
    v_local_date,
    v_next_sequence,
    now(),
    p_photo_path,
    v_location.id,
    p_latitude,
    p_longitude,
    p_accuracy_meters,
    v_location.distance_meters,
    v_arrival_status,
    'open',
    nullif(trim(coalesce(p_observation, '')), '')
  )
  returning *;
end;
$$;

create or replace function public.clock_out(
  p_photo_path text,
  p_observation text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision
)
returns setof public.attendance_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_employee_id uuid;
  v_session_id uuid;
  v_location record;
  v_clean_observation text;
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));

  if nullif(trim(coalesce(p_photo_path, '')), '') is null then
    raise exception 'Debe subir una fotografia para registrar la salida.';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90 or
     p_longitude is null or p_longitude not between -180 and 180 or
     p_accuracy_meters is null or p_accuracy_meters < 0 or p_accuracy_meters > 10000 then
    raise exception 'La ubicacion recibida no es valida.';
  end if;

  select
    location.id,
    location.name,
    location.allowed_radius_meters,
    public.calculate_distance_meters(
      p_latitude,
      p_longitude,
      location.latitude,
      location.longitude
    ) as distance_meters
  into v_location
  from public.attendance_locations location
  where location.active
  order by public.calculate_distance_meters(
    p_latitude,
    p_longitude,
    location.latitude,
    location.longitude
  )
  limit 1;

  if not found then
    raise exception 'No hay una ubicacion activa configurada. Contacta al administrador.';
  end if;

  if v_location.distance_meters > v_location.allowed_radius_meters then
    raise exception 'Estas fuera del area permitida para registrar asistencia.';
  end if;

  select id into v_employee_id
  from public.employees
  where auth_user_id = auth.uid() and employment_status = 'active';

  if v_employee_id is null then
    raise exception 'El empleado no esta activo.';
  end if;

  select id into v_session_id
  from public.attendance_sessions
  where employee_id = v_employee_id and session_status = 'open'
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
    check_out_location_id = v_location.id,
    check_out_latitude = p_latitude,
    check_out_longitude = p_longitude,
    check_out_accuracy_meters = p_accuracy_meters,
    check_out_distance_meters = v_location.distance_meters,
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

revoke all on function public.calculate_distance_meters(
  double precision, double precision, double precision, double precision
) from public, anon;
revoke all on function public.clock_in(
  text, text, double precision, double precision, double precision
) from public, anon;
revoke all on function public.clock_out(
  text, text, double precision, double precision, double precision
) from public, anon;

grant execute on function public.clock_in(
  text, text, double precision, double precision, double precision
) to authenticated;
grant execute on function public.clock_out(
  text, text, double precision, double precision, double precision
) to authenticated;

grant select, insert, update on public.attendance_locations to authenticated;
