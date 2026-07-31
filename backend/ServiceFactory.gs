function createServiceContract(entity) {
  return { get: function(context) { /* TODO: consultar Sheets con filtros de context.params. */ return { entity: entity, items: [], filters: context.params }; }, post: function(context) { /* TODO: validar y crear registro. */ return { entity: entity, id: generateUuid(), input: context.body }; }, put: function(context) { /* TODO: validar y actualizar registro. */ return { entity: entity, input: context.body }; }, delete: function(context) { /* TODO: aplicar baja lógica. */ return { entity: entity, deleted: false, input: context.body }; } };
}
