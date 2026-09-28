# Ordo · Operación de agencia de viajes

Aplicación web interna. Primer incremento: autenticación con roles, clientes maestros y venta rápida en borrador con abono reportado; datos compartidos y trazables. Ver [arquitectura](docs/arquitectura.md), [incremento implementado](docs/incremento-01.md) y [operación y restauración](docs/operacion.md).

## Requisitos

Node.js 22+, PostgreSQL 16+ (o Docker Compose), npm. Todas las operaciones de cobro y pago son COP; Siigo será la fuente de emisión de facturas.

## Desarrollo

1. Copiar `.env.example` a `.env` y configurar `DATABASE_URL`, `SESSION_SECRET` (aleatorio de al menos 32 caracteres), `APP_ORIGIN` (URL pública exacta, con HTTPS en producción), `SEED_MANAGER_EMAIL` y `SEED_MANAGER_PASSWORD`, además de `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` para el administrador técnico. Nunca usar contraseñas de ejemplo fuera de local.
2. Iniciar PostgreSQL con `docker compose up -d` (o usar una instancia propia).
3. `npm install`
4. `npm run db:deploy` y `npm run db:seed`
5. `npm run dev` y abrir http://localhost:3000

La cuenta inicial de gerencia tiene roles GERENTE y ASESOR. La cuenta de administración es un **superusuario**: puede realizar pruebas y soporte sobre todas las ventas y clientes y editar sus propios roles o los de otras personas desde `/usuarios`. El sistema protege al último administrador activo. Contabilidad valida cada abono con su número de RC único tras confirmar visualmente importe y recibo. El seed no genera datos ficticios de clientes o ventas. Para comprobar: `npm run typecheck`, `npm test` y `npm run build`.

Para una nueva venta, el asesor debe indicar la **OS real de cuatro dígitos**; el sistema no asigna consecutivos y muestra el identificador como `OS 0123`. Los expedientes anteriores con código `VEN-...` conservan su código hasta que contabilidad les asigne la OS verdadera. Contabilidad puede corregir el número de OS y los importes de los abonos con motivo y confirmación. Los números de recibo de caja de pagos nuevos aceptan solo dígitos (por ejemplo `000123`); si se corrige el valor de un abono ya validado, el recibo asociado cambia de valor sin cambiar su número.

ADMINISTRADOR tiene herramientas de **borrado físico** para OS, clientes y abonos/recibos incluso validados. La pantalla muestra el alcance y exige escribir el identificador exacto. También se borran las entradas de auditoría relacionadas; no se crea una nueva entrada para esa acción. El borrado se aplica a los datos activos de Ordo: no actúa sobre los registros de sistemas contables externos ni elimina automáticamente copias de seguridad ya creadas.

Para pruebas con PostgreSQL real, crear una base **separada** una sola vez (`docker exec ordo-postgres-1 createdb -U ordo ordo_test`), configurar `TEST_DATABASE_URL` apuntando a ella, ejecutar `DATABASE_URL="<valor de TEST_DATABASE_URL>" npm run db:deploy` y después `npm run test:integration`. Las pruebas de integración crean y limpian sus datos; la configuración impide ejecutarlas si ambas URL apuntan a la misma base. Con la compilación y seed listos, `npm run test:smoke` comprueba HTTP real: acceso protegido, login, sesión y logout.

## Seguridad y despliegue

Publicar detrás de HTTPS con `SESSION_SECRET` diferente por entorno, `DATABASE_URL` de usuario sin privilegios administrativos, cookies seguras y acceso restringido al servidor de BD. Ejecutar migraciones con `npm run db:deploy` antes de iniciar. Conservar registros de auditoría y no editar pagos directamente en SQL. En el despliegue posterior, respaldar PostgreSQL con `pg_dump` diario cifrado y almacenar copia fuera de la máquina; restaurar en instancia aislada con `pg_restore`, ejecutar `npm run db:deploy` y verificar conteos, acceso y expedientes. Al incorporarse documentos S3, respaldar también el bucket/versiones y probar restauración conjunta de referencias y objetos.

## Estado

Las tablas de servicios, facturas, documentos, alertas y proveedores describen el dominio para siguientes incrementos; sus flujos no se exponen como terminados en esta entrega. No hay importación Excel ni integración API Siigo todavía.
