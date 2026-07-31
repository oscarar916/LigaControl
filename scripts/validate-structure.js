const fs = require('node:fs');
const path = require('node:path');

const required = [
  'README.md', 'CHANGELOG.md', 'LICENSE', '.gitignore', '.editorconfig', 'package.json',
  'frontend/index.html', 'frontend/dashboard.html', 'frontend/equipos.html',
  'frontend/jugadores.html', 'frontend/partidos.html', 'frontend/resultados.html',
  'frontend/reportes.html', 'frontend/css/styles.css', 'frontend/css/variables.css',
  'frontend/js/app.js', 'frontend/js/api.js', 'frontend/js/config.js',
  'backend/Code.gs', 'backend/Config.gs', 'backend/Api.gs', 'backend/Response.gs',
  'backend/Validation.gs', 'database/schema.md', 'database/dictionary.md',
  'database/relationships.md', 'docs/product-vision.md', 'docs/architecture.md',
  'docs/api.md', 'public/index.html', 'reports/README.md', 'tests/README.md'
];

const missing = required.filter((entry) => !fs.existsSync(path.join(process.cwd(), entry)));
const empty = required.filter((entry) => {
  const target = path.join(process.cwd(), entry);
  return fs.existsSync(target) && fs.statSync(target).isFile() && fs.statSync(target).size === 0;
});
if (missing.length || empty.length) {
  console.error(JSON.stringify({ missing, empty }, null, 2));
  process.exit(1);
}
console.log(`LigaControl: estructura válida (${required.length} archivos esenciales).`);
