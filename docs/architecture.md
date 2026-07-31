# Arquitectura

LigaControl aplica una arquitectura por capas y separa presentación, transporte, dominio, persistencia y archivos.

```text
[Administrador / Público]
          |
[Frontend HTML/CSS/JS] ---- validación y experiencia
          |
[API HTTP / Apps Script] -- rutas, autenticación, respuestas
          |
[Servicios de dominio] ---- reglas y casos de uso
       /       \
[Google Sheets] [Google Drive]
 fuente única     actas, logos y reportes
          |
      [Auditoría]
```

El frontend nunca accede directamente a Sheets ni contiene secretos. La API valida, autoriza y delega; los servicios encapsulan las reglas; Sheets mantiene entidades estructuradas y Drive conserva archivos referenciados por ID/URL. Cada escritura actualiza timestamps y genera auditoría.

Google Sheets es la fuente única de verdad de los datos transaccionales. Las vistas, tablas y reportes son derivados reproducibles, no copias autoritativas. Esta separación facilita reemplazar el almacenamiento o la interfaz sin reescribir el dominio.

Flujo: usuario → validación cliente → solicitud API → autenticación/autorización → validación servidor → servicio → Sheets/Drive → auditoría → respuesta uniforme → actualización de UI.
