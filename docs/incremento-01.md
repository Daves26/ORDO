# Incremento 01 · Acceso, clientes y captura comercial

## Objetivo y regla

Permitir que el asesor ubique la ficha maestra y cree en segundos un expediente BORRADOR, incluyendo un abono REPORTADO que no reduzca el saldo contable hasta validación por contabilidad. Gerencia vende por el mismo flujo y puede consultar todas las ventas. Administración técnica gestiona usuarios, sin acceso automático a datos comerciales. El borrador se completa con guardado automático y se registra al cumplir mínimos.

## Modelo implicado

`User`, `Role`, `UserRole`, `Session`, `LoginAttempt`; `Customer`, `CustomerChange`; `Sale`, `CustomerPayment`, `CustomerPaymentValidation`, `PaymentAmountCorrection`, `Receipt`, `Task`, `AuditLog`, `IdempotencyKey`. `SaleSequence` queda únicamente para conservar la numeración VEN histórica: las ventas nuevas usan la OS indicada por el asesor. El esquema incluye relaciones previstas para pasajeros, servicios, proveedores, facturación externa y documentos, **sin exponer aún sus flujos**.

## API entregada

| Método y ruta | Uso | Permiso |
| --- | --- | --- |
| POST `/api/auth/login`, `/api/auth/logout` | Sesión protegida | Credenciales / autenticado |
| GET/POST `/api/users` | Consultar/crear usuarios y asignar roles | ADMINISTRADOR |
| GET/POST `/api/customers` | Buscar y crear, bloquear documento y advertir coincidencias | Roles operativos para buscar; ASESOR/GERENTE para crear |
| GET/PATCH `/api/customers/:id` | Ficha e historial / actualización versionada | Roles operativos para consultar; ASESOR/GERENTE para actualizar |
| GET/POST `/api/sales` | Listar/crear borrador e idempotencia | Roles operativos para listar; ASESOR/GERENTE para crear |
| GET `/api/sales/os/availability` | Avisar si una OS de cuatro dígitos ya está asignada | ASESOR/GERENTE/CONTABILIDAD |
| PATCH `/api/sales/:id/os` | Corregir OS con motivo, confirmación y versión | CONTABILIDAD |
| GET/PATCH `/api/sales/:id` | Expediente / edición versionada solo del borrador | Acceso por rol y titularidad |
| POST `/api/sales/:id/register` | Registro con mínimos y tarea operativa | Asesor responsable o GERENTE |
| POST `/api/sales/:id/payments` | Reportar nuevo abono con límite e idempotencia | Asesor responsable, GERENTE o CONTABILIDAD |
| POST `/api/payments/:id/validate` | Validar/rechazar, auditar y cerrar tarea concreta | CONTABILIDAD |
| PATCH `/api/payments/:id/amount` | Corregir abono y recibo en transacción, conservando historial | CONTABILIDAD |
| GET/POST `/api/payments/:id/delete` | Previsualizar/borrar definitivamente abono y recibo | ADMINISTRADOR |
| GET/POST `/api/receipts/:id/delete` | Previsualizar/borrar recibo sin abono vinculado | ADMINISTRADOR |
| GET/POST `/api/sales/:id/delete` | Previsualizar/borrar OS y datos relacionados | ADMINISTRADOR |
| GET/POST `/api/customers/:id/delete` | Previsualizar/borrar cliente y sus ventas | ADMINISTRADOR |
| PATCH `/api/users/:id/roles` | Reemplazar roles con versión, motivo y auditoría | ADMINISTRADOR (incluida cuenta propia) |

Las solicitudes de escritura exigen sesión y mismo origen. Solo el superusuario tiene acciones explícitas de borrado definitivo; no se exponen a otros roles ni se ejecutan mediante eliminación directa del navegador a la base de datos. La búsqueda/expediente excluyen importes cuando el rol es exclusivamente BACK_OFFICE.

## Componentes y validaciones

Layout Corporate Trust compartido en `src/app/globals.css` y `src/components/shell.tsx`; búsqueda global, selector de clientes accesible con flechas/Enter/Escape, cliente maestro, captura rápida, editor de borrador, expediente y formulario de abonos. `src/lib/validation.ts` normaliza documento/teléfono, rechaza correo incompleto, fechas inválidas, regreso anterior y abono superior al total. El servidor comprueba de nuevo saldos, propietario de venta y versión. `src/lib/portfolio.ts` separa saldo contable y proyectado. Los movimientos y transiciones registran `AuditLog`.

En `/ventas/nueva`, el selector de cliente precede al formulario y mantiene los demás campos deshabilitados hasta seleccionar o crear una ficha. Una búsqueda sin resultados confirmada muestra un borde rojo claro, un mensaje y alta de cliente en la misma pantalla; tras crearla se selecciona automáticamente. Los campos de fecha de venta rápida y borrador muestran **DD/MM/AAAA**, validan días reales y se convierten a ISO al llamar a la API. Nombres y apellidos, ciudad y dirección se capitalizan mientras se escriben y también al recibir datos nuevos o modificados en la API; correo, documento y teléfono conservan su normalización particular. La edición del cliente solo envía los campos efectivamente modificados, conservando el historial anterior.

La validación de abonos ahora pide el número único de RC, ofrece una pantalla de confirmación con importe y número y lo muestra junto al movimiento validado. La API crea el recibo y cambia el estado del pago en la misma transacción; un número ya usado devuelve conflicto. Los registros validados antes de este cambio muestran «RC pendiente de asociar (registro anterior)» y no se les asigna un número ficticio. El área `/usuarios` permite editar roles de la propia cuenta y de otras personas con motivo obligatorio; las atribuciones adicionales se aplican a las nuevas peticiones inmediatamente y la navegación se actualiza al guardar.

La OS es obligatoria para toda venta nueva: el asesor digita cuatro números, sin letras ni consecutivo automático, y se muestra como `OS 0123` en título y listados. La venta heredada mantiene «OS pendiente» hasta que contabilidad indique la OS verdadera; el código antiguo permanece en la auditoría. Contabilidad puede corregir la OS con motivo y confirmación; el número equivocado vuelve a quedar disponible cuando se desasigna. La validación del RC acepta solo dígitos, preservando ceros iniciales; ningún formulario nuevo pide «Referencia». La corrección de importes muestra el saldo resultante antes de confirmar: para recibos ya validados, se actualizan juntos abono y recibo, sin modificar el número, conservando versión, autor, motivo y los importes originales en el historial visible del expediente.

El perfil ADMINISTRADOR ahora es superusuario: ve todas las ventas y datos financieros y ejecuta las funciones de contabilidad y asesor ya implementadas, incluso sobre ventas ajenas. Al crear una venta de soporte puede elegir el asesor responsable sin atribuirse esa venta; el actor queda registrado en la auditoría de creación. Para borrados definitivos recibe una previsualización del impacto y debe escribir el número de OS, código de cliente o número de recibo (o «ELIMINAR» para un abono sin recibo). Los abonos validados se pueden borrar junto con el recibo sin esperar una conciliación; también se borran entradas de auditoría asociadas. No se genera historial de borrado y se libera el número eliminado. Ninguna de estas acciones modifica registros en sistemas externos.

## Pruebas y alcance pendiente

`tests/business.test.ts` comprueba validaciones y cartera, `tests/authorization.test.ts` transición y permisos, `tests/customer-picker.test.tsx` navegación por teclado. `tests/flow.integration.ts` ejecuta contra PostgreSQL aislado: documento duplicado, historial, borrador, idempotencia, concurrencia, pago, validación y restricción de moneda en base de datos. `npm run test:smoke` verifica sesión y acceso HTTP en un servidor real. `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run build`. Sigue pendiente una prueba E2E del flujo visual completo y los módulos operativos y financieros posteriores (reservas, proveedores, egresos, facturas Siigo, documentos S3, alertas programadas, anulación y reportes); el esquema es preparación, no implementación de esas operaciones.
