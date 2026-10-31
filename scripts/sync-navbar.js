const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');

const root = path.resolve(__dirname, '../public');
const links = [
  ['Home', '/index.html'],
  ['Services', '/pages/service.html'],
  ['Why Us', '/pages/why-us.html'],
  ['Restoration', '/pages/restore.html'],
  ['Join as Mechanic', '/pages/mech-signup.html']
];
const files = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter(f => f.endsWith('.html')).map(f => `pages/${f}`)];
for (const file of files) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  const document = parse(source, { sourceCodeLocationInfo: true });
  const edits = [];
  let hasHeader = false;
  const attrs = node => Object.fromEntries((node.attrs || []).map(a => [a.name, a.value]));
  const classes = node => (attrs(node).class || '').split(/\s+/);
  function mark(node, name) {
    if (classes(node).includes(name)) return;
    const loc = node.sourceCodeLocation;
    let tag = source.slice(loc.startTag.startOffset, loc.startTag.endOffset);
    tag = attrs(node).class !== undefined ? tag.replace(/class="([^"]*)"/, (_, value) => `class="${value} ${name}"`) : tag.replace(/>$/, ` class="${name}">`);
    edits.push({ start: loc.startTag.startOffset, end: loc.startTag.endOffset, text: tag });
  }
  function visit(node, inHeader = false) {
    const a = attrs(node);
    const c = classes(node);
    const loc = node.sourceCodeLocation;
    if (node.tagName === 'header' && loc && (c.includes('navbar') || c.includes('site-header') || c.includes('portal-navbar') || c.includes('hdr') || file === 'pages/reset-password.html')) {
      inHeader = true;
      hasHeader = true;
      mark(node, 'mw-site-nav');
    }
    if (loc && inHeader && (c.includes('nav-inner') || c.includes('navbar-container') || c.includes('portal-nav-inner') || (file === 'index.html' && c.includes('navbar')))) mark(node, 'mw-nav-inner');
    if (loc && inHeader && node.tagName === 'a' && (node.childNodes || []).some(n => n.tagName === 'img')) mark(node, 'mw-nav-logo');
    const menu = inHeader && (c.includes('nav-links') || c.includes('navbar-menu') || c.includes('portal-navigation'));
    if (loc && (menu || a.id === 'mobile-nav')) {
      if (menu) mark(node, 'mw-nav-menu');
      const close = (node.childNodes || []).find(n => n.tagName === 'button');
      const closeMarkup = close ? source.slice(close.sourceCodeLocation.startOffset, close.sourceCodeLocation.endOffset) : '';
      const current = file === 'pages/startrestoration.html' ? '/pages/restore.html' : '/' + file;
      const markup = links.map(([label, href]) => {
        const active = href === current;
        const anchor = `<a href="${href}" class="navbar-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
        return node.tagName === 'ul' ? `<li>${anchor}</li>` : anchor;
      }).join('\n');
      edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, text: `\n${closeMarkup}\n${markup}\n` });
      return;
    }
    if (loc && inHeader && node.tagName === 'a' && c.includes('nav-logo') && !(node.childNodes || []).some(n => n.tagName === 'img')) {
      mark(node, 'mw-nav-logo');
      edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, text: '<img src="/assets/images/mechwaynew.png" alt="MechWay" width="102" height="68">' });
      return;
    }
    for (const child of node.childNodes || []) visit(child, inHeader);
  }
  visit(document);
  if (hasHeader && !source.includes('/assets/css/navigation.css')) {
    const offset = source.indexOf('</head>');
    edits.push({ start: offset, end: offset, text: '<link rel="stylesheet" href="/assets/css/navigation.css">\n' });
  }
  let html = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  if (html !== source) fs.writeFileSync(filename, html);
}
console.log('Shared navbar styling and customer links synchronized.');
