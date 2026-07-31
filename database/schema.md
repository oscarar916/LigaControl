# Esquema conceptual

Convenciones: todas las PK son UUID string; `*_id` es FK; `created_at` y `updated_at` son timestamps ISO-8601; `estado` es obligatorio salvo indicación. `?` indica campo opcional.

| Tabla | PK y FK | Campos obligatorios | Campos opcionales |
|---|---|---|---|
| CAMPEONATOS | PK `id` | `nombre`, `nombre_corto`, `anio`, `organizador`, `fecha_inicio`, `fecha_fin`, `estado`, `created_at`, `updated_at` | `logo_url`, `observaciones` |
| DISCIPLINAS | PK `id`; FK `campeonato_id`→CAMPEONATOS | `nombre`, `codigo`, `tipo`, `estado`, timestamps | `reglamento_url`, `configuracion`, `observaciones` |
| CONFIGURACION | PK `id`; FK `campeonato_id`; FK? `disciplina_id` | `clave`, `valor`, `tipo_dato`, `estado`, timestamps | `descripcion`, `observaciones` |
| EQUIPOS | PK `id`; FK `campeonato_id`, `disciplina_id` | `nombre`, `estado`, timestamps | `delegado`, `telefono`, `uniforme`, `logo_url`, `observaciones` |
| JUGADORES | PK `id`; FK `equipo_id` | `dni`, `nombre_completo`, `estado`, timestamps | `numero_camiseta`, `posicion`, `foto_url`, `fecha_nacimiento`, `observaciones` |
| PARTIDOS | PK `id`; FK `campeonato_id`, `disciplina_id`, `local_id`, `visitante_id`; FK? `ganador_id` | `fase`, `jornada`, `fecha`, `hora`, `escenario`, `estado`, `cerrado`, timestamps | `marcador_local`, `marcador_visitante`, `observaciones` |
| EVENTOS | PK `id`; FK `partido_id`, `equipo_id`; FK? `jugador_id`; FK `created_by`→USUARIOS | `tipo`, `created_at` | `minuto`, `detalle`, `estado`, `updated_at` |
| SANCIONES | PK `id`; FK `campeonato_id`; FK? `evento_id`, `equipo_id`, `jugador_id` | `tipo`, `motivo`, `fecha_inicio`, `estado`, timestamps | `fechas_suspension`, `monto`, `fecha_fin`, `observaciones` |
| PAGOS | PK `id`; FK `campeonato_id`; FK? `equipo_id`, `jugador_id`, `sancion_id`; FK `created_by` | `concepto`, `monto`, `moneda`, `fecha`, `estado`, timestamps | `comprobante_url`, `referencia`, `observaciones` |
| ACTAS | PK `id`; FK `partido_id`; FK `created_by` | `archivo_url`, `version`, `estado`, timestamps | `firma_local_url`, `firma_visitante_url`, `observaciones` |
| USUARIOS | PK `id` | `email`, `nombre`, `rol`, `estado`, timestamps | `institucion`, `telefono`, `ultimo_acceso`, `observaciones` |
| AUDITORIA | PK `id`; FK `usuario_id` | `accion`, `entidad`, `entidad_id`, `created_at` | `datos_antes`, `datos_despues`, `ip`, `detalle`, `estado`, `updated_at`, `observaciones` |

Tipos de EVENTOS: `GOAL`, `OWN_GOAL`, `YELLOW_CARD`, `RED_CARD`, `SUBSTITUTION`, `INJURY`, `WALKOVER`, `OBSERVATION`. Estados se definen por entidad y nunca se eliminan físicamente en la operación normal.
