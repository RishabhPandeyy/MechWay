const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const routesFile = path.join(publicDir, 'routes.json');
const routes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
const renames = {};
for (const file of fs.readdirSync(path.join(publicDir, 'pages'))) {
  const normalized = file.toLowerCase().replaceAll('_', '-');
  if (file !== normalized) {
    renames[`/pages/${file}`] = `/pages/${normalized}`;
    fs.renameSync(path.join(publicDir, 'pages', file), path.join(publicDir, 'pages', normalized));
  }
}
function update(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) update(file);
    else if (/\.(html|css|js|json)$/.test(file)) {
      let source = fs.readFileSync(file, 'utf8');
      for (const [before, after] of Object.entries(renames)) source = source.replaceAll(before, after);
      fs.writeFileSync(file, source);
    }
  }
}
update(publicDir);
const finalRoutes = JSON.parse(fs.readFileSync(routesFile, 'utf8'));
fs.writeFileSync(path.join(publicDir, '_redirects'), Object.entries(finalRoutes).filter(([before]) => before !== 'index.html' && !before.startsWith('server/')).map(([before, after]) => `/${before} ${after} 301`).join('\n') + '\n');
fs.mkdirSync(path.join(root, 'docs/archive/scripts'), { recursive: true });
for (const file of ['deploy-backend.sh', 'update-frontend.sh']) {
  fs.renameSync(path.join(root, file), path.join(root, 'docs/archive/scripts', file));
}
fs.renameSync(path.join(root, 'update-frontend-urls.js'), path.join(root, 'scripts/update-frontend-urls.js'));
fs.mkdirSync(path.join(root, 'docs/legal'), { recursive: true });
fs.renameSync(path.join(root, 'terms&condition.md'), path.join(root, 'docs/legal/terms-and-conditions.md'));
console.log('Normalized page filenames and archived legacy setup scripts.');
