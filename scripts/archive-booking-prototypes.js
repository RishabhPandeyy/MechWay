const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const prototypes = ['mechanic-new', 'mechanic-new-flow', 'mechanichere', 'find-mechanic'];
const archive = path.join(root, 'docs/archive/frontend');
for (const slug of prototypes) {
  for (const [folder, extension] of [['pages', 'html'], ['assets/css/pages', 'css'], ['assets/js/pages', 'js']]) {
    const source = path.join(publicDir, folder, `${slug}.${extension}`);
    if (!fs.existsSync(source)) continue;
    const target = path.join(archive, folder, `${slug}.${extension}`);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.renameSync(source, target);
  }
}
function update(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) update(file);
    else if (/\.(html|js|json)$/.test(file)) {
      let source = fs.readFileSync(file, 'utf8');
      for (const slug of prototypes) source = source.replaceAll(`/pages/${slug}.html`, '/pages/mechanic.html');
      fs.writeFileSync(file, source);
    }
  }
}
update(publicDir);
const routesFile = path.join(publicDir, 'routes.json');
const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
for (const slug of prototypes) routes[`pages/${slug}.html`] = '/pages/mechanic.html';
fs.writeFileSync(routesFile, JSON.stringify(routes, null, 2) + '\n');
fs.writeFileSync(path.join(publicDir, '_redirects'), Object.entries(routes).filter(([before]) => before !== 'index.html' && !before.startsWith('server/')).map(([before, after]) => `/${before} ${after} 301`).join('\n') + '\n');
console.log('Archived four booking prototypes; their URLs now use the simplified booking page.');
