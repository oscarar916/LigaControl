# Despliegue

1. Crear el proyecto de Google Apps Script y asociar los archivos de `backend/`.
2. Crear el Spreadsheet con las hojas del esquema y una carpeta Drive dedicada.
3. Guardar `SPREADSHEET_ID`, `DRIVE_FOLDER_ID` y configuración sensible en Script Properties.
4. Ejecutar las funciones de preparación y autorizar solo los scopes requeridos.
5. Desplegar como Web App, ejecutar como propietario técnico y restringir acceso según el entorno.
6. Copiar la URL `/exec` a la configuración de despliegue del frontend y ejecutar pruebas de humo.

Usar despliegues separados para desarrollo, pruebas y producción. Versionar el código, no los secretos; revisar permisos de Apps Script, Sheets y Drive en cada release. Los archivos generados vivirán en Drive y Sheets conservará únicamente su ID, URL controlada y metadatos.
