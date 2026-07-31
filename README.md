# LigaControl

> Administra campeonatos deportivos de manera inteligente.

**Estado:** Alpha · **Versión:** 0.1.0

LigaControl es una plataforma reutilizable para gestionar campeonatos de hospitales, municipalidades, universidades, colegios, empresas y ligas. Nace con el XV Campeonato Inter Microrredes de Salud 2026, pero su modelo soporta múltiples campeonatos, ediciones y disciplinas configurables.

## Objetivo y funcionalidades previstas

Centralizar campeonatos, disciplinas, equipos, jugadores, fixture, resultados, eventos, sanciones, pagos, actas, tabla de posiciones, reportes, auditoría y consulta pública. Fulbito y vóley son las disciplinas iniciales; básquet, softbol, atletismo, tenis de mesa y otras se incorporarán por configuración.

## Arquitectura y tecnologías

El frontend desacoplado consume una API de Google Apps Script. Los servicios de dominio acceden a Google Sheets como fuente única de verdad y a Google Drive para archivos. La interfaz usa HTML5, CSS3, JavaScript ES6+, Bootstrap 5, Chart.js, SweetAlert2 y Font Awesome. Git y GitHub administran las versiones.

```text
frontend/  interfaz administrativa       public/    consulta pública
backend/   API y servicios Apps Script    database/  modelo y semillas
docs/      decisiones y guías             scripts/   automatización local
tests/     pruebas                         reports/   salidas generadas
```

## Ejecución local

```bash
npm install
npm start
npm run validate
npm run seed:preview
```

El servidor abre `frontend/index.html`. Para Apps Script, cree un proyecto, configure `SPREADSHEET_ID` mediante Script Properties, copie los `.gs` de `backend/`, autorice Sheets/Drive y publique como Web App. La URL desplegada deberá reemplazar el placeholder de `frontend/js/config.js`; no guarde secretos en el navegador.

## Git

El flujo usa `main`, `develop`, `feature/*`, `fix/*` y `release/*`. Cree una rama desde `develop`, haga commits pequeños y abra un Pull Request con squash merge. Convención: `tipo(alcance): descripción`; tipos habituales: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`.

## Roadmap

v0.1 establece la base; v0.2 incorpora Sheets; v0.3 la API; v0.4–v0.9 conectan dashboard, participantes, competición, disciplina, finanzas y portal público; v1.0 será la versión oficial. Véase [docs/roadmap.md](docs/roadmap.md).

## Autoría y licencia

JM & Soberón Constructora S.R.L. · Software privado; consulte [LICENSE](LICENSE).
