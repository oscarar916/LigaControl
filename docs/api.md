# API conceptual

Base: `/api`. Respuesta exitosa: `{ "success": true, "data": {}, "meta": { "timestamp": "ISO-8601" } }`. Error: `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "status": 400 } }`. Todos los UUID son strings; los listados aceptan `championshipId`, `disciplineId`, `status`, `page` y `limit` cuando corresponda.

## Endpoints

| Método y ruta | Descripción | Parámetros / cuerpo | Request mínimo | Response `data` | Errores |
|---|---|---|---|---|---|
| `GET /api/championships` | Lista campeonatos | Query: `status`, paginación | `/api/championships?status=ACTIVE` | `{ "items": [], "total": 0 }` | 400, 401, 500 |
| `POST /api/championships` | Crea campeonato | `name`, `year`, `organizer`, fechas | `{ "name":"Copa 2027","year":2027,"organizer":"Liga" }` | `{ "id":"uuid", "status":"DRAFT" }` | 400, 401, 403, 409 |
| `GET /api/disciplines` | Lista disciplinas | Query: `championshipId` | `?championshipId=uuid` | `{ "items": [{"name":"Fulbito"}] }` | 400, 401, 404 |
| `GET /api/teams` | Lista equipos | Query: campeonato, disciplina | `?disciplineId=uuid` | `{ "items": [] }` | 400, 401, 404 |
| `POST /api/teams` | Crea equipo | IDs, `name`, delegado | `{ "championshipId":"uuid","disciplineId":"uuid","name":"EsSalud" }` | `{ "id":"uuid" }` | 400, 401, 403, 409 |
| `GET /api/players` | Lista jugadores | Query: `teamId`, `status` | `?teamId=uuid` | `{ "items": [] }` | 400, 401, 404 |
| `POST /api/players` | Crea jugador | `teamId`, DNI, nombre, camiseta | `{ "teamId":"uuid","dni":"12345678","fullName":"Ana Pérez" }` | `{ "id":"uuid" }` | 400, 401, 403, 409 |
| `GET /api/matches` | Lista partidos | Query: campeonato, fecha, estado | `?championshipId=uuid&status=SCHEDULED` | `{ "items": [] }` | 400, 401, 404 |
| `POST /api/matches` | Programa partido | campeonato, disciplina, local, visitante, fecha | `{ "homeId":"uuid","awayId":"uuid","date":"2026-08-10" }` | `{ "id":"uuid","status":"SCHEDULED" }` | 400, 401, 403, 409 |
| `PUT /api/matches/:id` | Actualiza/cierra partido | Path `id`; cuerpo parcial y marcador | `{ "homeScore":3,"awayScore":0,"closed":true }` | `{ "id":"uuid","status":"FINISHED" }` | 400, 401, 403, 404, 409 |
| `GET /api/events` | Lista eventos | Query: `matchId`, `type` | `?matchId=uuid` | `{ "items": [] }` | 400, 401, 404 |
| `POST /api/events` | Registra evento | partido, equipo, jugador opcional, tipo | `{ "matchId":"uuid","teamId":"uuid","type":"GOAL","minute":12 }` | `{ "id":"uuid" }` | 400, 401, 403, 404 |
| `GET /api/sanctions` | Lista sanciones | Query: campeonato, jugador, estado | `?playerId=uuid&status=ACTIVE` | `{ "items": [] }` | 400, 401, 404 |
| `POST /api/payments` | Registra pago | campeonato, concepto, monto, pagador | `{ "championshipId":"uuid","amount":10,"concept":"YELLOW_CARD" }` | `{ "id":"uuid","status":"PENDING" }` | 400, 401, 403, 409 |
| `GET /api/standings` | Calcula tabla | `championshipId`, `disciplineId`, fase | `?disciplineId=uuid` | `{ "positions": [] }` | 400, 401, 404, 422 |
| `GET /api/reports` | Lista/genera reportes | tipo, campeonato, formato | `?type=standings&format=pdf` | `{ "items": [], "downloadUrl": null }` | 400, 401, 403, 422 |
| `GET /api/audit` | Consulta auditoría | entidad, usuario, fechas, paginación | `?entity=PARTIDOS` | `{ "items": [], "total": 0 }` | 400, 401, 403 |

`PUT` y `DELETE` se transportarán inicialmente mediante `POST` con `_method` porque Apps Script expone de forma nativa `doGet` y `doPost`. Autenticación, autorización por rol, sanitización e idempotencia se detallarán antes de v0.3.
