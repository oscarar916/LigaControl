# Actas de eliminatorias en Resultados

## Backend requerido

Actualizar en el proyecto existente de Apps Script estos cuatro archivos, guardar y publicar una nueva versión de la implementación actual (misma URL):

- `backend/KnockoutService.gs`
- `backend/MatchService.gs`
- `backend/ResultsBootstrapService.gs`
- `backend/SanctionService.gs`

No hay cambios en el esquema de las hojas. Antes de esta actualización, la interfaz de Resultados informa que el backend requiere actualización y deshabilita la habilitación de actas; los resultados de grupos continúan funcionando.

## Uso

1. Confirmar las llaves en Eliminatorias, como hasta ahora.
2. Entrar en Resultados y abrir la pestaña «Resultados de eliminatorias». Al entrar se habilitan automáticamente los cruces confirmados que aún no tienen partido. «Actualizar partidos» permite reintentar si hay un error.
3. Elegir la ronda (Cuartos, Semifinales, Final o Tercer puesto). La pestaña «Resultados por fecha» solo muestra los grupos, y cada una conserva su selección de fecha o ronda.
4. Abrir el acta habitual: alineaciones, goles, tarjetas, nuevos jugadores y observaciones.
5. Guardar cada partido. Si empata, indicar ganador y definición en el acta; los penales del desempate no cuentan como goles individuales.
6. Cerrar la ronda para oficializar los resultados y habilitar los cruces siguientes.

Eliminatorias ofrece accesos a estas actas; ya no mantiene un formulario separado de marcador y ganador.

## Persistencia y correcciones

La habilitación es idempotente. Se identifica cada partido por el ID del plan y su índice de llave en las observaciones de PARTIDOS. Se conservan los marcadores previos, sin inventar goleadores, alineaciones ni tarjetas. En una migración con marcador previo, el acta advierte si faltan los goles individuales.

Los partidos usan `fase: KNOCKOUT` y jornadas posteriores a la última jornada de grupos. Los puntos de grupos excluyen estos partidos en Resultados, Reportes y vista pública. Partidos conserva la programación de grupos. Las tarjetas se acumulan solo dentro de su fase y las deudas históricas no cambian.

Los ganadores de las llaves se leen desde los partidos y actas oficializados. Una corrección de origen se bloquea si el cruce siguiente ya tiene marcador, eventos o acta guardada. Si todavía no tiene registros, la ronda puede reabrirse y corregirse; los equipos del siguiente partido se actualizan al volver a cerrar. Mientras la ronda anterior está reabierta, no se permite registrar incidencias en los partidos dependientes.
# Programación por ronda y reglas de eliminatorias (17/11/2026)

Actualizar también el archivo **KnockoutService.gs** en Apps Script y publicar una nueva versión del despliegue existente. El frontend por sí solo no habilita los guardados nuevos `schedule` y `settings`.

- Partidos → Eliminatorias: cada ronda tiene su desplegable de programación. Solo la primera partida de cada ronda lleva hora de inicio. Rondas con actas o resultados no se reprograman.
- Configuración → Fase de eliminatorias: desempate, acuerdos y tercer puesto. No permite cambiar tercer puesto después de habilitar partidos.
- No cambia cruces oficiales, goles, pagos ni tarjetas. Las rondas futuras conservan su programación hasta habilitarse sus partidos.

