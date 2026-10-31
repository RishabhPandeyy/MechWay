const fs = require('node:fs');
const path = require('node:path');
const backend = process.argv[2];
if (!backend || !/^https?:\/\//.test(backend)) throw new Error('Usage: node scripts/update-frontend-urls.js https://your-backend.example');
const url = new URL(backend);
if (url.username || url.password || url.search || url.hash) throw new Error('Use a backend origin without credentials, query or fragment.');
const root = path.resolve(__dirname, '../public/assets/js/pages');
let count = 0;
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.js'))) {
  const target = path.join(root, file);
  const source = fs.readFileSync(target, 'utf8');
  const updated = source.replaceAll('https://newonwheels.onrender.com', url.origin);
  if (source !== updated) {
    fs.writeFileSync(target, updated);
    count++;
  }
}
console.log(`Updated production backend URL in ${count} page scripts.`);
