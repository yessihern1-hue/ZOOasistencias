# Sistema de Control de Asistencia

Sistema web para gestionar el registro de asistencia de empleados mediante **Next.js + Supabase**.

El sistema permite que los empleados registren su **entrada y salida**, validando su ubicación y tomando una fotografía como evidencia. Los administradores cuentan con una vista completa para administrar empleados, jornadas, estados laborales y consultar el historial de asistencia y horas trabajadas.

---

# 1. Objetivo del proyecto

Desarrollar un sistema de control de asistencia sencillo, seguro y administrable que permita:

* Autenticación de usuarios.
* Manejo de roles.
* Registro de entrada.
* Registro de salida.
* Captura de fotografía.
* Validación de ubicación.
* Control de empleados.
* Manejo de estados laborales.
* Manejo de diferentes jornadas.
* Historial de asistencias.
* Cálculo de horas trabajadas.
* Total semanal de horas.
* Eliminación automática de fotografías antiguas.
* Conservación del historial aunque un empleado deje de trabajar en la empresa.

---

# 2. Tecnologías

El proyecto utiliza:

* Next.js
* React
* TypeScript
* Supabase
* Supabase Auth
* Supabase PostgreSQL
* Supabase Storage
* Supabase Row Level Security (RLS)
* Vercel para despliegue
* GitHub para control de versiones

---

# 3. Reglas generales para Codex

Antes de realizar cambios en el proyecto:

1. Revisar la estructura existente del proyecto.
2. No crear funcionalidades duplicadas si ya existe una implementación.
3. Mantener la autenticación actual de Supabase.
4. No reemplazar tecnologías existentes sin necesidad.
5. Utilizar TypeScript.
6. Mantener separación entre componentes, servicios, lógica de negocio y acceso a datos.
7. No colocar claves privadas de Supabase en el frontend.
8. Todas las operaciones sensibles deben estar protegidas mediante permisos y RLS.
9. Nunca confiar únicamente en validaciones realizadas desde el navegador.
10. No eliminar registros históricos de empleados o asistencias.
11. Mantener compatibilidad con Vercel.
12. Antes de modificar tablas existentes, revisar sus relaciones y uso actual.
13. Generar migraciones SQL cuando se requieran cambios en la base de datos.
14. Evitar `any` cuando sea posible.
15. Mantener código limpio, reutilizable y fácil de mantener.

---

# 4. Roles del sistema

El sistema manejará principalmente dos roles:

## ADMIN

El administrador tiene acceso a toda la información de la empresa.

Puede:

* Ver empleados.
* Crear empleados.
* Invitar nuevos empleados.
* Activar o desactivar empleados.
* Cambiar el estado laboral del empleado.
* Consultar asistencias.
* Ver fotografías de entrada y salida.
* Ver hora de entrada.
* Ver hora de salida.
* Ver horas trabajadas.
* Consultar total de horas por semana.
* Consultar historial.
* Administrar jornadas laborales.
* Consultar empleados activos e inactivos.
* Consultar empleados de vacaciones o permiso.

---

## EMPLOYEE

El empleado tendrá una vista simplificada.

Puede:

* Iniciar sesión.
* Visualizar su estado.
* Registrar entrada.
* Registrar salida.
* Seleccionar o visualizar su jornada cuando corresponda.
* Permitir acceso a su ubicación.
* Tomarse una fotografía.
* Consultar el resultado de su registro.

No debe tener acceso a:

* Información de otros empleados.
* Panel administrativo.
* Creación de usuarios.
* Modificación de roles.
* Edición de asistencias de otros empleados.
* Configuración general.

---

# 5. Autenticación

La autenticación ya utiliza:

```text
Supabase Auth
```

El sistema debe continuar utilizando Supabase Auth.

Cada usuario autenticado deberá estar asociado con un registro de empleado.

Ejemplo conceptual:

```text
auth.users
     │
     │ id
     ▼
employees.auth_user_id
```

No crear un sistema de contraseñas independiente.

---

# 6. Creación de empleados

Desde el panel administrativo deberá existir:

```text
Agregar empleado
```

El administrador ingresará como mínimo:

* Nombre.
* Apellido.
* Correo electrónico.
* Jornada.
* Estado inicial.

Opcionalmente:

* Código de empleado.
* Teléfono.
* Puesto.
* Departamento.

Después de crear al empleado, el sistema deberá enviar una invitación a su correo.

El empleado deberá recibir un enlace donde pueda:

1. Acceder al sistema.
2. Establecer su contraseña.
3. Completar su registro.
4. Iniciar sesión.

La invitación debe realizarse utilizando los mecanismos disponibles de **Supabase Auth**.

Las operaciones administrativas que requieran `service_role` deberán realizarse exclusivamente desde el servidor.

Nunca exponer:

```text
SUPABASE_SERVICE_ROLE_KEY
```

en el navegador.

---

# 7. Estados de empleados

Cada empleado deberá tener un estado laboral.

Estados requeridos:

```text
ACTIVE
INACTIVE
VACATION
PERMISSION
```

Significado:

### ACTIVE

Empleado activo trabajando normalmente.

Puede registrar asistencia.

### INACTIVE

Empleado que ya no trabaja en la empresa.

No puede registrar nuevas asistencias.

IMPORTANTE:

Cambiar un empleado a `INACTIVE` NO debe eliminar:

* Usuario histórico.
* Entradas.
* Salidas.
* Horas trabajadas.
* Reportes históricos.
* Jornadas históricas.

---

### VACATION

Empleado actualmente de vacaciones.

Debe conservarse su historial.

Por defecto no deberá permitirse registrar asistencia mientras el estado sea `VACATION`, salvo que posteriormente se defina una excepción de negocio.

---

### PERMISSION

Empleado que se encuentra de permiso.

Debe conservarse su historial.

Por defecto no deberá permitirse registrar asistencia mientras se encuentre en estado `PERMISSION`.

---

# 8. Modelo recomendado de empleados

Tabla:

```text
employees
```

Campos recomendados:

```text
id UUID PRIMARY KEY
auth_user_id UUID UNIQUE
employee_code TEXT
first_name TEXT
last_name TEXT
email TEXT
phone TEXT NULL
position TEXT NULL
department TEXT NULL
role TEXT
status TEXT
schedule_id UUID NULL
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
deactivated_at TIMESTAMPTZ NULL
```

Valores de `role`:

```text
ADMIN
EMPLOYEE
```

Valores de `status`:

```text
ACTIVE
INACTIVE
VACATION
PERMISSION
```

Preferiblemente utilizar ENUM de PostgreSQL o constraints para evitar estados inválidos.

---

# 9. Jornadas laborales

La empresa puede tener diferentes jornadas.

No se debe asumir que todos los empleados trabajan en el mismo horario.

Crear una estructura que permita jornadas configurables.

Ejemplo:

```text
work_schedules
```

Campos sugeridos:

```text
id UUID PRIMARY KEY
name TEXT
start_time TIME
end_time TIME
break_minutes INTEGER DEFAULT 0
expected_hours NUMERIC
is_active BOOLEAN DEFAULT TRUE
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

Ejemplos:

```text
Jornada administrativa
08:00 - 17:00
```

```text
Turno mañana
06:00 - 14:00
```

```text
Turno tarde
14:00 - 22:00
```

```text
Turno noche
22:00 - 06:00
```

El diseño debe soportar jornadas que crucen medianoche.

---

# 10. Jornada histórica

No se debe depender solamente de la jornada actual del empleado para calcular asistencias antiguas.

Al momento de registrar asistencia se recomienda guardar:

```text
schedule_id
```

o un snapshot de la jornada correspondiente.

Esto evita que modificar posteriormente la jornada de un empleado altere el significado de registros anteriores.

---

# 11. Registro de asistencia

La tabla principal será conceptualmente:

```text
attendance_records
```

Cada jornada del empleado tendrá información de entrada y salida.

Campos sugeridos:

```text
id UUID PRIMARY KEY

employee_id UUID NOT NULL

work_date DATE NOT NULL

schedule_id UUID NULL

check_in_at TIMESTAMPTZ NULL
check_out_at TIMESTAMPTZ NULL

check_in_photo_path TEXT NULL
check_out_photo_path TEXT NULL

check_in_latitude NUMERIC NULL
check_in_longitude NUMERIC NULL

check_out_latitude NUMERIC NULL
check_out_longitude NUMERIC NULL

check_in_distance_meters NUMERIC NULL
check_out_distance_meters NUMERIC NULL

worked_minutes INTEGER NULL

created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

---

# 12. Flujo de entrada

Cuando el empleado presione:

```text
MARCAR ENTRADA
```

el sistema deberá:

1. Verificar que exista una sesión válida.
2. Obtener al empleado relacionado con el usuario autenticado.
3. Verificar:

```text
employee.status === ACTIVE
```

4. Solicitar ubicación.
5. Obtener:

```text
latitude
longitude
```

6. Calcular la distancia respecto a la ubicación autorizada.
7. Verificar que se encuentre dentro del radio permitido.
8. Solicitar o capturar fotografía.
9. Subir fotografía a Supabase Storage.
10. Registrar fecha/hora del servidor.
11. Guardar ubicación.
12. Guardar distancia calculada.
13. Guardar referencia de la fotografía.
14. Confirmar registro al usuario.

La hora oficial deberá provenir preferentemente del servidor/base de datos y no del reloj del dispositivo del empleado.

---

# 13. Flujo de salida

Cuando el empleado presione:

```text
MARCAR SALIDA
```

se debe realizar nuevamente:

1. Validación de autenticación.
2. Validación del empleado.
3. Validación de estado.
4. Obtención de ubicación.
5. Validación del radio.
6. Captura de nueva fotografía.
7. Registro de fecha/hora.
8. Almacenamiento de ubicación.
9. Guardado de fotografía de salida.
10. Cálculo de tiempo trabajado.

Ejemplo:

```text
Entrada: 08:03
Salida: 17:12

Tiempo transcurrido:
9 horas 9 minutos
```

Si la jornada tiene descanso configurado:

```text
break_minutes = 60
```

entonces:

```text
9h 09m
-
1h
=
8h 09m trabajadas
```

La política exacta sobre descansos puede configurarse posteriormente.

---

# 14. Validación de ubicación

El empleado únicamente puede registrar asistencia si se encuentra dentro del área autorizada.

Debe existir configuración para:

```text
latitude
longitude
allowed_radius_meters
```

Ejemplo:

```text
latitude = 14.xxxxxx
longitude = -90.xxxxxx
allowed_radius_meters = 100
```

No hardcodear estos valores directamente dentro de componentes React si pueden almacenarse en configuración.

Tabla sugerida:

```text
attendance_locations
```

Campos:

```text
id
name
latitude
longitude
allowed_radius_meters
is_active
created_at
updated_at
```

Aunque inicialmente exista una sola ubicación, diseñar la lógica para poder soportar más ubicaciones en el futuro.

---

# 15. Cálculo de distancia

Utilizar una fórmula adecuada para calcular la distancia entre:

```text
ubicación del empleado
```

y

```text
ubicación autorizada
```

Se puede utilizar la fórmula de Haversine.

Resultado:

```text
distance_meters
```

Validación:

```text
distance_meters <= allowed_radius_meters
```

Entonces:

```text
PERMITIR ASISTENCIA
```

Caso contrario:

```text
DENEGAR ASISTENCIA
```

Mostrar mensaje similar a:

```text
No puedes registrar tu asistencia porque te encuentras fuera de la ubicación autorizada.
```

La validación crítica también deberá realizarse del lado servidor.

---

# 16. Fotografías

Se utilizará:

```text
Supabase Storage
```

Bucket recomendado:

```text
attendance-photos
```

Ejemplo de estructura:

```text
attendance-photos/
    employee_uuid/
        2026/
            09/
                attendance_uuid/
                    check-in.webp
                    check-out.webp
```

Evitar utilizar solamente el nombre del empleado como identificador del archivo.

---

# 17. Seguridad de fotografías

Las fotografías NO deben ser públicas.

Utilizar bucket privado.

Para visualizar fotografías desde administración utilizar:

```text
Signed URLs
```

con expiración corta.

Ejemplo:

```text
60 - 300 segundos
```

Los empleados no deben tener acceso libre a fotografías de otros empleados.

---

# 18. Eliminación de fotografías

Por privacidad y almacenamiento, las fotografías pueden eliminarse después de:

```text
20 días
```

IMPORTANTE:

Se elimina únicamente el archivo de Storage.

NO se debe eliminar el registro de asistencia.

Después de eliminar la fotografía deberá mantenerse:

```text
empleado
fecha
hora entrada
hora salida
ubicación
horas trabajadas
historial
```

Puede guardarse además:

```text
photo_deleted_at
```

para identificar que la fotografía existió pero fue eliminada por política de retención.

Se debe implementar una tarea programada para revisar diariamente fotografías mayores a 20 días.

Puede utilizarse, según la arquitectura disponible:

* Supabase Cron.
* Edge Function.
* Función server-side programada.
* Vercel Cron.

No ejecutar esta limpieza desde el navegador.

---

# 19. Restricciones de asistencia

Un empleado no debe poder registrar:

```text
dos entradas abiertas
```

sin haber registrado salida.

Ejemplo inválido:

```text
08:00 entrada
08:10 entrada
```

Debe rechazarse la segunda entrada.

Tampoco se debe permitir una salida si no existe una entrada pendiente.

Ejemplo inválido:

```text
17:00 salida
```

sin entrada correspondiente.

---

# 20. Prevención de doble clic

Evitar registros duplicados por:

* Doble clic.
* Mala conexión.
* Reintentos HTTP.
* Refresh.
* Dos pestañas abiertas.

La base de datos deberá ayudar a garantizar consistencia.

No depender exclusivamente de deshabilitar un botón en React.

---

# 21. Horas trabajadas

La duración deberá calcularse utilizando timestamps completos.

NO calcular únicamente:

```text
hora_salida - hora_entrada
```

ignorando la fecha.

Esto es especialmente importante para jornadas nocturnas.

Ejemplo:

```text
Entrada:
2026-09-15 22:00

Salida:
2026-09-16 06:00
```

Resultado:

```text
8 horas
```

---

# 22. Almacenamiento de duración

Se recomienda almacenar internamente duración en:

```text
worked_minutes
```

Ejemplo:

```text
495 minutos
```

equivale a:

```text
8 horas 15 minutos
```

Esto facilita:

* Sumas.
* Reportes.
* Estadísticas.
* Totales semanales.

La interfaz puede convertirlo a:

```text
8h 15m
```

---

# 23. Total semanal

El administrador debe visualizar las horas acumuladas por cada empleado durante una semana.

Ejemplo:

| Empleado   | Lun | Mar |    Mié | Jue | Vie | Sáb | Dom |   Total |
| ---------- | --: | --: | -----: | --: | --: | --: | --: | ------: |
| Juan Pérez |  8h |  8h | 7h 45m |  8h |  8h |  0h |  0h | 39h 45m |

El cálculo deberá realizarse utilizando:

```text
SUM(worked_minutes)
```

por empleado y rango semanal.

Definir claramente el inicio de semana.

Por defecto:

```text
lunes
```

hasta:

```text
domingo
```

---

# 24. Panel administrativo

El administrador deberá tener un dashboard general.

Ejemplo de ruta:

```text
/admin
```

Debe mostrar información relevante como:

```text
Empleados activos
Asistencias de hoy
Empleados ausentes
Empleados de vacaciones
Empleados con permiso
Horas trabajadas esta semana
```

---

# 25. Vista de empleados

Ruta sugerida:

```text
/admin/employees
```

Información:

| Empleado    | Correo                                        | Jornada        | Estado     | Acción |
| ----------- | --------------------------------------------- | -------------- | ---------- | ------ |
| Juan Pérez  | [juan@empresa.com](mailto:juan@empresa.com)   | Administrativa | Activo     | Ver    |
| Pedro López | [pedro@empresa.com](mailto:pedro@empresa.com) | Turno mañana   | Vacaciones | Ver    |
| Ana Díaz    | [ana@empresa.com](mailto:ana@empresa.com)     | Administrativa | Inactivo   | Ver    |

Estados visuales:

```text
Activo
Inactivo
Vacaciones
Permiso
```

---

# 26. Detalle del empleado

Ruta sugerida:

```text
/admin/employees/[id]
```

Debe mostrar:

### Información

* Nombre.
* Correo.
* Estado.
* Jornada.
* Puesto.
* Fecha de creación.

### Asistencia

* Fecha.
* Entrada.
* Fotografía entrada.
* Salida.
* Fotografía salida.
* Horas trabajadas.

### Resumen

```text
Horas esta semana
Horas este mes
Días trabajados
```

---

# 27. Historial

Nunca eliminar automáticamente registros históricos de asistencia.

Incluso si:

```text
employee.status = INACTIVE
```

el administrador debe continuar pudiendo consultar:

```text
historial de ese empleado
```

Se recomienda aplicar soft delete o estados en lugar de borrar empleados.

---

# 28. Vista del empleado

Ruta sugerida:

```text
/attendance
```

La interfaz debe ser sencilla.

Ejemplo:

```text
Hola, Juan Pérez

Estado:
ACTIVO

Jornada:
08:00 - 17:00

--------------------------------

Entrada de hoy:
08:03

Salida:
Pendiente

--------------------------------

[ MARCAR SALIDA ]
```

Si todavía no ha registrado entrada:

```text
[ MARCAR ENTRADA ]
```

---

# 29. Flujo de cámara

Al registrar asistencia:

```text
MARCAR ENTRADA
        ↓
Solicitar ubicación
        ↓
Validar ubicación
        ↓
Abrir cámara
        ↓
Tomar fotografía
        ↓
Vista previa
        ↓
Confirmar
        ↓
Guardar
```

No subir la fotografía hasta que el usuario confirme.

Después del registro mostrar mensaje:

```text
Entrada registrada correctamente
08:03
```

o:

```text
Salida registrada correctamente
17:12

Horas trabajadas:
8h 09m
```

---

# 30. Timezone

La aplicación debe manejar correctamente la zona horaria de Guatemala.

Zona:

```text
America/Guatemala
```

Los timestamps deben guardarse correctamente en PostgreSQL como:

```text
TIMESTAMPTZ
```

Evitar guardar fechas formateadas como texto.

---

# 31. Row Level Security

Todas las tablas sensibles deben utilizar:

```text
RLS
```

Reglas generales:

### EMPLOYEE

Puede consultar únicamente:

```text
su información
sus registros
sus asistencias
```

### ADMIN

Puede consultar la información administrativa necesaria de todos los empleados.

Nunca confiar únicamente en:

```typescript
if (user.role === "ADMIN")
```

desde React.

Los permisos deben verificarse también en Supabase/PostgreSQL o en lógica server-side segura.

---

# 32. Auditoría

Se recomienda crear:

```text
employee_status_history
```

para registrar cambios de estado.

Ejemplo:

```text
id
employee_id
previous_status
new_status
changed_by
reason
created_at
```

Ejemplo:

```text
ACTIVE
→
VACATION
```

De esta manera existe trazabilidad administrativa.

---

# 33. Ausencias justificadas

Los estados de vacaciones y permiso pueden manejarse adicionalmente mediante períodos.

Tabla sugerida:

```text
employee_absences
```

Campos:

```text
id
employee_id
type
start_date
end_date
reason
created_by
created_at
```

Tipos:

```text
VACATION
PERMISSION
```

Esto permite saber que un empleado estará:

```text
de vacaciones del 10 al 15
```

en lugar de únicamente mantener un estado global.

---

# 34. Arquitectura sugerida

Mantener una organización similar a:

```text
src/
├── app/
│   ├── admin/
│   │   ├── employees/
│   │   ├── attendance/
│   │   ├── schedules/
│   │   └── reports/
│   │
│   ├── attendance/
│   ├── login/
│   └── auth/
│
├── components/
│   ├── attendance/
│   ├── admin/
│   ├── employees/
│   └── ui/
│
├── lib/
│   ├── supabase/
│   ├── attendance/
│   ├── geolocation/
│   ├── permissions/
│   └── dates/
│
├── services/
│   ├── attendance.service.ts
│   ├── employee.service.ts
│   └── schedule.service.ts
│
├── types/
│
└── utils/
```

Adaptar la estructura a la arquitectura que ya exista en el proyecto.

NO reorganizar todo el proyecto sin necesidad.

---

# 35. Variables de entorno

Ejemplo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=
```

La variable:

```text
SUPABASE_SERVICE_ROLE_KEY
```

solo debe utilizarse en código server-side.

Nunca exponerla mediante:

```text
NEXT_PUBLIC_
```

---

# 36. Validaciones importantes

Antes de registrar una asistencia verificar:

```text
usuario autenticado
       ↓
empleado existente
       ↓
empleado ACTIVE
       ↓
ubicación disponible
       ↓
ubicación permitida
       ↓
fotografía válida
       ↓
estado correcto de asistencia
       ↓
registrar
```

---

# 37. Casos que deben manejarse

El sistema debe contemplar:

* Usuario sin empleado asociado.
* Usuario inactivo.
* Usuario de vacaciones.
* Usuario de permiso.
* GPS desactivado.
* Permiso de ubicación denegado.
* Cámara denegada.
* Cámara no disponible.
* Mala conexión.
* Fotografía que no logró subir.
* Entrada duplicada.
* Salida sin entrada.
* Jornada nocturna.
* Empleado sin jornada.
* Archivo eliminado por política de 20 días.
* Error al enviar invitación.
* Correo de empleado duplicado.

---

# 38. Consistencia al subir fotografías

Evitar dejar fotografías huérfanas en Storage.

Ejemplo:

Si:

1. La fotografía se sube correctamente.
2. Pero posteriormente falla el INSERT de asistencia.

El sistema deberá intentar eliminar el archivo recién creado o implementar una estrategia que permita limpiar estos archivos posteriormente.

---

# 39. Estados de interfaz

Los botones deben bloquearse mientras una operación está en proceso.

Ejemplo:

```text
Registrando asistencia...
```

No permitir múltiples envíos mientras continúa la petición.

Los mensajes de error deben ser entendibles para el empleado.

Evitar mostrar errores internos como:

```text
PostgrestError
PGRST...
SQLSTATE...
```

al usuario final.

---

# 40. Formato de fechas

En interfaz mostrar fechas amigables.

Ejemplo:

```text
15/09/2026
```

Hora:

```text
08:03 AM
```

o formato de 24 horas según la interfaz definida.

Internamente mantener timestamps completos.

---

# 41. Reportes

Preparar arquitectura para posteriormente permitir:

```text
Reporte semanal
Reporte mensual
Reporte por empleado
Reporte por departamento
Reporte por rango de fechas
```

Filtros sugeridos:

* Fecha inicial.
* Fecha final.
* Empleado.
* Estado.
* Jornada.

---

# 42. Base de datos conceptual

Relación principal:

```text
auth.users
    │
    │
    ▼
employees
    │
    ├──────────────► work_schedules
    │
    │
    ├──────────────► attendance_records
    │
    ├──────────────► employee_absences
    │
    └──────────────► employee_status_history
```

Y:

```text
attendance_records
        │
        ▼
attendance_locations
```

cuando corresponda.

---

# 43. Índices recomendados

Considerar índices para:

```text
attendance_records.employee_id
attendance_records.work_date
attendance_records.check_in_at

employees.auth_user_id
employees.status

employee_absences.employee_id
```

Para consultas frecuentes considerar índice compuesto:

```text
(employee_id, work_date)
```

---

# 44. Restricciones importantes de base de datos

Agregar restricciones siempre que sea posible.

Por ejemplo:

```text
check_out_at >= check_in_at
```

cuando ambos registros existan.

Evitar registros imposibles.

También se deben utilizar:

* Foreign Keys.
* Unique constraints.
* Check constraints.
* Valores por defecto.

---

# 45. Definición funcional de una asistencia

Una asistencia completa contiene:

```text
Empleado
Fecha/Jornada
Entrada
Fotografía entrada
Ubicación entrada
Salida
Fotografía salida
Ubicación salida
Tiempo trabajado
```

Una asistencia abierta contiene:

```text
Entrada = registrada
Salida = pendiente
```

---

# 46. Privacidad

Las fotografías son evidencia temporal de asistencia.

No deben utilizarse para otros propósitos.

No implementar reconocimiento facial ni identificación biométrica salvo que exista un requerimiento explícito posterior.

Las fotografías deberán eliminarse automáticamente después del período de retención establecido.

---

# 47. Criterios mínimos de aceptación

## Login

* [ ] Usuario puede iniciar sesión.
* [ ] Usuario no autenticado no puede entrar a rutas privadas.
* [ ] Administrador es enviado al panel administrativo.
* [ ] Empleado es enviado a asistencia.

## Empleados

* [ ] Admin puede crear empleado.
* [ ] Admin puede enviar invitación.
* [ ] Empleado puede establecer contraseña.
* [ ] Admin puede activar empleado.
* [ ] Admin puede desactivar empleado.
* [ ] Admin puede poner empleado de vacaciones.
* [ ] Admin puede poner empleado de permiso.
* [ ] Historial permanece aunque el empleado quede inactivo.

## Entrada

* [ ] Obtiene ubicación.
* [ ] Valida radio.
* [ ] Captura fotografía.
* [ ] Guarda fotografía.
* [ ] Registra hora.
* [ ] Guarda ubicación.
* [ ] Evita doble entrada.

## Salida

* [ ] Valida ubicación.
* [ ] Captura fotografía.
* [ ] Registra salida.
* [ ] Calcula duración.
* [ ] Evita salida sin entrada.

## Administración

* [ ] Puede consultar empleados.
* [ ] Puede consultar entradas.
* [ ] Puede consultar salidas.
* [ ] Puede visualizar fotografías vigentes.
* [ ] Puede consultar horas trabajadas.
* [ ] Puede consultar total semanal.

## Privacidad

* [ ] Bucket privado.
* [ ] Fotografías se eliminan después de 20 días.
* [ ] Asistencias permanecen después de eliminar las fotos.

---

# 48. Prioridad de implementación

Cuando Codex continúe el desarrollo, seguir preferentemente este orden:

```text
1. Revisar esquema actual y autenticación existente
2. Roles ADMIN / EMPLOYEE
3. Tabla employees
4. Protección de rutas
5. Estados laborales
6. Jornadas
7. Registro de entrada
8. Geolocalización
9. Cámara
10. Supabase Storage
11. Registro de salida
12. Cálculo de horas
13. Dashboard administrativo
14. Historial
15. Total semanal
16. Invitación de empleados
17. RLS y revisión de seguridad
18. Eliminación automática de fotos después de 20 días
19. Auditoría
20. Reportes
```

---

# 49. Instrucción especial para Codex

Cuando recibas una nueva tarea relacionada con este proyecto:

1. Primero analiza el código existente.
2. Identifica qué funcionalidades ya existen.
3. Reutiliza componentes, tablas y servicios existentes.
4. No reescribas partes funcionales innecesariamente.
5. Indica qué archivos serán modificados.
6. Implementa únicamente lo necesario para completar el requerimiento.
7. Si se necesita cambiar la base de datos, genera el SQL o migración correspondiente.
8. Si una funcionalidad requiere una variable de entorno, indicarla claramente.
9. Mantén seguridad de Supabase y RLS.
10. No utilices `service_role` desde el frontend.
11. No elimines información histórica.
12. Comprueba los casos de error.
13. Mantén compatibilidad con la arquitectura actual.
14. Ejecuta o propone las verificaciones de TypeScript, lint y build correspondientes.
15. Al finalizar explica brevemente:

* Qué cambió.
* Qué archivos cambiaron.
* Qué cambios de base de datos se necesitan.
* Qué configuración debe realizarse en Supabase.
* Cómo probar la funcionalidad.

---

# 50. Principio principal del sistema

El sistema debe mantener siempre esta separación:

```text
AUTHENTICATION
¿Quién eres?
        ↓

AUTHORIZATION
¿Qué puedes hacer?
        ↓

EMPLOYEE STATUS
¿Puedes trabajar actualmente?
        ↓

GEOLOCATION
¿Estás en el lugar permitido?
        ↓

ATTENDANCE STATE
¿Debes marcar entrada o salida?
        ↓

EVIDENCE
Fotografía
        ↓

ATTENDANCE RECORD
Registro definitivo
```

La prioridad es mantener:

```text
seguridad
+
historial
+
trazabilidad
+
simplicidad para el empleado
+
control completo para administración
```

sin perder información histórica.