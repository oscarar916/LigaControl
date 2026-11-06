# Ingreso limpio a eliminatorias

Acuerdo indicado por el organizador el 5 de noviembre de 2026 para Fulbito del Campeonato Inter Microredes 2026.

Una vez cerradas todas las fechas de grupos, las suspensiones de esa fase no se arrastran a las eliminatorias. Se aplica a las tarjetas y expulsiones de grupos; no cancela posibles sanciones nuevas de la fase eliminatoria. Si se reabre una fecha de grupos, se vuelve a mostrar su suspensión original hasta completar el cierre.

El módulo `frontend/js/discipline-policy.js` limita la regla al campeonato y disciplina acordados. Reportes (incluido PDF), vista pública, resultados y sanciones usan la misma política. Los registros originales de tarjetas y suspensiones se conservan como historial. El contador de suspensiones excluye las que no se arrastran.

No se modifican importes, pagos ni estados de deuda. Una multa pendiente continúa pendiente y debe cobrarse. La implementación no borra tarjetas ni registra pagos ficticios, y no necesita actualizar Apps Script.
