-- Phase 5: transactional administration of work shifts and their configured days.

create or replace function public.save_work_shift(
  p_shift_id uuid,
  p_name text,
  p_timezone text,
  p_late_tolerance_minutes integer,
  p_early_checkin_minutes integer,
  p_early_departure_tolerance_minutes integer,
  p_reentry_delay_minutes integer,
  p_max_sessions_per_day integer,
  p_days jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shift_id uuid;
  v_first_start time;
  v_first_end time;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede guardar jornadas.';
  end if;

  if nullif(trim(coalesce(p_name, '')), '') is null or length(trim(p_name)) > 120 then
    raise exception 'El nombre de la jornada no es valido.';
  end if;

  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    raise exception 'La zona horaria no es valida.';
  end if;

  if coalesce(p_late_tolerance_minutes, -1) not between 0 and 1440
    or coalesce(p_early_checkin_minutes, -1) not between 0 and 1440
    or coalesce(p_early_departure_tolerance_minutes, -1) not between 0 and 1440
    or coalesce(p_reentry_delay_minutes, -1) not between 0 and 1440 then
    raise exception 'Las tolerancias deben estar entre 0 y 1440 minutos.';
  end if;

  if coalesce(p_max_sessions_per_day, -1) not between 1 and 10 then
    raise exception 'Las sesiones diarias deben estar entre 1 y 10.';
  end if;

  if p_days is null
    or jsonb_typeof(p_days) <> 'array'
    or jsonb_array_length(p_days) = 0 then
    raise exception 'Debe configurar al menos un dia laboral.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_days) as day(
      day_of_week integer,
      start_time text,
      end_time text,
      unpaid_break_minutes integer
    )
    where coalesce(day.day_of_week, -1) not between 0 and 6
      or coalesce(day.start_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(day.end_time, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(day.unpaid_break_minutes, 0) not between 0 and 1440
  ) then
    raise exception 'Uno de los dias tiene un horario invalido.';
  end if;

  if exists (
    select day.day_of_week
    from jsonb_to_recordset(p_days) as day(
      day_of_week integer,
      start_time text,
      end_time text,
      unpaid_break_minutes integer
    )
    group by day.day_of_week
    having count(*) > 1
  ) then
    raise exception 'No se puede repetir un dia laboral.';
  end if;

  select day.start_time::time, day.end_time::time
  into v_first_start, v_first_end
  from jsonb_to_recordset(p_days) as day(
    day_of_week integer,
    start_time text,
    end_time text,
    unpaid_break_minutes integer
  )
  order by day.day_of_week
  limit 1;

  if p_shift_id is null then
    insert into public.work_shifts (
      name,
      start_time,
      end_time,
      timezone,
      late_tolerance_minutes,
      early_checkin_minutes,
      early_departure_tolerance_minutes,
      reentry_delay_minutes,
      max_sessions_per_day,
      active
    )
    values (
      trim(p_name),
      v_first_start,
      v_first_end,
      p_timezone,
      p_late_tolerance_minutes,
      p_early_checkin_minutes,
      p_early_departure_tolerance_minutes,
      p_reentry_delay_minutes,
      p_max_sessions_per_day,
      true
    )
    returning id into v_shift_id;
  else
    update public.work_shifts
    set
      name = trim(p_name),
      start_time = v_first_start,
      end_time = v_first_end,
      timezone = p_timezone,
      late_tolerance_minutes = p_late_tolerance_minutes,
      early_checkin_minutes = p_early_checkin_minutes,
      early_departure_tolerance_minutes = p_early_departure_tolerance_minutes,
      reentry_delay_minutes = p_reentry_delay_minutes,
      max_sessions_per_day = p_max_sessions_per_day
    where id = p_shift_id
    returning id into v_shift_id;

    if v_shift_id is null then
      raise exception 'La jornada no existe.';
    end if;

    delete from public.work_shift_days where work_shift_id = v_shift_id;
  end if;

  insert into public.work_shift_days (
    work_shift_id,
    day_of_week,
    start_time,
    end_time,
    unpaid_break_minutes
  )
  select
    v_shift_id,
    day.day_of_week,
    day.start_time::time,
    day.end_time::time,
    coalesce(day.unpaid_break_minutes, 0)
  from jsonb_to_recordset(p_days) as day(
    day_of_week integer,
    start_time text,
    end_time text,
    unpaid_break_minutes integer
  );

  return v_shift_id;
end;
$$;

revoke all on function public.save_work_shift(
  uuid, text, text, integer, integer, integer, integer, integer, jsonb
) from public, anon;

grant execute on function public.save_work_shift(
  uuid, text, text, integer, integer, integer, integer, integer, jsonb
) to authenticated;
