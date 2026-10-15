# Rendimiento: medición y operación

## Flujo de medición

Ejecuta `npm run build` y `npm run perf` con el PostgreSQL local y las credenciales del seed disponibles. La medición arranca `next start` en un puerto libre, abre una sesión temporal, realiza una primera petición (fría) por ruta, 12 lecturas calientes y ráfagas concurrentes de 10 peticiones (`PERF_CONCURRENCY` permite ajustar hasta 100). Cierra la sesión al terminar. No crea ventas, clientes ni pagos.

La primera línea base local, anterior a la optimización y con pocos registros, dio aproximadamente: Inicio 27 ms p50 HTTP caliente (un primer acceso de unos 4,2 s); `/ventas` 17 ms; `/ventas/:id` 10 ms **solo para el estado de carga**; el navegador debía pedir después `/api/sales/:id` (~20 ms) y pasajeros (~10 ms). No extrapoles estos tiempos al VPS, red móvil o bases grandes: la herramienta mide HTML y APIs, no LCP/INP ni hidratación. Compara siempre mismo hardware, volumen y concurrencia; registra resultados de servidor caliente y frío por separado.

Tras los cambios, las lecturas calientes locales del mismo conjunto pequeño dieron aproximadamente 14–18 ms p50 en Inicio, 10–11 ms en `/ventas`, y 18–23 ms **totales** para el HTML del expediente ya completo. La respuesta HTML de esa OS creció de ~14 KB (solo estado de carga) a ~27 KB con contenido útil. El primer acceso a Inicio en este Windows local aún ha variado alrededor de 2 s y alguna ráfaga aislada de 10 peticiones mostró esperas similares, mientras otras dieron menos de 200 ms: investigar con métricas del VPS y datos representativos antes de atribuirlo al SQL, caché o sistema de archivos. La mejora percibida al abrir OS procede sobre todo de quitar las dos peticiones posteriores, especialmente en redes con latencia.

## Cambios actuales

- El expediente se renderiza con datos de servidor en la primera respuesta. La consulta compartida con su API selecciona únicamente campos necesarios, según rol, e incluye pasajeros; sus ediciones revalidan el expediente sin una petición adicional solo para pasajeros.
- Autenticación deduplicada por petición con `React.cache`: la sesión y los roles se vuelven a comprobar en peticiones nuevas.
- Inicio y `/ventas` almacenan resultados por **ID de usuario, roles, filtros y búsqueda**, con vigencia máxima normal de 60 s e invalidación de etiquetas después de las escrituras relevantes. Los permisos, versiones y operaciones financieras de lectura/escritura siguen en vivo y no entran en esta caché. Se muestra la hora de actualización.
- Historial de cliente limitado a 20 ventas por página; panel de usuarios recibe datos iniciales en el HTML. Diálogos de uso esporádico se descargan bajo demanda. Fechas e importes reutilizan instancias de `Intl`; la tipografía inicial carga únicamente el subconjunto latino y pesos usados.
- La migración `20261014000200_dashboard_indexes` añade índices para borradores, tareas y abonos reportados. Aplicarla con `npm run db:deploy` en cada entorno antes de iniciar el código nuevo.

## Al crecer en un VPS

Mantén Next.js y PostgreSQL cerca entre sí. Mide p50/p95 y usa `pg_stat_statements` y `EXPLAIN (ANALYZE, BUFFERS)` sobre consultas reales con datos representativos antes de añadir más índices, sobre todo en búsquedas por `contains`. A partir de miles de clientes/ventas, evalúa `pg_trgm` en campos de texto medidos; los índices B-tree actuales no aceleran búsquedas `%fragmento%`.

Controla conexiones de Prisma por proceso y el máximo de PostgreSQL; considera pooling si aumentan procesos o réplicas. La caché de resultados de Next en un único VPS no equivale a una caché distribuida: al usar varias instancias, comparte caché e invalidaciones o acepta la ventana de actualización de hasta un minuto. No caches respuestas completas entre usuarios ni resultados de autorización o confirmaciones de pagos. Los datos de lista se revalidan de forma *stale-while-revalidate*, por lo que bajo carga puede aparecer brevemente un resultado anterior al actualizarse la etiqueta.

Para presupuestos de navegador (LCP ≤2,5 s e INP ≤200 ms en p75 móvil), añade mediciones de navegador real o RUM en el VPS: `npm run perf` no prueba interacción ni dispositivos móviles. Prueba también creación, corrección y concurrencia contra una base de pruebas aislada con volúmenes representativos, respetando los controles de versión e idempotencia.
