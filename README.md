# Ordo · Gestión interna de una agencia de viajes

Ordo reúne clientes y ventas en un expediente compartido. Esta es una **versión funcional inicial**: los flujos de clientes, captura comercial y cartera descritos abajo están implementados; los módulos operativos y contables restantes figuran en [arquitectura](docs/arquitectura.md) como evolución del sistema.

## Funciones disponibles

| Área | Disponible actualmente |
| --- | --- |
| Acceso | Inicio y cierre de sesión; usuarios con varios roles. ADMINISTRADOR es superusuario de las funciones disponibles y puede gestionar roles propios y ajenos. |
| Clientes y pasajeros | Ficha maestra, búsqueda, aviso de posibles duplicados, bloqueo por documento repetido, edición e historial de cambios. Pasajeros independientes del cliente, con documento, nacimiento y pasaporte, reutilizables entre OS. |
| Ventas | Captura rápida en borrador, expediente, autoguardado del borrador y transición a venta registrada. El asesor ingresa una OS única de **cuatro dígitos**; se presenta como `OS 0123`. Selecciona varios servicios incluidos y puede dejar observaciones generales de la orden. |
| Localizadores | Múltiples códigos por OS, con origen y emisor; vínculo opcional a un servicio. Todos los roles pueden añadirlos según su acceso a la venta; autor, back office y administrador pueden corregirlos con historial. |
| Orden de servicio física | Contacto, titular, datos de facturación, pasajeros, ruta, plan, equipaje, transporte, hotel, proveedor emisor por servicio y tramos de vuelo. Cantidad y precio unitario por tipo de pasajero, sin cambiar el total acordado. |
| Cartera | Abono inicial u otros abonos reportados, validación contable, múltiples pagos y saldos calculados. Un abono reportado no reduce el saldo contable hasta validarse. |
| Recibos | Validar exige un número de recibo de caja único, compuesto solo por dígitos (por ejemplo `000123`). Contabilidad ve el importe y el número antes de confirmar. |
| Correcciones | Contabilidad puede corregir OS e importes con motivo, confirmación y control de concurrencia. Al corregir un abono validado, se corrige también el importe de su recibo **sin cambiar el número**; el valor anterior queda en el historial. |
| Soporte | ADMINISTRADOR ve expedientes de cualquier asesor y puede crear ventas asignándoles otro asesor responsable. Puede borrar físicamente OS, clientes, abonos y recibos, incluso con pagos validados. |

La interfaz sigue el sistema visual **Corporate Trust**. En `/ventas/nueva` se selecciona o crea primero el cliente; los demás campos se habilitan después. Salida y regreso conservan escritura por teclado en `DD/MM/AAAA` y abren un calendario al hacer clic; tras elegir salida se abre regreso, que debe ser **posterior** a la salida. Las fechas de pago mantienen la captura por teclado. Nombres, apellidos, ciudad y dirección reciben mayúscula inicial mientras se capturan. Hay búsqueda global con `Ctrl+K`, nueva venta con `Ctrl+N` y navegación del selector de clientes mediante teclado.

En **Servicios incluidos** se pueden elegir Vuelos, Hotel, Traslados, Asistencia médica, Tours y Otro, sin valores preseleccionados. Se exige al menos uno; si se elige **Otro**, las observaciones de la OS deben indicar de qué servicio se trata. Cada opción genera un servicio inicial en estado «Por reservar», sin atribuirle proveedor o costo ficticios. Desde el borrador se pueden ajustar servicios y observaciones; un servicio que ya tenga datos operativos o compromisos no puede retirarse por este flujo. Las órdenes históricas con categoría `PAQUETE` conservan ese dato sin un desglose inventado.

En el expediente, **N.º RSVA** reutiliza los localizadores, **Plazo RSVA** reutiliza el pago máximo del cliente e **IN/OUT** reutiliza salida y regreso. «Emitido por» se toma del proveedor vinculado a cada servicio; no se confunde con el emisor del localizador. Los precios por tipo de pasajero muestran la diferencia frente al total acordado, sin cambiarlo ni alterar cobros. El asesor y gerencia completan los datos comerciales; back office completa pasajeros y servicios sin acceder a precios; contabilidad puede consultar los datos financieros del expediente.

### Identificadores y dinero

- La OS se escribe **sin letras**, conserva ceros iniciales y no se reinicia por año. Un número asignado no puede utilizarse en otra venta; si contabilidad corrige una OS, el número anterior queda disponible. Las ventas históricas `VEN-...` se muestran como pendientes de OS hasta recibir su número real.
- Los cobros de clientes y pagos a proveedores se realizan solo en **COP**. Los importes usan `NUMERIC` en PostgreSQL.
- El saldo contable descuenta únicamente pagos validados; el saldo proyectado considera también los reportados. El formulario de abonos nuevos **no pide Referencia**. El RC se registra cuando contabilidad valida el abono.
- Un administrador puede darse roles operativos, pero no necesita hacerlo para acceder a las funciones de superusuario ya implementadas. La cuenta de gerencia inicia con `GERENTE + ASESOR` y vende mediante el flujo habitual.

## Puesta en marcha local

Requisitos: **Node.js 22+**, npm y **PostgreSQL 16+** o Docker Desktop.

1. Copia `.env.example` a `.env`. Configura `DATABASE_URL`, `SESSION_SECRET` (aleatorio, mínimo 32 caracteres), `APP_ORIGIN` y correos/contraseñas de `SEED_MANAGER_*` y `SEED_ADMIN_*`. Utiliza `APP_ORIGIN="http://localhost:3000"` para el acceso local. `.env` no se incluye en Git.
2. Inicia la base: `docker compose up -d` (o utiliza tu instancia PostgreSQL).
3. Instala dependencias: `npm install` (genera el cliente Prisma en `postinstall`).
4. Aplica migraciones y crea las cuentas iniciales: `npm run db:deploy` y `npm run db:seed`.
5. Inicia Ordo: `npm run dev` y abre [http://localhost:3000](http://localhost:3000).

El seed es repetible: crea los roles y las cuentas indicadas en `.env`, pero **no cambia la contraseña de una cuenta que ya existe** ni crea clientes o ventas ficticios. El administrador puede crear otros usuarios desde `/usuarios`.

## Pruebas

| Comando | Qué comprueba |
| --- | --- |
| `npm run typecheck` | Tipos TypeScript. |
| `npm test` | Reglas de negocio, autorización y componentes de interfaz. |
| `npm run test:integration` | Flujos y concurrencia sobre una base PostgreSQL de pruebas separada. |
| `npm run build` | Compilación de producción. |
| `npm run test:smoke` | Acceso HTTP, sesión y cierre de sesión con la compilación y el seed preparados. |

Para integración, crea **una sola vez** la base de pruebas con `docker compose exec -T postgres createdb -U ordo ordo_test`. Configura `TEST_DATABASE_URL` en `.env` apuntando a esa base, aplica allí las mismas migraciones usando `DATABASE_URL="<URL de la base de pruebas>" npm run db:deploy` y ejecuta `npm run test:integration`. La configuración rechaza una URL de pruebas que apunte a la base principal. Las pruebas crean y limpian sus propios registros.

## Borrado definitivo y seguridad

Las acciones de borrado están reservadas al rol **ADMINISTRADOR** y requieren previsualizar los registros afectados y escribir exactamente el identificador solicitado. Pueden retirar una venta con recibos validados sin pasar por una conciliación interna: se eliminan en transacción sus datos relacionados, **incluidas las entradas de auditoría relacionadas**. El borrado de un abono con recibo elimina ambos; el de un cliente también elimina sus ventas. No se crea una entrada de auditoría de la eliminación. Otras operaciones sensibles, como correcciones de OS, importes y roles, sí conservan motivo e historial.

El borrado afecta a la **base activa de Ordo** y a los registros que administra esta aplicación; no modifica documentos del software contable externo ni elimina copias de seguridad ya creadas. Los números de OS y recibo borrados quedan libres en Ordo.

Para despliegue: publicar detrás de HTTPS, usar secretos distintos por entorno, proteger las sesiones y restringir PostgreSQL. Aplicar `npm run db:deploy` antes de iniciar. La estrategia de backups y el procedimiento de restauración están en [operación y restauración](docs/operacion.md).

## Alcance actual y documentación

El esquema relacional incluye entidades para reservas, obligaciones, facturas, documentos y alertas, y sirve de base para reportes futuros. **Capturar servicios, proveedores, vuelos y localizadores no equivale todavía a confirmar reservas ni a gestionar pagos a proveedores**. Las ampliaciones planeadas están inventariadas en [16 áreas de mejora pendientes](docs/mejoras-pendientes.md). El registro de RC no emite por sí mismo un recibo en el sistema contable. No se incluye importación de Excel.

- [Arquitectura y decisiones de negocio](docs/arquitectura.md)
- [Funcionalidades implementadas, API y pruebas](docs/incremento-01.md)
- [16 mejoras pendientes](docs/mejoras-pendientes.md)
- [Operación, backups y restauración](docs/operacion.md)
