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

Los valores de Supabase se encuentran en la configuración API del proyecto. Después de modificar `.env.local`, reinicia `npm run dev` para que Next.js cargue los cambios.

El inicio de sesión usa Supabase Auth con correo y contraseña. El nombre visible
se toma de `user_metadata.full_name` (o `user_metadata.name`). El rol se toma
exclusivamente de `app_metadata.role` y admite `admin`, `supervisor` o
`collaborator`; si no existe, se asigna `collaborator`.

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

Esta entrega es un prototipo funcional. La autenticación y la asistencia ya usan
Supabase; los colaboradores y varios indicadores todavía son datos semilla. Antes
de usarla con datos reales se debe:

1. Versionar el esquema y las migraciones de las tablas de perfiles, jornadas y asistencias.
2. Definir políticas RLS para que cada colaborador solo acceda a los registros permitidos.
3. Aplicar autorización por rol en las operaciones administrativas.
4. Añadir pruebas automatizadas, auditoría de cambios y reglas para turnos nocturnos, vacaciones y días festivos.

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
