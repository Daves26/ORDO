# Mejoras pendientes después de localizadores y calendario

Este listado conserva las **16 mejoras restantes** acordadas para el MVP y su evolución. Las funciones de captura múltiple de servicios, registro/corrección de localizadores y calendarios de salida/regreso ya se implementaron; la presencia de tablas en PostgreSQL no significa que los procesos siguientes estén disponibles. Priorizar funcionalidades completas con migración, permisos, auditoría y pruebas, sin generar trabajo duplicado.

1. [ ] **Pasajeros.** Crear y reutilizar pasajeros sin confundirlos con el cliente comprador; relacionarlos con varias OS, comparar cantidad declarada/registrada, gestionar datos de viaje y avisar sobre documentos próximos a vencer.
2. [ ] **Ficha de cliente ampliada.** Completar WhatsApp, facturación e historial consolidado; mejorar sugerencias de posibles duplicados por nombre similar, pasaporte y documento parcialmente coincidente. Conservar snapshots de datos usados en documentos históricos.
3. [ ] **Servicios y reservas detallados.** Completar cada servicio inicialmente creado con fechas, proveedor, costo, precio y datos contextuales de vuelo, hotel, traslado o asistencia; gestionar confirmaciones y estados de reserva, reutilizando los localizadores ya registrados sin volver a introducirlos.
4. [ ] **Proveedores y obligaciones.** Construir catálogo, condiciones de pago y cuentas por pagar en COP; generar la obligación cuando un servicio comprometido tenga proveedor, costo y vencimiento definidos.
5. [ ] **Pagos y seguimiento de proveedores.** Contabilidad registra egresos y soportes; el asesor confirma la recepción por el proveedor y hace seguimiento hasta obtener el voucher. Mantener vencimientos y movimientos independientes de la cartera del cliente.
6. [ ] **Operación y back office.** Crear bandeja específica, gestión de reservas, documentación, salidas próximas y check-ins. El personal de back office debe poder completar sus tareas operativas sin permisos financieros.
7. [ ] **Gestión completa de tareas.** Asignar responsables, prioridades y fechas; permitir iniciar, completar y cerrar pendientes, con seguimiento automático de tareas vencidas. Hoy solo se generan algunas tareas básicas.
8. [ ] **Alertas y notificaciones.** Ejecutar procesos programados, deduplicados y configurables para cartera, proveedores, facturas, vouchers, reservas y check-ins; escalar excepciones a gerencia y resolverlas cuando desaparezca la condición.
9. [ ] **Cartera avanzada.** Bandejas de cobro y seguimiento de fechas máximas, cuotas y saldos vencidos; recordatorios por responsable. Reutilizar pagos y saldos ya calculados, sin otro registro manual paralelo.
10. [ ] **Documentos y vouchers.** Cargar, relacionar, consultar y proteger archivos por OS, servicio y movimiento, con almacenamiento de objetos y acceso por rol. Identificar vouchers/documentos faltantes.
11. [ ] **Facturación y documentos generados.** Registrar y consultar facturas del software contable externo, asociar archivos y snapshots, preparar integración por API y generar automáticamente la orden de servicio en PDF. Registrar un RC no equivale a emitirlo externamente.
12. [ ] **Expediente y trazabilidad visible.** Mostrar línea de tiempo de acciones, cambios y comentarios internos con menciones opcionales; habilitar consulta de auditoría y estados operativos derivados. Respetar la decisión de que el borrado definitivo del superusuario elimina las auditorías relacionadas.
13. [ ] **Paneles por rol.** Bandejas e indicadores propios para asesor, contabilidad y back office; panel gerencial enfocado en excepciones. Sustituir el panel de inicio genérico sin duplicar datos.
14. [ ] **Búsqueda, filtros y reportes.** Resultados directos por OS, cliente, localizador, proveedor y destino; filtros operativos y financieros por fechas, estado, responsable y vencimiento. Reportes básicos de ventas, cartera, proveedores, viajes y vouchers.
15. [ ] **Cancelación y anulación como procesos.** Implementar transiciones controladas para conservar una venta cancelada o un movimiento anulado, diferenciándolas del borrado físico definitivo que ya puede ejecutar ADMINISTRADOR.
16. [ ] **Cierre técnico del MVP.** Pruebas E2E del recorrido completo, 2FA para roles sensibles, rate limiting y seguridad adicional, despliegue HTTPS, backups automatizados y ensayos de restauración. Preparar PWA futura sin introducir aplicación móvil nativa en esta fase.

## Secuencia sugerida

Reservas y back office (3, 6) → proveedores y pagos (4, 5) → tareas/alertas (7, 8) → documentos y facturación (10, 11) → paneles, reportes y cierre técnico. Pasajeros, cliente ampliado y cartera avanzada pueden avanzar junto a esos flujos respetando el expediente único.
