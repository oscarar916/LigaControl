# Eliminatorias

El módulo `frontend/eliminatorias.html` permite elegir 4, 8 o 16 clasificados por campeonato y disciplina. Empieza en semifinales, cuartos u octavos, respectivamente. Permite tercer puesto. Arma primero contra último (por ejemplo 1–16, 2–15, etc.), con los cabezas 1 y 2 en mitades distintas de la llave. Para ocho equipos conserva C1–C4 y C2–C3 en semifinales.

La cantidad se guarda con el borrador y puede cambiarse antes de confirmar. Se exige disponer de esa cantidad de equipos habilitados. Los borradores anteriores sin `size` se interpretan como ocho equipos, y se conservan sus rutas `semifinals`. La nueva propiedad `sources` almacena las rutas para todas las rondas. No hay pases libres automáticos para cantidades que no sean 4, 8 o 16.

## Publicación

Agregar `backend/KnockoutService.gs` al proyecto de Apps Script, actualizar `Api.gs` y `ConfigurationService.gs` y publicar una nueva versión de la implementación. Publicar también los archivos frontend. No se cambia el esquema de las hojas: se guarda un registro JSON con clave `KNOCKOUT_PLAN` en CONFIGURACION por campeonato y disciplina.

## Uso

Las flechas ↑ y ↓ cambian el orden de juego de los cruces de la primera ronda, manteniendo los enfrentamientos por posición y las rutas de la llave. Se guarda en el mismo arreglo `pairs` del backend existente, sin requerir una actualización de Apps Script. La hora de inicio siempre corresponde al primer partido del orden elegido. El orden queda fijado al confirmar las eliminatorias.

La pantalla principal muestra equipos fijos por posición (1–último, 2–penúltimo). Un borrador se recalcula desde la tabla al abrirlo; las llaves confirmadas se conservan. La programación del día pide fecha, cancha y una sola hora de inicio: se guarda en el primer partido y los demás no tienen hora estimada. La vista muestra las conexiones de ambas mitades hacia la final central. «Reglas y opciones» reúne desempate y tercer puesto. Se mantiene el formato de datos del backend existente, sin nueva actualización de Apps Script.

1. Abrir Eliminatorias. Se calcula una propuesta desde la tabla de grupos sin guardarla.
2. Elegir cantidad de clasificados, revisar los cruces automáticos, programar la jornada y guardar borrador.
3. Cerrar todas las fechas de grupos, acordar desempate y confirmar las llaves.
4. Guardar marcadores y ganadores; avanzan automáticamente. En empate es obligatorio indicar ganador y explicación.
5. Imprimir / PDF permite compartir la vista de llaves, con borrador u oficial claramente indicado.

Los cruces confirmados son inmutables en esta versión. Se pueden corregir marcadores, pero cambiar un ganador queda bloqueado si la siguiente ronda ya tiene resultados. La revisión evita sobrescribir datos de otra pestaña; si hay conflicto, recargar la página.

Los resultados eliminatorios se almacenan separados del fixture de grupos y no suman puntos a la tabla. Este primer módulo no registra actas individuales, tarjetas, goleadores ni sanciones de eliminatorias, y tampoco publica las llaves en la vista pública. No se deben cargar estos partidos como jornadas adicionales de grupos.
