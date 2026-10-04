-- The OS PDF feature is retired, including previously issued snapshots.
DELETE FROM "IdempotencyKey" WHERE "operation" = 'ORDER_ISSUE';
DELETE FROM "AuditLog" WHERE "entity" = 'SaleOrderIssue';
DROP TABLE "SaleOrderIssue";
