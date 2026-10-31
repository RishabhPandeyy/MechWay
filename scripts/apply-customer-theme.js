const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const root = path.resolve(__dirname, '../public/pages');
const privatePages = new Set(['auth.html', 'login.html', 'signup.html', 'mech-login.html', 'mech-signup.html', 'mech-dashboard.html']);
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html') && !privatePages.has(file))) {
  const filename = path.join(root, file);
  let source = fs.readFileSync(filename, 'utf8');
  const edits = [];
  function visit(node) {
    const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
    if (node.tagName === 'link' && attrs.href?.startsWith('https://fonts.googleapis.com/css')) {
      const loc = node.sourceCodeLocation;
      edits.push({ start: loc.startOffset, end: loc.endOffset, text: '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">' });
    }
    if (node.tagName === 'head' && !source.includes('/assets/css/customer-theme.css')) {
      const start = node.sourceCodeLocation.endTag.startOffset;
      edits.push({ start, end: start, text: '<link rel="stylesheet" href="/assets/css/customer-theme.css">\n' });
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  for (const edit of edits.sort((a, b) => b.start - a.start)) source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  fs.writeFileSync(filename, source);
  console.log(file);
}
