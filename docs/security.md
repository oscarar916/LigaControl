# Seguridad

Aplicar mínimo privilegio y roles (`ADMIN`, `ORGANIZER`, `REFEREE`, `DELEGATE`, `VIEWER`). Cada solicitud deberá identificar al usuario, comprobar sesión y autorizar la acción sobre el campeonato. Validar tipos, longitudes, UUID y relaciones; sanitizar texto y neutralizar fórmulas al escribir en Sheets.

Registrar actor, acción, entidad, antes/después, fecha y contexto en auditoría inmutable. Minimizar DNI, teléfonos y fotos, limitar acceso, definir retención y atender la normativa peruana de protección de datos. No almacenar secretos, IDs sensibles ni credenciales en frontend o Git: usar Script Properties. Revisar permisos de Web App y Drive, evitar enlaces públicos por defecto y no exponer trazas internas.
