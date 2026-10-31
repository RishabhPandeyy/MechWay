const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parse } = require('parse5');
const postcss = require('postcss');
const root = path.resolve(__dirname, '../public');
const problems = [];
let pages = 0;
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function visit(node, fn) {
  fn(node);
  for (const child of node.childNodes || []) visit(child, fn);
}
function checkURL(url, source) {
  if (!url || /^(?:[a-z]+:|#|\/\/)/i.test(url) || url.includes('${')) return;
  const pathname = decodeURIComponent(url.split(/[?#]/)[0]);
  if (!pathname) return;
  const target = pathname.startsWith('/') ? path.join(root, pathname) : path.resolve(path.dirname(source), pathname);
  if (!fs.existsSync(target)) problems.push(`${path.relative(root, source)}: missing ${url}`);
}
for (const file of walk(root)) {
  const source = fs.readFileSync(file, 'utf8');
  if (file.endsWith('.html')) {
    pages++;
    visit(parse(source), node => {
      const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
      if (node.tagName === 'style' || attrs.style) problems.push(`${path.relative(root, file)}: inline CSS remains`);
      if (node.tagName === 'script' && !attrs.src && attrs.type !== 'application/ld+json') problems.push(`${path.relative(root, file)}: inline JavaScript remains`);
      if (attrs.src) checkURL(attrs.src, file);
      if (attrs.href) checkURL(attrs.href, file);
    });
  } else if (file.endsWith('.css')) {
    try {
      postcss.parse(source).walkDecls(decl => {
        if (decl.value.includes('data:')) return;
        for (const match of decl.value.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)) checkURL(match[1], file);
      });
    } catch (error) { problems.push(`${file}: ${error.message}`); }
  } else if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status) problems.push(result.stderr);
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Checked ${pages} HTML pages: local links, CSS extraction and JavaScript syntax passed.`);
