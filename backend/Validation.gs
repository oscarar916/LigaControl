function validateRequiredFields(data, fields) { var missing = fields.filter(function(field) { return data[field] === undefined || data[field] === null || data[field] === ''; }); return { valid: !missing.length, missing: missing }; }
function validateUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value)); }
function sanitizeText(value) { return String(value == null ? '' : value).replace(/[<>]/g, '').trim(); }
