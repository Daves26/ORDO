# Operación y restauración

## Puesta en marcha

Configurar `.env` a partir de `.env.example` con valores distintos en cada entorno. `docker compose up -d`; `npm run db:deploy`; `npm run db:seed`; `npm run build`; `npm start`. Publicar solamente detrás de HTTPS; no exponer PostgreSQL a Internet. En este proyecto Compose enlaza el puerto local a `127.0.0.1` para desarrollo.

Verificar inicio de sesión de gerencia y del administrador superusuario, creación de cliente, OS en borrador y validación de pago con una cuenta CONTABILIDAD antes del uso operativo. Confirmar también que el superusuario pueda consultar ventas ajenas y que el borrado definitivo esté restringido a ADMINISTRADOR. Nunca usar el seed para cambiar contraseñas existentes. Registrar incidencias operativas por su referencia de venta sin copiar documentos sensibles a logs o canales abiertos.

## Backups y restauración

Programar `pg_dump --format=custom --file=ordo-AAAA-MM-DD.dump --dbname="$DATABASE_BACKUP_URL"` diariamente y antes de migraciones, almacenando el respaldo cifrado fuera del servidor con retención definida. `DATABASE_BACKUP_URL` es una URL de PostgreSQL para las herramientas nativas, **sin** el parámetro `?schema=public` de Prisma. Para restaurar, preparar una **base vacía aislada**, usar `pg_restore --no-owner --dbname="$DATABASE_RESTORE_URL" ordo-AAAA-MM-DD.dump`, configurar la `DATABASE_URL` de Prisma hacia la instancia restaurada, ejecutar `npm run db:deploy`, y comparar los conteos de clientes, ventas, pagos y auditoría con el respaldo. Comprobar en esa instancia acceso, historial de un cliente y saldo de una venta con abonos; ensayar restauración periódicamente. No sobrescribir una base de producción al probar.

Cuando se incorporen archivos S3, activar versionado y respaldo del bucket; restaurar base y objetos del mismo punto temporal y verificar las claves referenciadas por `Document`. Planificar credenciales rotables, almacenamiento de secretos, monitorización de errores y estrategia de retención antes del despliegue real.

El borrado definitivo de Ordo elimina los registros de la base activa y las entradas de auditoría relacionadas, sin generar otra entrada de eliminación. Las copias de seguridad previas pueden conservar esos datos hasta que venza su política de retención; una restauración recuperaría el estado contenido en la copia. El borrado en Ordo no modifica registros de sistemas contables externos.
