# Eliminatorias

El módulo `frontend/eliminatorias.html` permite elegir 4, 8 o 16 clasificados por campeonato y disciplina. Empieza en semifinales, cuartos u octavos, respectivamente. Permite tercer puesto y rutas manuales en cada ronda. Propone primero contra último (por ejemplo 1–16, 2–15, etc.), con los cabezas 1 y 2 en mitades distintas de la llave. Para ocho equipos conserva C1–C4 y C2–C3 en semifinales.

La cantidad se guarda con el borrador y puede cambiarse antes de confirmar. Se exige disponer de esa cantidad de equipos habilitados. Los borradores anteriores sin `size` se interpretan como ocho equipos, y se conservan sus rutas `semifinals`. La nueva propiedad `sources` almacena las rutas para todas las rondas. No hay pases libres automáticos para cantidades que no sean 4, 8 o 16.

## Publicación

Agregar `backend/KnockoutService.gs` al proyecto de Apps Script, actualizar `Api.gs` y `ConfigurationService.gs` y publicar una nueva versión de la implementación. Publicar también los archivos frontend. No se cambia el esquema de las hojas: se guarda un registro JSON con clave `KNOCKOUT_PLAN` en CONFIGURACION por campeonato y disciplina.

## Uso

La pantalla principal muestra una fila por cruce. «Programar partidos» aplica una fecha y cancha comunes sin cambiar las horas. «Horario» permite excepciones por partido. «Reglas y opciones» reúne desempate, tercer puesto y edición del recorrido. El guardado usa el mismo formato de datos y no exige volver a actualizar Apps Script para este cambio visual.

1. Abrir Eliminatorias. Se calcula una propuesta desde la tabla de grupos sin guardarla.
2. Elegir manualmente equipos y rutas si lo acuerdan los delegados, programar cuartos y guardar borrador.
3. Cerrar todas las fechas de grupos, acordar desempate y confirmar las llaves.
4. Guardar marcadores y ganadores; avanzan automáticamente. En empate es obligatorio indicar ganador y explicación.
5. Imprimir / PDF permite compartir la vista de llaves, con borrador u oficial claramente indicado.

Los cruces confirmados son inmutables en esta versión. Se pueden corregir marcadores, pero cambiar un ganador queda bloqueado si la siguiente ronda ya tiene resultados. La revisión evita sobrescribir datos de otra pestaña; si hay conflicto, recargar la página.

Los resultados eliminatorios se almacenan separados del fixture de grupos y no suman puntos a la tabla. Este primer módulo no registra actas individuales, tarjetas, goleadores ni sanciones de eliminatorias, y tampoco publica las llaves en la vista pública. No se deben cargar estos partidos como jornadas adicionales de grupos.
