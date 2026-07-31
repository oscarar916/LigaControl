var AuditService = createServiceContract('AUDITORIA');
function logAudit(action, entity, entityId, user, details) { /* TODO: persistir en AUDITORIA. */ return { id: generateUuid(), action: action, entity: entity, entityId: entityId, user: user, details: details, createdAt: nowIso() }; }
