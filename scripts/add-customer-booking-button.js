const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const root = path.resolve(__dirname, '../public/pages');
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html') && file !== 'mechanic.html')) {
  const filename = path.join(root, file);
  const source = fs.readFileSync(filename, 'utf8');
  if (!source.includes('/assets/css/customer-theme.css') || source.includes('customer-booking-button')) continue;
  let host;
  function visit(node) {
    const classes = (node.attrs?.find(attr => attr.name === 'class')?.value || '').split(/\s+/);
    if (node.tagName === 'header' && classes.includes('navbar')) {
      host = node.childNodes.find(child => child.attrs?.some(attr => attr.name === 'class' && /(?:^|\s)(?:nav-inner|navbar-container)(?:\s|$)/.test(attr.value))) || node;
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  if (!host) throw new Error('Missing navbar: ' + file);
  const offset = host.sourceCodeLocation.endTag.startOffset;
  const button = '<a class="customer-booking-button" href="/pages/mechanic.html">Book a Mechanic <i class="fas fa-arrow-right" aria-hidden="true"></i></a>\n';
  fs.writeFileSync(filename, source.slice(0, offset) + button + source.slice(offset));
  console.log(file);
}
