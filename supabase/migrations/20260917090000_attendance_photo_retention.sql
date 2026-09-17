-- Phase 8: traceable photo retention and stable per-session Storage paths.

alter table public.attendance_sessions
  add column if not exists check_in_photo_deleted_at timestamptz,
  add column if not exists check_out_photo_deleted_at timestamptz;

create index if not exists attendance_sessions_check_in_photo_retention_idx
  on public.attendance_sessions(check_in_at)
  where check_in_photo_path is not null and check_in_photo_deleted_at is null;

create index if not exists attendance_sessions_check_out_photo_retention_idx
  on public.attendance_sessions(check_out_at)
  where check_out_photo_path is not null and check_out_photo_deleted_at is null;

-- Preserve the complete geofence implementation from phase 7 as an internal
-- function and expose a new signature that lets the server reserve the session
-- UUID before uploading the entry photo.
alter function public.clock_in(
  text, text, double precision, double precision, double precision
) rename to clock_in_without_session_id;

revoke all on function public.clock_in_without_session_id(
  text, text, double precision, double precision, double precision
) from public, anon, authenticated;

create or replace function public.clock_in(
  p_session_id uuid,
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
  v_created_session public.attendance_sessions%rowtype;
begin
  if p_session_id is null then
    raise exception 'El identificador de la sesion no es valido.';
  end if;

  select *
  into v_created_session
  from public.clock_in_without_session_id(
    p_photo_path,
    p_observation,
    p_latitude,
    p_longitude,
    p_accuracy_meters
  );

  return query
  update public.attendance_sessions
  set id = p_session_id
  where id = v_created_session.id
  returning *;
end;
$$;

revoke all on function public.clock_in(
  uuid, text, text, double precision, double precision, double precision
) from public, anon;
grant execute on function public.clock_in(
  uuid, text, text, double precision, double precision, double precision
) to authenticated;
