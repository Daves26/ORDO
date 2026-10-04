# Estado implementado · Acceso, clientes, ventas y cartera

## Objetivo y regla

El asesor busca o crea una ficha maestra y abre en segundos un expediente BORRADOR con una OS real de cuatro dígitos y uno o varios servicios incluidos. Puede reportar un abono inicial sin que este reduzca el saldo contable hasta su validación. Gerencia vende por el mismo flujo y puede consultar todas las ventas. ADMINISTRADOR es superusuario de las funciones disponibles, puede actuar sobre ventas de cualquier asesor y gestionar usuarios. El borrador se completa con autoguardado y se registra cuando cumple los mínimos comerciales.

## Modelo implicado

`User`, `Role`, `UserRole`, `Session`, `LoginAttempt`; `Customer`, `CustomerChange`; `Sale`, `Service`, `CustomerPayment`, `CustomerPaymentValidation`, `PaymentAmountCorrection`, `Receipt`, `Task`, `AuditLog`, `IdempotencyKey`. `SaleSequence` queda únicamente para conservar la numeración VEN histórica: las ventas nuevas usan la OS indicada por el asesor. `Sale.serviceType` es un dato legado opcional; en ventas nuevas la fuente de verdad de los servicios incluidos es `Sale.services`. El esquema incluye relaciones previstas para pasajeros, reservas, proveedores, facturación externa y documentos, **sin exponer aún sus flujos operativos**.

## API entregada

| Método y ruta | Uso | Permiso |
| --- | --- | --- |
| POST `/api/auth/login`, `/api/auth/logout` | Sesión protegida | Credenciales / autenticado |
| GET/POST `/api/users` | Consultar/crear usuarios y asignar roles | ADMINISTRADOR |
| GET/POST `/api/customers` | Buscar y crear; bloquear documento repetido y advertir coincidencias | Roles operativos para buscar; ASESOR/GERENTE para crear; también ADMINISTRADOR |
| GET/PATCH `/api/customers/:id` | Ficha e historial / actualización versionada | Roles operativos para consultar; ASESOR/GERENTE para actualizar; también ADMINISTRADOR |
| GET/POST `/api/sales` | Listar/crear borrador con OS obligatoria e idempotencia | Roles operativos para listar; ASESOR/GERENTE para crear; también ADMINISTRADOR |
| GET `/api/sales/os/availability` | Avisar si una OS de cuatro dígitos ya está asignada | ASESOR/GERENTE/CONTABILIDAD/ADMINISTRADOR |
| PATCH `/api/sales/:id/os` | Corregir OS con motivo y versión | CONTABILIDAD/ADMINISTRADOR |
| GET/PATCH `/api/sales/:id` | Expediente / edición versionada solo del borrador | Acceso por rol y titularidad; ADMINISTRADOR puede intervenir en cualquier venta |
| GET/POST `/api/sales/:id/locators` | Consultar/agregar localizadores de distintos emisores y servicio opcional | Roles con acceso al expediente; ASESOR solo en sus ventas |
| PATCH `/api/sales/:id/locators/:locatorId` | Corregir localizador con historial y versión | Autor con acceso, BACK_OFFICE o ADMINISTRADOR |
| GET/POST `/api/sales/:id/locators/:locatorId/delete` | Previsualizar/borrar definitivamente un localizador y su auditoría | ADMINISTRADOR |
| POST `/api/sales/:id/register` | Registro con mínimos y tarea operativa | Asesor responsable, GERENTE o ADMINISTRADOR |
| POST `/api/sales/:id/payments` | Reportar nuevo abono con límite e idempotencia | Asesor responsable, GERENTE, CONTABILIDAD o ADMINISTRADOR |
| POST `/api/payments/:id/validate` | Validar/rechazar, registrar RC, auditar y cerrar tarea concreta | CONTABILIDAD/ADMINISTRADOR |
| PATCH `/api/payments/:id/amount` | Corregir abono y recibo en transacción, conservando historial | CONTABILIDAD/ADMINISTRADOR |
| GET/POST `/api/payments/:id/delete` | Previsualizar/borrar definitivamente abono y recibo | ADMINISTRADOR |
| GET/POST `/api/receipts/:id/delete` | Previsualizar/borrar recibo sin abono vinculado | ADMINISTRADOR |
| GET/POST `/api/sales/:id/delete` | Previsualizar/borrar OS y datos relacionados | ADMINISTRADOR |
| GET/POST `/api/customers/:id/delete` | Previsualizar/borrar cliente y sus ventas | ADMINISTRADOR |
| PATCH `/api/users/:id/roles` | Reemplazar roles con versión, motivo y auditoría | ADMINISTRADOR (incluida cuenta propia) |

Las solicitudes de escritura exigen sesión y mismo origen. ADMINISTRADOR tiene los permisos de las funciones operativas **ya implementadas** y además acceso exclusivo a los cuatro endpoints de borrado definitivo. El navegador nunca se conecta directamente a la base de datos. El rol exclusivamente BACK_OFFICE no recibe importes financieros en las respuestas de expedientes.

## Componentes y validaciones

Layout Corporate Trust compartido en `src/app/globals.css` y `src/components/shell.tsx`; búsqueda global, selector de clientes accesible con flechas/Enter/Escape, cliente maestro, captura rápida, editor de borrador, expediente y formulario de abonos. `src/lib/validation.ts` normaliza documento/teléfono, rechaza correo incompleto, fechas inválidas, regreso anterior y abono superior al total. El servidor comprueba de nuevo saldos, propietario de venta y versión. `src/lib/portfolio.ts` separa saldo contable y proyectado. Los movimientos y transiciones registran `AuditLog`.

En `/ventas/nueva`, el selector de cliente precede al formulario y mantiene los demás campos deshabilitados hasta seleccionar o crear una ficha. Una búsqueda sin resultados confirmada muestra un borde rojo claro, un mensaje y alta de cliente en la misma pantalla; tras crearla se selecciona automáticamente. Los campos de fecha de venta rápida y borrador muestran **DD/MM/AAAA**, validan días reales y se convierten a ISO al llamar a la API. Nombres y apellidos, ciudad y dirección se capitalizan mientras se escriben y también al recibir datos nuevos o modificados en la API; correo, documento y teléfono conservan su normalización particular. La edición del cliente solo envía los campos efectivamente modificados, conservando el historial anterior.

La captura reemplaza «Servicio principal» por el selector múltiple «Servicios incluidos» (Vuelos, Hotel, Traslados, Asistencia médica, Tours, Otro) y una sección de observaciones generales de la OS. Exige una o más opciones; si se incluye Otro, exige especificarlo en las observaciones al crear. En la misma transacción que crea la venta se registra un `Service` por opción, en estado inicial POR_RESERVAR sin proveedor, costo ni precio propios. Las notas y servicios se muestran en el expediente y se pueden completar/corregir en borrador. Retirar un servicio ya asociado a reservas, documentos, proveedor u obligaciones se bloquea. Una venta histórica con `serviceType` y sin servicios asociados se muestra como «sin desglose»; no se le inventan servicios durante la migración.

Cada OS admite múltiples `SaleLocator` con código en la escritura recibida, origen (página/mayorista, proveedor, aerolínea, hotel, asistencia médica u otro), emisor opcional y servicio opcional. No se obliga a crear una reserva antes de capturar un código. Se evita el duplicado exacto de código/origen/emisor en la misma OS, sin impedir códigos de otros emisores. El asesor añade en sus ventas; back office, contabilidad y gerencia pueden añadir en las OS que consultan; corrigen el autor, back office o ADMINISTRADOR. Toda corrección conserva código anterior/nuevo, actor y fecha mediante auditoría. El borrado definitivo de una OS incluye sus localizadores y auditorías asociadas.

Los campos Salida y Regreso conservan la máscara `DD/MM/AAAA` y los atajos de teclado; al hacer clic muestran el calendario integrado. Tras elegir Salida en el calendario se abre automáticamente Regreso con mínimo de un día posterior. La API rechaza un regreso igual o anterior aunque se haya digitado manualmente. El calendario también está en el editor del borrador; la fecha máxima de pago conserva su campo de texto actual.

La validación de abonos pide el número único de RC (solo dígitos), ofrece una pantalla de confirmación con importe y número y lo muestra junto al movimiento validado. La API crea el recibo y cambia el estado del pago en la misma transacción; un número ya usado devuelve conflicto. Los registros validados antes de este cambio muestran «Recibo pendiente de asociar (registro anterior)» y no reciben números ficticios. El área `/usuarios` permite editar roles propios y ajenos con motivo obligatorio; los cambios se aplican a las nuevas peticiones y la navegación se actualiza al guardar.

La OS es obligatoria para toda venta nueva: el asesor digita cuatro números, sin letras ni consecutivo automático, y se muestra como `OS 0123` en título y listados. La venta heredada mantiene «OS pendiente» hasta que contabilidad indique la OS verdadera; el código antiguo permanece en la auditoría. Contabilidad puede corregir la OS con motivo y confirmación; el número equivocado vuelve a quedar disponible cuando se desasigna. La validación del RC acepta solo dígitos, preservando ceros iniciales; ningún formulario nuevo pide «Referencia». La corrección de importes muestra el saldo resultante antes de confirmar: para recibos ya validados, se actualizan juntos abono y recibo, sin modificar el número, conservando versión, autor, motivo y los importes originales en el historial visible del expediente.

El perfil ADMINISTRADOR ahora es superusuario: ve todas las ventas y datos financieros y ejecuta las funciones de contabilidad y asesor ya implementadas, incluso sobre ventas ajenas. Al crear una venta de soporte puede elegir el asesor responsable sin atribuirse esa venta; el actor queda registrado en la auditoría de creación. Para borrados definitivos recibe una previsualización del impacto y debe escribir el número de OS, código de cliente o número de recibo (o «ELIMINAR» para un abono sin recibo). Los abonos validados se pueden borrar junto con el recibo sin esperar una conciliación; también se borran entradas de auditoría asociadas. No se genera historial de borrado y se libera el número eliminado. Ninguna de estas acciones modifica registros en sistemas externos.

## Pruebas y alcance pendiente

`tests/business.test.ts`, `tests/authorization.test.ts` y los tests de componentes cubren reglas, cartera, permisos, formularios, selección de fechas y confirmaciones con teclado. `tests/flow.integration.ts` verifica contra PostgreSQL aislado documentos duplicados, OS, historial, borradores, idempotencia, concurrencia, pagos y correcciones. `tests/locators.integration.ts` comprueba acceso según rol/autor, múltiples orígenes, duplicados, vinculación opcional a servicios, historial y borrado. `tests/superuser.integration.ts` prueba acceso administrativo y borrado de pagos, OS y clientes con dependencias. `npm run test:smoke` comprueba sesión y acceso HTTP con un servidor compilado. Ejecutar `npm run typecheck`, `npm test`, `npm run test:integration` y `npm run build`. Las **16 mejoras restantes** están en [mejoras pendientes](mejoras-pendientes.md); las tablas existentes no equivalen a esos módulos operativos.
