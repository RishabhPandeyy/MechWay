const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');

const root = path.resolve(__dirname, '../public');
const privatePages = new Set(['auth.html', 'login.html', 'signup.html', 'mech-login.html', 'mech-signup.html', 'mech-dashboard.html']);
const links = [
  ['Home', '/index.html'],
  ['Services', '/pages/service.html'],
  ['Why Us', '/pages/why-us.html'],
  ['About', '/pages/about.html'],
  ['Contact', '/pages/contact.html']
];
const files = ['index.html', ...fs.readdirSync(path.join(root, 'pages')).filter(file => file.endsWith('.html') && !privatePages.has(file)).map(file => `pages/${file}`)];
let changed = 0;
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const edits = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    const loc = node.sourceCodeLocation;
    const classes = (attrs.class || '').split(/\s+/);
    if (loc && node.tagName === 'section' && attrs.id === 'for-mechanics') {
      edits.push({ start: loc.startOffset, end: loc.endOffset, text: '' });
      return;
    }
    if (loc && (classes.includes('nav-links') || classes.includes('navbar-menu') || attrs.id === 'mobile-nav')) {
      const mobile = attrs.id === 'mobile-nav';
      const close = mobile ? (node.childNodes || []).find(child => child.tagName === 'button') : null;
      const closeMarkup = close ? source.slice(close.sourceCodeLocation.startOffset, close.sourceCodeLocation.endOffset) + '\n' : '';
      const markup = links.map(([label, url]) => {
        if (file === 'index.html' && label === 'Contact') {
          label = 'Join as Mechanic';
          url = '/pages/mech-signup.html';
        }
        const active = url === '/' + file;
        const anchor = `<a href="${url}" class="navbar-link${active ? ' active' : ''}"${active ? ' aria-current="page"' : ''}>${label}</a>`;
        return node.tagName === 'ul' ? `<li>${anchor}</li>` : anchor;
      }).join('\n');
      edits.push({ start: loc.startTag.endOffset, end: loc.endTag.startOffset, text: '\n' + closeMarkup + markup + '\n' });
      return;
    }
    const destination = attrs.href || attrs['data-destination'] || '';
    if (loc && ['a', 'button'].includes(node.tagName) && /(?:^|\/)(?:auth|(?:mech-)?login|(?:mech-)?signup)\.html(?:[?#]|$)/i.test(destination)) {
      const target = node.parentNode?.tagName === 'li' ? node.parentNode : node;
      const targetLoc = target.sourceCodeLocation;
      edits.push({ start: targetLoc.startOffset, end: targetLoc.endOffset, text: '' });
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  let html = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
  if (html !== source) { fs.writeFileSync(path.join(root, file), html); changed++; }
}
console.log(`Updated navigation and removed account entry links on ${changed} customer pages.`);
