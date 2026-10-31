const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const postcss = require('postcss');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
if (fs.existsSync(publicDir)) throw new Error('Frontend is already organized.');
const pages = [...fs.readdirSync(root).filter(file => file.endsWith('.html')), 'server/admin.html', 'server/restoration_admin.html'];
const images = fs.readdirSync(root).filter(file => /\.(png|jpe?g|svg|webp|avif)$/i.test(file));
const routes = Object.fromEntries(pages.map(file => [file, file === 'index.html' || file.startsWith('server/') ? `/${file}` : `/pages/${file}`]));
const resources = { ...routes };
for (const file of images) resources[file] = `/assets/images/${encodeURI(file)}`;
for (const file of ['ostyle.css', 'ocontact.css']) resources[file] = `/assets/css/${file}`;
resources['js/'] = '/assets/js/admin/';
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function rewrite(text) {
  for (const [file, url] of Object.entries(resources)) {
    text = text.replace(new RegExp(`(["'\x60(=])/?${escape(file)}(?=["'\x60?#)\\s])`, 'g'), (_, before) => before + url);
    text = text.replaceAll(`https://www.mechway.in/${file}`, `https://www.mechway.in${url}`);
  }
  return text.replace(/(["'])js\//g, '$1/assets/js/admin/');
}
function write(file, text) {
  const dest = path.join(publicDir, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, text);
}
function visit(node, fn) {
  fn(node);
  for (const child of node.childNodes || []) visit(child, fn);
  if (node.content) visit(node.content, fn);
}
function lightCss(css) {
  const ast = postcss.parse(css);
  ast.walkDecls(decl => {
    if (decl.prop === 'letter-spacing') decl.value = '0';
    if (decl.prop === '--r' || decl.prop === '--border-radius') decl.value = '8px';
    if (/^background/.test(decl.prop)) {
      decl.value = decl.value.replace(/#(?:080c10|0d1117|111820|0d0d0d|151515|1c1c1c|242424|111111|07090c|0e1117|161d27|0a0f16|0b1018|0a0a0a|121212|1a1a1a|000000|000)\b/gi, '#ffffff');
      decl.value = decl.value.replace(/rgba?\(\s*(?:8\s*,\s*12\s*,\s*16|13\s*,\s*13\s*,\s*13|7\s*,\s*9\s*,\s*12|0\s*,\s*0\s*,\s*0)\s*(?:,\s*[\d.]+)?\s*\)/gi, '#ffffff');
    }
  });
  return ast.toString();
}
for (const file of pages) {
  const source = rewrite(fs.readFileSync(path.join(root, file), 'utf8'));
  const doc = parse(source, { sourceCodeLocationInfo: true });
  const edits = [], css = [], scripts = [];
  let inline = 0;
  const slug = path.basename(file, '.html').toLowerCase().replaceAll('_', '-');
  visit(doc, node => {
    const loc = node.sourceCodeLocation;
    if (!loc) return;
    const attrs = Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
    if (node.tagName === 'style') {
      css.push(source.slice(loc.startTag.endOffset, loc.endTag.startOffset));
      edits.push({ start: loc.startOffset, end: loc.endOffset, text: '' });
    } else if (node.tagName === 'script' && !attrs.src && (!attrs.type || ['text/javascript', 'application/javascript', 'module'].includes(attrs.type))) {
      const number = scripts.length + 1;
      const scriptFile = `assets/js/pages/${slug}${number === 1 ? '' : `-${number}`}.js`;
      scripts.push({ file: scriptFile, text: source.slice(loc.startTag.endOffset, loc.endTag.startOffset) });
      edits.push({ start: loc.startOffset, end: loc.endOffset, text: `<script${attrs.type === 'module' ? ' type="module"' : ''} src="/${scriptFile}"></script>` });
    } else if (attrs.style && loc.attrs?.style) {
      const className = `inline-${slug}-${++inline}`;
      css.push(`.${className} { ${attrs.style} }`);
      const styleLoc = loc.attrs.style;
      edits.push({ start: styleLoc.startOffset, end: styleLoc.endOffset, text: attrs.class ? '' : `class="${className}"` });
      if (attrs.class) {
        const classLoc = loc.attrs.class;
        edits.push({ start: classLoc.startOffset, end: classLoc.endOffset, text: `class="${attrs.class} ${className}"` });
      }
    }
  });
  edits.sort((a, b) => b.start - a.start);
  let html = source;
  for (const edit of edits) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  html = html.replace('</head>', `  <link rel="stylesheet" href="/assets/css/pages/${slug}.css">\n  <link rel="stylesheet" href="/assets/css/theme.css">\n</head>`);
  write(file === 'index.html' || file.startsWith('server/') ? file : `pages/${file}`, html);
  write(`assets/css/pages/${slug}.css`, lightCss(css.join('\n')));
  for (const script of scripts) write(script.file, script.text);
  fs.unlinkSync(path.join(root, file));
}
for (const file of images) {
  const dest = path.join(publicDir, 'assets/images', file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(path.join(root, file), dest);
}
for (const file of ['ostyle.css', 'ocontact.css']) {
  write(`assets/css/${file}`, rewrite(fs.readFileSync(path.join(root, file), 'utf8')));
  fs.unlinkSync(path.join(root, file));
}
fs.mkdirSync(path.join(publicDir, 'assets/js'), { recursive: true });
fs.renameSync(path.join(root, 'js'), path.join(publicDir, 'assets/js/admin'));
// Keep existing admin URLs while moving browser files away from backend code.
fs.mkdirSync(path.join(publicDir, 'server'), { recursive: true });
for (const file of ['admin.css']) {
  fs.renameSync(path.join(root, 'server', file), path.join(publicDir, 'server', file));
}
fs.renameSync(path.join(root, 'server/js'), path.join(publicDir, 'server/js'));
write('routes.json', JSON.stringify(routes, null, 2) + '\n');
console.log(`Organized ${pages.length} pages and ${images.length} images in public/.`);
