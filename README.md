# ZOO Asistencias

Aplicación web modular para registrar entradas y salidas, consultar el estado del equipo y visualizar reportes. El proyecto usa Next.js 16 como frontend y como Backend for Frontend (BFF), con límites claros entre interfaz, reglas de negocio y acceso a datos.

## Ejecutar el proyecto

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) e inicia sesión con:

```text
Correo: admin@zoo.com
Contraseña: demo123
```

Para validar una entrega:

```bash
npm run lint
npm run build
npm start
```

`SESSION_SECRET` es obligatorio en producción. Genera uno seguro, por ejemplo con `openssl rand -base64 32`, y configúralo en las variables del proveedor donde despliegues la aplicación.

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
├── auth/                       # Autenticación, firma de sesión y DAL
├── attendance/                 # Servicio y repositorio de asistencia
├── dashboard/                  # Agregación de indicadores
├── employees/                  # Servicio y repositorio de colaboradores
└── shared/                     # Utilidades exclusivas del servidor
```

### Cómo fluye una solicitud

1. Una página en `app` valida la sesión y obtiene datos directamente de un servicio de `server`.
2. Un componente interactivo en `features` llama a `/api/v1/*` cuando necesita mutar o refrescar información desde el navegador.
3. El Route Handler vuelve a validar la sesión y el cuerpo de la solicitud.
4. El servicio aplica las reglas del negocio y usa un repositorio.
5. El repositorio actual puede reemplazarse por PostgreSQL, MySQL u otro proveedor sin reescribir las vistas.

Las páginas del servidor no llaman a la API interna: consultan el servicio directamente para evitar un salto HTTP innecesario. Los endpoints siguen existiendo para los componentes del navegador y para integraciones futuras.

## Estado actual y siguiente paso para producción

Esta entrega es un prototipo funcional. La asistencia se conserva en memoria mientras el servidor está activo y los colaboradores son datos semilla. Antes de usarla con datos reales se debe:

1. Conectar una base de datos y crear tablas para usuarios, colaboradores, horarios, asistencias y sesiones.
2. Sustituir la cuenta demo por un proveedor de autenticación o contraseñas con hash seguro.
3. Agregar roles y permisos detallados para administración, supervisión y colaboradores.
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
