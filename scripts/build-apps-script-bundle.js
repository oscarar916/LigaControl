const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const output = path.join(root, 'reports', 'LigaControlBackend.gs');
const files = [
  'Config.gs',
  'Utils.gs',
  'Response.gs',
  'Validation.gs',
  'ServiceFactory.gs',
  'ChampionshipService.gs',
  'DisciplineService.gs',
  'ConfigurationService.gs',
  'TeamService.gs',
  'PlayerService.gs',
  'MatchService.gs',
  'EventService.gs',
  'MinuteService.gs',
  'SanctionService.gs',
  'PaymentService.gs',
  'ResultsBootstrapService.gs',
  'ReportService.gs',
  'AuditService.gs',
  'Api.gs',
  'Code.gs'
];

const banner = [
  '/**',
  ' * LigaControl Backend - bundle generado automáticamente.',
  ' * No edite este archivo directamente; modifique backend/*.gs y regenere.',
  ' */',
  ''
].join('\n');

const source = files.map((file) => {
  const content = fs.readFileSync(path.join(backend, file), 'utf8').trim();
  return `// ===== ${file} =====\n${content}`;
}).join('\n\n');

fs.writeFileSync(output, `${banner}${source}\n`, 'utf8');
console.log(`Bundle generado: ${output}`);
