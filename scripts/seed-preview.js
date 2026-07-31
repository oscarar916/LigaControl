const fs = require('node:fs');
const path = require('node:path');

const seedPath = path.join(process.cwd(), 'database', 'seed');
for (const name of fs.readdirSync(seedPath).filter((file) => file.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(seedPath, name), 'utf8'));
  console.log(`${name}: ${Array.isArray(data) ? data.length : Object.keys(data).length} registros/propiedades`);
}
