# ZOO Asistencias - Checklist de avance

Este checklist resume el estado real del proyecto contra `context.md`.

## Estado actual

- [x] Proyecto en Next.js, React y TypeScript.
- [x] Login conectado a Supabase Auth.
- [x] Sesion SSR con cookies de Supabase.
- [x] Rutas API protegidas con usuario autenticado.
- [x] Registro basico de entrada y salida.
- [x] Captura de fotografia desde UI.
- [x] Upload de fotos a Supabase Storage desde servidor.
- [x] Migracion SQL creada para el modelo productivo de asistencia.
- [x] RLS incluido en la migracion nueva.
- [x] Bucket privado `attendance-photos` incluido en migracion.
- [x] Vista de totales semanales incluida en migracion.
- [x] Build, lint y TypeScript pasan.

## Brecha principal

La app ya no consulta en runtime las tablas prototipo:

- `users`
- `attendance`
- `employee_shifts`
- `work_shifts`

La migracion nueva ya define el modelo correcto:

- `employees`
- `work_shifts`
- `work_shift_days`
- `employee_shift_assignments`
- `employee_absences`
- `attendance_sessions`
- vistas administrativas
- funciones `clock_in` y `clock_out`

La migracion `20260915150000_phase_one_data_alignment.sql` ya fue ejecutada y
copia los datos anteriores al modelo nuevo. Las tablas anteriores se conservan
temporalmente para verificar la informacion antes de retirarlas fisicamente.

## Variables de entorno

- [x] `NEXT_PUBLIC_SUPABASE_URL`
- [x] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [x] `SUPABASE_SECRET_KEY`
- [ ] `CRON_SECRET`

`SUPABASE_SECRET_KEY` solo debe usarse en servidor. Nunca debe tener prefijo `NEXT_PUBLIC_`.
No es necesaria para marcar asistencia: las fotos se suben con la sesion autenticada.
Se necesita en la fase administrativa para crear usuarios con contraseña temporal.

## Base de datos

- [x] Crear migracion productiva.
- [x] Mantener historial aunque empleados queden inactivos.
- [x] Separar estado laboral de ausencias por periodo.
- [x] Permitir varias sesiones de entrada/salida por dia.
- [x] Configurar espera para nueva entrada con `reentry_delay_minutes`.
- [x] Calcular `worked_minutes`.
- [x] Vista `attendance_weekly_totals`.
- [x] Ejecutar migracion en el proyecto remoto final.
- [ ] Crear primer admin en `employees`.
- [x] Crear migracion idempotente de datos prototipo.
- [x] Eliminar dependencia de tablas prototipo en repositorios.
- [x] Ejecutar migracion de flujo `20260916100000_attendance_workflow.sql`.
- [ ] Ejecutar migracion administrativa `20260916140000_employee_management.sql`.
- [ ] Ejecutar migracion de jornadas `20260916170000_work_shift_management.sql`.
- [ ] Ejecutar migracion de geolocalizacion `20260916190000_attendance_geolocation.sql`.
- [ ] Ejecutar migracion de retencion de fotos `20260917090000_attendance_photo_retention.sql`.
- [ ] Ejecutar migracion de auditoria `20260917120000_admin_audit_log.sql`.
- [x] Agregar auditoria de cambios administrativos.
- [x] Agregar politica de retencion de fotos.

## Auth y autorizacion

- [x] Login real con Supabase Auth.
- [x] Logout real con Supabase Auth.
- [x] Usuario actual desde Supabase.
- [x] Rol y estado consultados desde `employees`, no desde metadata del cliente.
- [x] Asociar cada `auth.users.id` con `employees.auth_user_id`.
- [x] Redireccion por rol: admin a panel admin, empleado a asistencia.
- [x] Bloquear rutas y APIs admin a empleados desde servidor.
- [x] Unificar roles finales: `admin` y `employee`.
- [x] Crear helpers `requireAdmin` y `requireEmployee`.
- [x] Usar `employees.role` como fuente unica del rol.

## Empleados

- [x] Reemplazar datos semilla de empleados.
- [x] Listar empleados desde `employees`.
- [x] Crear empleado desde admin.
- [ ] Invitar empleado por correo con Supabase Auth.
- [x] Crear cuenta de Supabase Auth con contraseña temporal.
- [x] Obligar cambio de contraseña en el primer ingreso.
- [x] Activar empleado.
- [x] Desactivar empleado sin borrar historial.
- [x] Registrar vacaciones y permisos por periodo.
- [x] Mostrar estado efectivo: activo, inactivo, vacaciones o permiso.
- [x] Evitar asistencia si el empleado esta inactivo, de vacaciones o con permiso.
- [x] Manejar correo duplicado.
- [x] Manejar usuario sin empleado asociado.

## Jornadas

- [x] Migracion soporta jornadas configurables.
- [x] Migracion soporta dias de jornada.
- [x] Migracion soporta jornadas que cruzan medianoche usando timestamps.
- [x] UI admin para crear y editar jornadas.
- [x] UI admin para asignar jornada a empleado.
- [x] Mostrar jornada actual del empleado desde el modelo nuevo.
- [x] Configurar dias y horarios diferentes por jornada.
- [x] Configurar tolerancias, reingreso y sesiones maximas.
- [x] Activar y desactivar jornadas sin borrar historial.
- [x] Advertir antes de desactivar jornadas con empleados asignados.
- [ ] Respetar descanso no pagado si el cliente lo requiere.

## Asistencia

- [x] Registro basico de entrada.
- [x] Registro basico de salida.
- [x] Captura de fotografia.
- [x] Guardado de path de fotografia.
- [x] Calculo basico de minutos trabajados.
- [x] Prevencion basica de salida sin entrada.
- [x] Prevencion de mas de una sesion abierta por empleado desde DB.
- [x] Cambiar registro a RPC `clock_in` y `clock_out`.
- [x] Usar hora oficial de base de datos, no reloj del navegador.
- [x] Permitir multiples sesiones por dia segun DB.
- [x] Mostrar "jornada completa" hasta `next_allowed_check_in_at`.
- [x] Evitar doble clic desde DB con constraints/RPC.
- [x] Guardar observaciones separadas de entrada y salida.
- [x] Detectar salidas anticipadas con tolerancia configurable.
- [x] Guardar latitud, longitud y distancia.
- [x] Validar ubicacion del lado servidor.
- [x] Usar timestamps completos para entrada y salida.
- [x] Soportar correctamente jornadas nocturnas.
- [x] Manejar fotos huerfanas si falla el insert.

## Ubicacion

- [x] Crear tabla/configuracion de ubicaciones autorizadas.
- [x] Capturar ubicacion en el navegador.
- [x] Manejar permiso de GPS denegado.
- [x] Manejar GPS apagado/no disponible.
- [x] Calcular distancia con Haversine.
- [x] Validar radio permitido en servidor o DB.
- [x] Guardar distancia de entrada y salida.
- [x] Mostrar error claro si esta fuera del radio.

## Fotografias

- [x] Captura desde camara.
- [x] Upload a Supabase Storage.
- [x] Bucket privado en migracion.
- [x] Usar estructura final de paths por empleado/fecha/asistencia.
- [x] Generar signed URLs temporales para admin.
- [x] No exponer fotos de otros empleados.
- [x] Eliminar archivos mayores a 20 dias.
- [x] Mantener registro historico aunque la foto se elimine.
- [x] Registrar fecha de eliminacion por entrada y salida.

## Admin

- [x] Reducir navegacion a dos vistas principales: asistencia y admin.
- [x] Crear ruta `/admin`.
- [x] Consolidar accesos a empleados, jornadas y reportes desde admin.
- [x] Ver empleados activos/inactivos/vacaciones/permiso.
- [x] Ver asistencia del dia.
- [x] Ver fotos vigentes con enlaces temporales.
- [x] Ver horas trabajadas por semana.
- [x] Ver historial por empleado.
- [x] Editar estado laboral.
- [x] Administrar jornadas.
- [x] Crear usuarios con acceso temporal.
- [x] Consultar historial inmutable de cambios administrativos.

## Vista empleado

- [x] Pantalla de asistencia existe.
- [x] Camara integrada.
- [ ] Quitar informacion de otros empleados de la vista empleado.
- [ ] Mostrar solo su estado, jornada y accion actual.
- [x] Mostrar mensaje claro de entrada/salida.
- [x] Mostrar horas trabajadas al salir.
- [ ] Mostrar bloqueo por estado laboral.
- [x] Mostrar bloqueo por espera configurable.

## Reportes

- [x] Vista de reportes prototipo.
- [x] Vista SQL para total semanal.
- [x] Conectar reportes al modelo nuevo.
- [x] Filtro por rango semanal o personalizado.
- [x] Filtro por empleado.
- [x] Filtro por departamento.
- [x] Filtro por jornada.
- [x] Filtro por estado de asistencia.
- [x] Rangos rapidos semanal, semana anterior y mensual.
- [x] Desglose semanal de lunes a domingo por empleado.
- [x] Historial paginado sin corte silencioso de 1,000 registros.
- [x] Observaciones, ubicacion y estado de evidencia en el historial.
- [x] Exportacion CSV.

## Seguridad

- [x] No hay passwords propios.
- [x] Secret key no va al frontend.
- [x] RLS propuesta en migracion.
- [ ] Probar RLS con usuario admin y empleado.
- [ ] Probar que empleado no lea otros empleados.
- [ ] Probar que empleado no lea fotos ajenas.
- [ ] Revisar que service role solo se use en server.
- [ ] Agregar errores publicos seguros.

## Validaciones antes de PR

- [x] `npx tsc --noEmit`
- [x] `npm run lint`
- [x] `npm run build`
- [ ] Prueba manual login admin.
- [x] Prueba manual login empleado.
- [x] Prueba manual entrada con foto.
- [x] Prueba manual salida con foto.
- [ ] Prueba manual empleado sin jornada.
- [ ] Prueba manual empleado inactivo/vacaciones/permiso.

## Prioridad recomendada

1. Conectar `auth.users` con `employees`.
2. Crear `requireAdmin` y proteger rutas admin.
3. Migrar repositorios a `employees` y `attendance_sessions`.
4. Cambiar asistencia a `clock_in` y `clock_out`.
5. Simplificar UI a `/asistencia` y `/admin`.
6. Crear CRUD admin minimo de empleados y jornadas.
7. Agregar geolocalizacion y validacion de radio.
8. Agregar signed URLs y retencion de fotos.
9. Agregar auditoria.
10. Pulir reportes.

## Modelo Codex recomendado

| Trabajo | Modelo recomendado | Calidad | Tiempo | Tokens/costo | Uso |
| --- | --- | --- | --- | --- | --- |
| Bugs pequeños, lint, copy, checklist | Codex Mini | Media | Rapido | Bajo | Ideal para tareas mecanicas y de bajo riesgo. |
| Implementar una pantalla o endpoint acotado | Codex estandar | Alta | Medio | Medio | Mejor balance para avanzar sin gastar demasiado. |
| DB/RLS/auth/admin completo | Codex estandar con razonamiento medio/alto | Alta | Medio/alto | Medio/alto | Usar cuando toca seguridad o datos historicos. |
| Refactor grande o migracion completa end-to-end | Codex Max | Muy alta | Mas lento | Alto | Usar solo cuando quieras que resuelva una fase grande con poca supervision. |

Recomendacion practica para este proyecto: usar modelo balanceado/estandar para la mayoria del desarrollo, subir razonamiento solo en DB/RLS/auth, y usar Mini para revisiones simples o tareas repetitivas.
