-- Phase 1: make the redesigned model the application's only source of truth.
-- The migration is idempotent and preserves legacy data when prototype tables
-- are present. It intentionally does not drop those tables yet, so the copied
-- data can be verified before a later cleanup migration.

-- Preserve prototype employees first so their UUIDs remain stable for related
-- assignments and attendance records.
do $$
begin
  if to_regclass('public.users') is not null then
    insert into public.employees (
      id,
      auth_user_id,
      full_name,
      email,
      role,
      employment_status,
      created_at
    )
    select
      u.id,
      case
        when exists (select 1 from auth.users au where au.id = u.id) then u.id
        else null
      end,
      u.name,
      lower(u.email),
      case
        when lower(coalesce(u.role, '')) = 'admin' then 'admin'::public.employee_role
        else 'employee'::public.employee_role
      end,
      case
        when lower(coalesce(u.employee_status, 'active')) = 'inactive'
          then 'inactive'::public.employment_status
        else 'active'::public.employment_status
      end,
      coalesce(u.created_at, now())
    from public.users u
    where nullif(trim(u.email), '') is not null
      and not exists (
        select 1
        from public.employees e
        where e.id = u.id or lower(e.email) = lower(u.email)
      );

    update public.employees e
    set
      auth_user_id = coalesce(
        e.auth_user_id,
        case
          when exists (select 1 from auth.users au where au.id = u.id) then u.id
          else null
        end
      ),
      full_name = u.name,
      role = case
        when lower(coalesce(u.role, '')) = 'admin' then 'admin'::public.employee_role
        else 'employee'::public.employee_role
      end,
      employment_status = case
        when lower(coalesce(u.employee_status, 'active')) = 'inactive'
          then 'inactive'::public.employment_status
        else 'active'::public.employment_status
      end
    from public.users u
    where e.id = u.id or lower(e.email) = lower(u.email);
  end if;
end;
$$;

-- Every existing Supabase Auth user receives an employee profile. A later
-- admin workflow will control which newly invited users become employees.
insert into public.employees (
  auth_user_id,
  full_name,
  email,
  role,
  employment_status,
  must_change_password,
  created_at
)
select
  au.id,
  coalesce(
    nullif(trim(au.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(au.raw_user_meta_data ->> 'name'), ''),
    split_part(au.email, '@', 1)
  ),
  lower(au.email),
  case
    when lower(coalesce(au.raw_app_meta_data ->> 'role', '')) = 'admin'
      then 'admin'::public.employee_role
    else 'employee'::public.employee_role
  end,
  'active'::public.employment_status,
  false,
  coalesce(au.created_at, now())
from auth.users au
where au.email is not null
  and not exists (
    select 1
    from public.employees e
    where e.auth_user_id = au.id or lower(e.email) = lower(au.email)
  );

-- Link profiles that existed before their Auth account was created.
update public.employees e
set auth_user_id = au.id
from auth.users au
where e.auth_user_id is null
  and au.email is not null
  and lower(e.email) = lower(au.email)
  and not exists (
    select 1 from public.employees linked where linked.auth_user_id = au.id
  );

-- Copy active and historical prototype shift assignments.
do $$
begin
  if to_regclass('public.employee_shifts') is not null then
    insert into public.employee_shift_assignments (
      employee_id,
      work_shift_id,
      start_date,
      end_date,
      active,
      created_at
    )
    select
      e.id,
      legacy.shift_id,
      legacy.start_date,
      legacy.end_date,
      legacy.active,
      coalesce(legacy.created_at, now())
    from public.employee_shifts legacy
    join public.employees e
      on e.id = legacy.user_id or e.auth_user_id = legacy.user_id
    where not exists (
      select 1
      from public.employee_shift_assignments assignment
      where assignment.employee_id = e.id
        and assignment.work_shift_id = legacy.shift_id
        and assignment.start_date = legacy.start_date
        and assignment.end_date is not distinct from legacy.end_date
    );
  end if;
end;
$$;

-- Copy prototype attendance into timestamp-based sessions. The original table
-- allowed one row per day, so every copied row starts with sequence 1.
do $$
begin
  if to_regclass('public.attendance') is not null then
    insert into public.attendance_sessions (
      id,
      employee_id,
      work_shift_id,
      assignment_id,
      work_date,
      session_sequence,
      check_in_at,
      check_out_at,
      check_in_photo_path,
      check_out_photo_path,
      arrival_status,
      session_status,
      observation,
      created_at
    )
    select
      legacy.id,
      e.id,
      legacy.shift_id,
      assignment.id,
      legacy.date,
      1,
      (legacy.date + legacy.check_in) at time zone coalesce(ws.timezone, 'America/Guatemala'),
      case
        when legacy.check_out is null then null
        when legacy.check_out < legacy.check_in then
          ((legacy.date + 1) + legacy.check_out)
            at time zone coalesce(ws.timezone, 'America/Guatemala')
        else
          (legacy.date + legacy.check_out)
            at time zone coalesce(ws.timezone, 'America/Guatemala')
      end,
      legacy.check_in_photo,
      legacy.check_out_photo,
      case
        when lower(coalesce(legacy.status, '')) = 'late'
          then 'late'::public.attendance_arrival_status
        else 'on_time'::public.attendance_arrival_status
      end,
      case
        when legacy.check_out is null
          and legacy.date = (now() at time zone coalesce(ws.timezone, 'America/Guatemala'))::date
          then 'open'::public.attendance_session_status
        when legacy.check_out is null then 'cancelled'::public.attendance_session_status
        else 'completed'::public.attendance_session_status
      end,
      legacy.observation,
      coalesce(legacy.created_at, now())
    from public.attendance legacy
    join public.employees e
      on e.id = legacy.user_id or e.auth_user_id = legacy.user_id
    join public.work_shifts ws on ws.id = legacy.shift_id
    left join lateral (
      select esa.id
      from public.employee_shift_assignments esa
      where esa.employee_id = e.id
        and esa.work_shift_id = legacy.shift_id
        and esa.start_date <= legacy.date
        and (esa.end_date is null or esa.end_date >= legacy.date)
      order by esa.start_date desc
      limit 1
    ) assignment on true
    where legacy.check_in is not null
      and not exists (
        select 1
        from public.attendance_sessions session
        where session.id = legacy.id
          or (session.employee_id = e.id and session.work_date = legacy.date)
      );
  end if;
end;
$$;
