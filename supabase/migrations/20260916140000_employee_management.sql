-- Phase 4: employee administration and mandatory temporary-password change.

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
  e.updated_at,
  e.must_change_password,
  e.hire_date,
  e.termination_date,
  e.inactive_reason
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

create or replace function public.complete_password_change()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sesion requerida.';
  end if;

  update public.employees
  set must_change_password = false
  where auth_user_id = auth.uid()
    and employment_status = 'active';

  if not found then
    raise exception 'No se encontro un empleado activo para esta cuenta.';
  end if;

  return true;
end;
$$;

revoke all on function public.complete_password_change() from public, anon;
grant execute on function public.complete_password_change() to authenticated;

