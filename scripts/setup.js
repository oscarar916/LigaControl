const fs = require('node:fs');
const path = require('node:path');

['reports/generated'].forEach((directory) => fs.mkdirSync(path.join(process.cwd(), directory), { recursive: true }));
console.log('Entorno local de LigaControl preparado.');
