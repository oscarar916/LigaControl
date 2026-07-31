# Diccionario de datos

## Campos comunes

| Campo | Tipo | Regla |
|---|---|---|
| `id` | string UUID | PK inmutable y obligatoria |
| `created_at`, `updated_at` | datetime ISO-8601 | auditoría temporal; UTC |
| `estado` | enum string | estado del ciclo de vida, obligatorio |
| `observaciones` | string | opcional, máximo definido por validación |

## Campos por tabla

| Tabla | Campo: tipo — significado |
|---|---|
| CAMPEONATOS | `nombre:string` denominación; `nombre_corto:string` alias; `anio:integer` edición; `organizador:string`; `fecha_inicio/date`, `fecha_fin/date`; `logo_url:string?` |
| DISCIPLINAS | `campeonato_id:uuid`; `nombre:string`; `codigo:string` único por campeonato; `tipo:string`; `reglamento_url:string?`; `configuracion:json?` |
| CONFIGURACION | `campeonato_id:uuid`; `disciplina_id:uuid?`; `clave:string`; `valor:string`; `tipo_dato:enum` (`STRING`,`NUMBER`,`BOOLEAN`,`JSON`); `descripcion:string?` |
| EQUIPOS | `campeonato_id:uuid`; `disciplina_id:uuid`; `nombre:string`; `delegado:string?`; `telefono:string?`; `uniforme:string?`; `logo_url:string?` |
| JUGADORES | `equipo_id:uuid`; `dni:string` validado y protegido; `nombre_completo:string`; `numero_camiseta:integer?`; `posicion:string?`; `foto_url:string?`; `fecha_nacimiento:date?` |
| PARTIDOS | IDs de campeonato/disciplina/local/visitante/ganador; `fase:string`; `jornada:string`; `fecha:date`; `hora:time`; `escenario:string`; marcadores `integer?`; `cerrado:boolean` |
| EVENTOS | IDs de partido/equipo/jugador/autor; `tipo:enum`; `minuto:integer?`; `detalle:string?` |
| SANCIONES | IDs de campeonato/evento/equipo/jugador; `tipo:string`; `motivo:string`; `fechas_suspension:integer?`; `monto:decimal?`; fechas inicio/fin |
| PAGOS | IDs de campeonato/equipo/jugador/sanción/autor; `concepto:string`; `monto:decimal >= 0`; `moneda:string` (`PEN`); `fecha:date`; `comprobante_url:string?`; `referencia:string?` |
| ACTAS | `partido_id:uuid`; `archivo_url:string`; `version:integer`; URLs opcionales de firmas; `created_by:uuid` |
| USUARIOS | `email:string` único; `nombre:string`; `rol:enum`; `institucion:string?`; `telefono:string?`; `ultimo_acceso:datetime?` |
| AUDITORIA | `usuario_id:uuid`; `accion:string`; `entidad:string`; `entidad_id:uuid`; `datos_antes/json?`; `datos_despues/json?`; `ip:string?`; `detalle:string?` |

Las URL apuntan a recursos autorizados de Drive. DNI y teléfono se tratan como texto para preservar ceros y restringir exposición. Las claves foráneas deben existir y estar activas según la regla de negocio.
