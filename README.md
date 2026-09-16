# ZOO Asistencias

Aplicación web modular para registrar entradas y salidas, consultar el estado del equipo y visualizar reportes. El proyecto usa Next.js 16 como frontend y como Backend for Frontend (BFF), con límites claros entre interfaz, reglas de negocio y acceso a datos.

## Ejecutar el proyecto

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con un usuario
creado en **Supabase Authentication → Users**.

Para validar una entrega:

```bash
npm run lint
npm run build
npm start
```

La aplicación usa estas variables:

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave pública `publishable` de Supabase. También se admite `NEXT_PUBLIC_SUPABASE_ANON_KEY` para proyectos anteriores. |
| `SUPABASE_SECRET_KEY` | Clave secreta solo para acciones administrativas del servidor, como invitar o crear usuarios. No debe usarse en componentes cliente. |

Los valores de Supabase se encuentran en la configuración API del proyecto. Después de modificar `.env.local`, reinicia `npm run dev` para que Next.js cargue los cambios.

El inicio de sesión usa Supabase Auth con correo y contraseña. El nombre visible
se toma de `user_metadata.full_name` (o `user_metadata.name`). El rol se toma
exclusivamente de `app_metadata.role` y admite `admin`, `supervisor` o
`collaborator`; si no existe, se asigna `collaborator`.

## Base de datos

La migración principal está en `supabase/migrations/20260915120000_attendance_redesign.sql`.
El modelo nuevo deja las tablas prototipo intactas y agrega:

- `employees`: perfil interno del empleado, vinculado opcionalmente a `auth.users`.
- `work_shifts` y `work_shift_days`: jornadas configurables por día, tolerancia, espera para nueva entrada y máximo de sesiones.
- `employee_shift_assignments`: asignación vigente de jornada por empleado.
- `employee_absences`: vacaciones y permisos con aprobación.
- `attendance_sessions`: ciclos de entrada/salida; permite varias sesiones al día.
- Vistas `employee_effective_status`, `attendance_daily_overview` y `attendance_weekly_totals`.
- Funciones `clock_in(photo_path, observation)` y `clock_out(photo_path, observation)` para registrar asistencia desde la base.

Para aplicarla con Supabase CLI:

```bash
supabase db push
```

Después de aplicar la migración, crea el primer registro admin desde SQL Editor o
desde un script de servidor con la secret key. Ese primer admin permite gestionar
empleados desde la app:

```sql
insert into public.employees (auth_user_id, full_name, email, role)
values (
  'UUID_DEL_USUARIO_EN_AUTH',
  'Administrador',
  'admin@empresa.com',
  'admin'
);
```

Las fotos de asistencia se guardan como archivos en el bucket privado
`attendance-photos`; la tabla solo conserva el path.

## Arquitectura

```text
app/
├── (auth)/login/               # Vista pública de inicio de sesión
├── (portal)/                   # Vistas protegidas y layout de la aplicación
│   ├── dashboard/              # Resumen general
│   ├── asistencia/             # Entrada/salida y registros del día
│   ├── colaboradores/          # Directorio del equipo
│   └── reportes/               # Indicadores y tendencias
└── api/v1/                     # Endpoints HTTP públicos del BFF
    ├── auth/                   # Login, logout y sesión
    ├── attendance/             # Consulta y mutación de asistencia
    ├── dashboard/              # Datos del resumen
    └── employees/              # Consulta de colaboradores

features/
├── auth/                       # Componentes y tipos de autenticación
├── attendance/                 # UI interactiva y contratos de asistencia
├── dashboard/                  # Vista del resumen
├── employees/                  # Vista y contratos del equipo
├── layout/                     # Navegación y shell responsivo
├── reports/                    # Vista de reportes
└── shared/                     # Componentes visuales reutilizables

server/
├── auth/                       # Supabase Auth, usuario de sesión y DAL
├── attendance/                 # Servicio y repositorio de asistencia
├── dashboard/                  # Agregación de indicadores
├── employees/                  # Servicio y repositorio de colaboradores
├── supabase/                   # Cliente SSR y renovación de sesión
└── shared/                     # Utilidades exclusivas del servidor
```

### Cómo fluye una solicitud

1. Una página en `app` valida la sesión y obtiene datos directamente de un servicio de `server`.
2. Un componente interactivo en `features` llama a `/api/v1/*` cuando necesita mutar o refrescar información desde el navegador.
3. El Route Handler vuelve a validar la sesión y el cuerpo de la solicitud.
4. El servicio aplica las reglas del negocio y usa un repositorio.
5. El repositorio consulta Supabase con la identidad del usuario para aplicar las políticas RLS.

Las páginas del servidor no llaman a la API interna: consultan el servicio directamente para evitar un salto HTTP innecesario. Los endpoints siguen existiendo para los componentes del navegador y para integraciones futuras.

## Estado actual y siguiente paso para producción

Esta entrega es un prototipo funcional. La autenticación ya usa Supabase y el
esquema productivo de asistencia quedó versionado en migración; falta conectar la
interfaz a las nuevas tablas y funciones. Antes de usarla con datos reales se debe:

1. Migrar o descartar las tablas prototipo (`users`, `attendance`, `employee_shifts`, `work_shifts`) cuando ya no se necesiten.
2. Conectar los repositorios a `employees`, `attendance_sessions` y las funciones `clock_in/clock_out`.
3. Reducir la navegación a dos vistas: asistencia del empleado y panel admin.
4. Implementar invitación/creación de usuarios desde servidor con `SUPABASE_SECRET_KEY`.
5. Añadir pruebas automatizadas y auditoría de cambios administrativos.

La separación `servicio → repositorio` ya deja preparado ese cambio: la interfaz no depende del almacenamiento de demostración.

## Endpoints disponibles

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/api/v1/auth/login` | Crear sesión |
| `POST` | `/api/v1/auth/logout` | Cerrar sesión |
| `GET` | `/api/v1/auth/session` | Consultar usuario actual |
| `GET`, `POST` | `/api/v1/attendance` | Consultar o registrar entrada/salida |
| `GET` | `/api/v1/dashboard` | Obtener el resumen |
| `GET` | `/api/v1/employees` | Obtener colaboradores |

Todos los endpoints, salvo `login`, exigen una cookie de sesión válida. Las mutaciones validan el tipo de contenido, el cuerpo y las reglas de asistencia en el servidor.
