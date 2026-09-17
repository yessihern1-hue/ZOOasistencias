# ZOO Asistencias

Sistema web de control de asistencia para registrar entradas y salidas con fotografía y geolocalización, administrar colaboradores y jornadas, consultar horas trabajadas y mantener trazabilidad administrativa.

El proyecto utiliza Next.js como aplicación web y Backend for Frontend, Supabase Auth para identidad, PostgreSQL para las reglas críticas y Supabase Storage para las evidencias fotográficas.

## Funcionalidades

### Empleados

- Inicio y cierre de sesión con Supabase Auth.
- Cambio obligatorio de la contraseña temporal en el primer ingreso.
- Vista exclusiva para registrar entradas y salidas.
- Captura de fotografía desde la cámara.
- Captura de ubicación mediante el navegador.
- Validación del radio autorizado desde PostgreSQL.
- Varias sesiones por día según la jornada asignada.
- Espera configurable antes de permitir un nuevo ingreso.
- Hora oficial obtenida del servidor.

### Administración

- Dashboard general de asistencia.
- Creación de cuentas con contraseña temporal.
- Activación y desactivación de colaboradores.
- Roles `admin` y `employee`.
- Estados activo, inactivo, vacaciones y permiso.
- Asignación de jornadas.
- Configuración de horarios por día, tolerancias y sesiones máximas.
- Configuración de una o varias ubicaciones autorizadas.
- Reportes semanales, mensuales y personalizados.
- Fotografías mediante enlaces firmados temporales.
- Auditoría inmutable de cambios administrativos.

## Tecnologías

- Next.js 16 con App Router y Route Handlers.
- React 19 y TypeScript.
- Supabase Auth.
- Supabase PostgreSQL con Row Level Security.
- Supabase Storage privado.
- Vercel Cron para retención de fotografías.

## Requisitos

- Node.js 20 o superior.
- npm.
- Un proyecto de Supabase.
- Una cuenta de Vercel si se desea ejecutar automáticamente la retención de fotografías.

## Instalación local

```bash
git clone git@github.com:yessihern1-hue/ZOOasistencias.git
cd ZOOasistencias
npm install
cp .env.example .env.local
npm run dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

La cámara y la geolocalización funcionan en `localhost`. Cualquier despliegue remoto debe utilizar HTTPS.

## Variables de entorno

| Variable | Exposición | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente y servidor | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente y servidor | Clave pública actual de Supabase. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente y servidor | Alternativa para proyectos que todavía utilizan la clave `anon`. |
| `SUPABASE_SECRET_KEY` | Solo servidor | Administración de usuarios, auditoría y retención de fotografías. |
| `CRON_SECRET` | Solo servidor | Protege el endpoint que ejecuta la retención diaria. |

Ejemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
SUPABASE_SECRET_KEY=sb_secret_xxx
CRON_SECRET=un_secreto_aleatorio_de_al_menos_16_caracteres
```

Nunca agregues `NEXT_PUBLIC_` a la clave secreta o al secreto del cron. `.env.local` está excluido de Git.

Para generar un secreto para el cron:

```bash
openssl rand -hex 32
```

## Base de datos

Las migraciones deben ejecutarse en este orden:

1. `20260915120000_attendance_redesign.sql`: modelo productivo, RLS, Storage y funciones base.
2. `20260915150000_phase_one_data_alignment.sql`: copia datos de las tablas prototipo.
3. `20260916100000_attendance_workflow.sql`: flujo autoritativo de entradas, salidas y reingresos.
4. `20260916140000_employee_management.sql`: estados efectivos y cambio obligatorio de contraseña.
5. `20260916170000_work_shift_management.sql`: administración transaccional de jornadas.
6. `20260916190000_attendance_geolocation.sql`: ubicaciones, Haversine y geocerca.
7. `20260917090000_attendance_photo_retention.sql`: paths definitivos y trazabilidad de retención.
8. `20260917120000_admin_audit_log.sql`: auditoría administrativa inmutable.

Con Supabase CLI:

```bash
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

También se pueden ejecutar individualmente, en el mismo orden, desde el SQL Editor de Supabase.

### Tablas principales

| Tabla | Responsabilidad |
| --- | --- |
| `employees` | Perfil, rol, estado laboral y relación con `auth.users`. |
| `work_shifts` | Reglas generales de las jornadas. |
| `work_shift_days` | Horario de cada día de una jornada. |
| `employee_shift_assignments` | Historial de jornadas asignadas. |
| `employee_absences` | Vacaciones y permisos por período. |
| `attendance_locations` | Sedes y radios autorizados. |
| `attendance_sessions` | Entradas, salidas, horas, fotografías, observaciones y ubicación. |
| `admin_audit_logs` | Cambios administrativos inmutables. |

Las tablas prototipo `users`, `attendance` y `employee_shifts` pueden permanecer temporalmente para verificar la migración, pero la aplicación ya no depende de ellas.

## Crear el primer administrador

1. Crea el usuario desde **Supabase Authentication → Users**.
2. Copia su UUID.
3. Ejecuta:

```sql
insert into public.employees (
  auth_user_id,
  full_name,
  email,
  role,
  employment_status,
  must_change_password
)
values (
  'UUID_DEL_USUARIO_AUTH',
  'Administrador',
  'admin@empresa.com',
  'admin',
  'active',
  false
);
```

Después de este paso, los siguientes colaboradores pueden crearse desde `/colaboradores`.

## Roles y autorización

La fuente única del rol es `employees.role`, no el metadata enviado por el navegador.

- `admin`: accede al panel, colaboradores, jornadas, ubicaciones, reportes, auditoría y asistencia.
- `employee`: accede únicamente a su pantalla de asistencia.

Las páginas utilizan `requireUser`, `requireAdmin` o `requireEmployee`. Las APIs vuelven a validar sesión, rol y cambio obligatorio de contraseña. PostgreSQL aplica RLS como una segunda barrera.

## Flujo de autenticación

1. El usuario inicia sesión con correo y contraseña.
2. Supabase crea la sesión y Next.js la conserva en cookies HTTP-only.
3. El servidor busca el perfil mediante `employees.auth_user_id`.
4. Un usuario inactivo o sin perfil no puede ingresar.
5. Si `must_change_password` está activo, se redirige a `/cambiar-password`.
6. El administrador entra a `/admin`; el empleado entra a `/asistencia`.

## Flujo de asistencia

1. El empleado captura una fotografía.
2. Al confirmar, el navegador solicita una ubicación GPS actual.
3. La API valida el cuerpo y sube la evidencia al bucket privado.
4. La función PostgreSQL identifica al empleado, su ausencia vigente y su jornada.
5. PostgreSQL busca la sede activa más cercana y calcula la distancia con Haversine.
6. El registro se rechaza si está fuera del radio autorizado.
7. La hora, ubicación, precisión, distancia y fotografía se guardan en `attendance_sessions`.
8. Al salir se repiten la fotografía y la validación de ubicación.
9. PostgreSQL calcula `worked_minutes`, salida anticipada y próxima entrada permitida.

Las funciones de base de datos utilizan bloqueo transaccional y restricciones para evitar dobles clics, dos sesiones abiertas o salidas sin entrada.

## Jornadas

Una jornada configura:

- Días laborales.
- Hora de entrada y salida por día.
- Horarios nocturnos que terminan al día siguiente.
- Tolerancia de llegada tarde.
- Entrada anticipada permitida.
- Tolerancia de salida anticipada.
- Espera antes de un reingreso.
- Máximo de sesiones por día.
- Zona horaria.

Las jornadas se desactivan sin eliminar el historial. La aplicación advierte cuando existen colaboradores asignados.

## Ubicaciones

Desde `/ubicaciones` un administrador puede crear varias sedes, capturar las coordenadas actuales y configurar el radio permitido.

La decisión de permitir o denegar asistencia ocurre dentro de PostgreSQL. Las coordenadas enviadas por React no se consideran una validación suficiente por sí solas.

## Fotografías y privacidad

- Bucket privado: `attendance-photos`.
- Path: `empleado/año/mes/sesion/check-in.webp` o `check-out.webp`.
- Tamaño máximo aceptado: 5 MB.
- Captura reducida a un máximo de 1280 px y codificada como WebP.
- Solo administradores pueden solicitar enlaces firmados.
- Los enlaces expiran en 5 minutos.
- Los empleados no pueden leer fotografías ajenas mediante RLS.
- Si falla el registro después del upload, el servidor intenta eliminar el archivo huérfano.

### Retención

`vercel.json` ejecuta diariamente:

```text
GET /api/internal/maintenance/photos
```

La tarea está protegida por `Authorization: Bearer <CRON_SECRET>`. Elimina archivos con más de 20 días, establece `check_in_photo_deleted_at` o `check_out_photo_deleted_at` y conserva el registro completo de asistencia.

La programación `15 8 * * *` corresponde a las 08:15 UTC, aproximadamente 02:15 en Guatemala.

## Reportes

`/reportes` permite:

- Semana actual, semana anterior, mes actual o rango personalizado de hasta 92 días.
- Filtros por colaborador, departamento, jornada y estado.
- Desglose semanal de lunes a domingo.
- Horas, sesiones, tardanzas y salidas anticipadas por colaborador.
- Historial paginado con observaciones, ubicación y evidencia.
- Exportación CSV.
- Consulta de más de 1,000 sesiones mediante paginación contra Supabase.

## Auditoría

`/auditoria` registra eventos lógicos de:

- Creación y edición de colaboradores.
- Cambios de rol, estado, ausencia y jornada asignada.
- Creación, edición, activación o desactivación de jornadas.
- Creación, edición, activación o desactivación de ubicaciones.

Cada evento conserva responsable, fecha, entidad y valores anteriores/nuevos. Las contraseñas temporales, tokens y secretos nunca se incluyen. Los usuarios autenticados solo tienen permiso de lectura y un trigger impide actualizar o borrar los eventos.

## Rutas de interfaz

| Ruta | Acceso | Uso |
| --- | --- | --- |
| `/login` | Público | Inicio de sesión. |
| `/cambiar-password` | Usuario autenticado pendiente | Reemplazo de contraseña temporal. |
| `/asistencia` | Empleado y admin | Entrada y salida. |
| `/admin` | Admin | Dashboard y accesos administrativos. |
| `/colaboradores` | Admin | Usuarios, roles, estados, ausencias y asignaciones. |
| `/jornadas` | Admin | Configuración de jornadas. |
| `/ubicaciones` | Admin | Geocercas autorizadas. |
| `/reportes` | Admin | Historial y totales. |
| `/auditoria` | Admin | Trazabilidad administrativa. |

## API

| Método | Ruta | Autorización | Uso |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Público | Iniciar sesión. |
| `POST` | `/api/v1/auth/logout` | Usuario | Cerrar sesión. |
| `GET` | `/api/v1/auth/session` | Usuario | Consultar sesión. |
| `POST` | `/api/v1/auth/change-password` | Usuario pendiente | Cambiar contraseña temporal. |
| `GET`, `POST` | `/api/v1/attendance` | Usuario | Consultar o registrar asistencia. |
| `GET` | `/api/v1/attendance/[id]/photos` | Admin | Generar signed URLs. |
| `GET`, `POST` | `/api/v1/employees` | Admin | Listar o crear colaboradores. |
| `PATCH` | `/api/v1/employees/[id]` | Admin | Editar colaborador. |
| `GET`, `POST` | `/api/v1/work-shifts` | Admin | Listar o crear jornadas. |
| `PUT`, `PATCH` | `/api/v1/work-shifts/[id]` | Admin | Editar o activar/desactivar jornada. |
| `GET`, `POST` | `/api/v1/attendance-locations` | Admin | Listar o crear ubicaciones. |
| `PUT`, `PATCH` | `/api/v1/attendance-locations/[id]` | Admin | Editar o activar/desactivar ubicación. |
| `GET` | `/api/v1/reports` | Admin | Generar reporte filtrado. |
| `GET` | `/api/v1/dashboard` | Admin | Consultar indicadores. |
| `GET` | `/api/internal/maintenance/photos` | Cron secret | Ejecutar retención. |

## Arquitectura del código

```text
app/
├── (auth)/                 # Login y cambio de contraseña
├── (portal)/               # Páginas protegidas
└── api/                    # Route Handlers

features/
├── attendance/             # UI y contratos de asistencia
├── audit/                  # Vista y contratos de auditoría
├── auth/                   # Formularios y navegación por rol
├── dashboard/              # Panel administrativo
├── employees/              # Administración de colaboradores
├── locations/              # Administración de geocercas
├── reports/                # Reportes y exportación
├── shifts/                 # Administración de jornadas
└── shared/                 # Componentes reutilizables

server/
├── attendance/             # Reglas y acceso a sesiones
├── audit/                  # Escritura segura y lectura de auditoría
├── auth/                   # DAL y resolución de identidad
├── dashboard/              # Indicadores
├── employees/              # Gestión de Auth y perfiles
├── locations/              # Geocercas
├── reports/                # Agregaciones y filtros
├── shifts/                 # Jornadas
├── storage/                # Evidencias y retención
└── supabase/               # Clientes SSR, admin y renovación de cookies

supabase/migrations/        # Esquema y evolución de PostgreSQL
```

La dirección de dependencias es:

```text
Página o componente → Route Handler/servicio → repositorio → Supabase
```

Las páginas del servidor llaman servicios directamente. Los componentes cliente utilizan `/api/v1/*` para las operaciones interactivas.

## Validación y comandos

```bash
npx tsc --noEmit
npm run lint
npm run build
npm start
```

## Checklist mínimo de QA

### Autenticación

- Login de administrador y empleado.
- Usuario inexistente en `employees`.
- Usuario inactivo.
- Cambio obligatorio de contraseña temporal.
- Protección de rutas administrativas con un empleado.

### Asistencia

- Entrada y salida con foto y GPS.
- Permiso de cámara denegado.
- Permiso de ubicación denegado.
- Registro dentro y fuera del radio.
- Doble clic y dos pestañas.
- Reingreso antes y después de la espera.
- Máximo de sesiones diario.
- Empleado sin jornada, inactivo, de vacaciones o con permiso.
- Jornada nocturna.

### Administración

- Crear colaborador y utilizar la contraseña temporal.
- Editar rol, estado, ausencia y jornada.
- Crear, editar y desactivar jornadas.
- Crear, editar y desactivar ubicaciones.
- Comprobar que siempre permanezca un admin y una ubicación activa.
- Verificar los eventos generados en auditoría.

### Reportes y privacidad

- Total semanal de lunes a domingo.
- Filtros y CSV.
- Signed URLs y expiración.
- Empleado intentando leer asistencia o fotos ajenas.
- Retención con cero archivos y con fotografías vencidas.
- Permanencia del historial después de eliminar una fotografía.

## Despliegue

1. Configura las cuatro variables en Vercel.
2. Ejecuta todas las migraciones en Supabase.
3. Verifica que `attendance-photos` sea privado.
4. Despliega la rama integrada en producción.
5. Confirma la aparición del cron en **Vercel → Settings → Cron Jobs**.
6. Realiza las pruebas de humo de login, asistencia y panel admin.

## Estado del proyecto

Las fases funcionales 1–10 están implementadas. La entrega está lista para la ronda completa de QA. El seguimiento detallado de validaciones manuales y pendientes no bloqueantes se encuentra en [`README_CHECKLIST.md`](./README_CHECKLIST.md).
