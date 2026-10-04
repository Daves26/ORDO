# Mejoras pendientes tras completar los datos de la OS

Este listado conserva **16 áreas de evolución** del MVP. Ya existen la captura de pasajeros, proveedores emisores, tramos de vuelo y precios unitarios; las tareas siguientes amplían estos módulos. La presencia de tablas en PostgreSQL no significa que los procesos de reservas, obligaciones, facturación externa o avisos estén disponibles.

1. [ ] **Gestión avanzada de pasajeros.** Comparar cantidades declaradas y registradas, mejorar búsqueda y conciliación de perfiles compartidos, gestionar datos de viaje adicionales y avisar sobre documentos próximos a vencer. La captura, reutilización por documento y vínculo a varias OS ya funcionan.
2. [ ] **Ficha de cliente ampliada.** Completar WhatsApp, facturación e historial consolidado; mejorar sugerencias de posibles duplicados por nombre similar, pasaporte y documento parcialmente coincidente. Conservar snapshots de datos usados en documentos históricos.
3. [ ] **Reservas y costos por servicio.** Los detalles de ruta, plan, equipaje, transporte, hotel, emisor y tramos de vuelo ya se capturan. Quedan costos y precios por servicio, fechas/zonas operativas, datos específicos de hotel, traslado o asistencia y transiciones de reserva/confirmación vinculadas a localizadores existentes.
4. [ ] **Proveedores y obligaciones.** Ampliar el catálogo básico y la selección de proveedor emisor con datos fiscales y condiciones de pago; generar cuentas por pagar en COP cuando un servicio comprometido tenga proveedor, costo y vencimiento definidos.
5. [ ] **Pagos y seguimiento de proveedores.** Contabilidad registra egresos y soportes; el asesor confirma la recepción por el proveedor y hace seguimiento hasta obtener el voucher. Mantener vencimientos y movimientos independientes de la cartera del cliente.
6. [ ] **Operación y back office.** Crear bandeja específica, gestión de reservas, documentación, salidas próximas y check-ins. El personal de back office debe poder completar sus tareas operativas sin permisos financieros.
7. [ ] **Gestión completa de tareas.** Asignar responsables, prioridades y fechas; permitir iniciar, completar y cerrar pendientes, con seguimiento automático de tareas vencidas. Hoy solo se generan algunas tareas básicas.
8. [ ] **Alertas y notificaciones.** Ejecutar procesos programados, deduplicados y configurables para cartera, proveedores, facturas, vouchers, reservas y check-ins; escalar excepciones a gerencia y resolverlas cuando desaparezca la condición.
9. [ ] **Cartera avanzada.** Bandejas de cobro y seguimiento de fechas máximas, cuotas y saldos vencidos; recordatorios por responsable. Reutilizar pagos y saldos ya calculados, sin otro registro manual paralelo.
10. [ ] **Documentos y vouchers.** Cargar, relacionar, consultar y proteger archivos por OS, servicio y movimiento, con almacenamiento de objetos y acceso por rol. Identificar vouchers/documentos faltantes.
11. [ ] **Facturación externa y documentos adicionales.** Registrar y consultar facturas del software contable externo, asociar archivos y snapshots fiscales y preparar la integración por API. Registrar un RC no equivale a emitirlo externamente.
12. [ ] **Expediente y trazabilidad visible.** Mostrar línea de tiempo de acciones, cambios y comentarios internos con menciones opcionales; habilitar consulta de auditoría y estados operativos derivados. Respetar la decisión de que el borrado definitivo del superusuario elimina las auditorías relacionadas.
13. [ ] **Paneles por rol.** Bandejas e indicadores propios para asesor, contabilidad y back office; panel gerencial enfocado en excepciones. Sustituir el panel de inicio genérico sin duplicar datos.
14. [ ] **Búsqueda, filtros y reportes.** Resultados directos por OS, cliente, localizador, proveedor y destino; filtros operativos y financieros por fechas, estado, responsable y vencimiento. Reportes básicos de ventas, cartera, proveedores, viajes y vouchers.
15. [ ] **Cancelación y anulación como procesos.** Implementar transiciones controladas para conservar una venta cancelada o un movimiento anulado, diferenciándolas del borrado físico definitivo que ya puede ejecutar ADMINISTRADOR.
16. [ ] **Cierre técnico del MVP.** Pruebas E2E del recorrido completo, 2FA para roles sensibles, rate limiting y seguridad adicional, despliegue HTTPS, backups automatizados y ensayos de restauración. Preparar PWA futura sin introducir aplicación móvil nativa en esta fase.

## Secuencia sugerida

Reservas y back office (3, 6) → proveedores y pagos (4, 5) → tareas/alertas (7, 8) → documentos y facturación (10, 11) → paneles, reportes y cierre técnico. Pasajeros, cliente ampliado y cartera avanzada pueden avanzar junto a esos flujos respetando el expediente único.
