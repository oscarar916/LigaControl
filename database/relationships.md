# Relaciones

- CAMPEONATOS 1:N DISCIPLINAS, CONFIGURACION, EQUIPOS, PARTIDOS, SANCIONES y PAGOS.
- DISCIPLINAS 1:N EQUIPOS y PARTIDOS; CONFIGURACION puede especializar reglas por disciplina.
- EQUIPOS 1:N JUGADORES y participa dos veces en PARTIDOS (`local_id`, `visitante_id`).
- PARTIDOS 1:N EVENTOS y ACTAS; un ganador opcional referencia EQUIPOS.
- EVENTOS N:1 EQUIPOS y opcionalmente N:1 JUGADORES; puede originar SANCIONES.
- SANCIONES se asignan opcionalmente a un EQUIPO o JUGADOR y pueden generar PAGOS.
- USUARIOS 1:N EVENTOS, PAGOS, ACTAS y AUDITORIA como actor creador.

Las relaciones N:N se materializan mediante entidades asociativas: equipos y jugadores compiten en múltiples ediciones creando registros por campeonato/equipo; PARTIDOS relaciona dos equipos dentro de una disciplina; EVENTOS relaciona participantes con partidos. En una evolución, `INSCRIPCIONES_EQUIPO` e `INSCRIPCIONES_JUGADOR` separarán identidad histórica e inscripción para reutilización transversal.

No se permiten partidos entre equipos de distinta disciplina/campeonato, jugadores en eventos ajenos a su equipo, ni eliminación física de entidades referenciadas. La baja lógica conserva historia y auditoría.
