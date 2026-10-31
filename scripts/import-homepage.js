const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(process.argv[2], 'utf8');
const oldHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const oldCss = fs.readFileSync(path.join(root, 'public/assets/css/pages/index.css'), 'utf8');
const edits = [], styles = [], scripts = [], preserved = [];
function visit(node, fn) { fn(node); (node.childNodes || []).forEach(child => visit(child, fn)); }
visit(parse(oldHtml, { sourceCodeLocationInfo: true }), node => {
  const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
  if (node.tagName === 'section' && ['brands-band', 'pricing-section'].includes(attrs.class)) {
    const loc = node.sourceCodeLocation;
    preserved.push(oldHtml.slice(loc.startOffset, loc.endOffset));
  }
});
let inline = 0;
visit(parse(source, { sourceCodeLocationInfo: true }), node => {
  const loc = node.sourceCodeLocation;
  if (!loc) return;
  const attrs = Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
  if (node.tagName === 'style' || (node.tagName === 'script' && !attrs.src)) {
    (node.tagName === 'style' ? styles : scripts).push(source.slice(loc.startTag.endOffset, loc.endTag.startOffset));
    edits.push({ start: loc.startOffset, end: loc.endOffset, text: '' });
  } else if (attrs.style) {
    const className = `home-inline-${++inline}`;
    styles.push(`.${className} { ${attrs.style} }`);
    edits.push({ start: loc.attrs.style.startOffset, end: loc.attrs.style.endOffset, text: attrs.class ? '' : `class="${className}"` });
    if (attrs.class) edits.push({ start: loc.attrs.class.startOffset, end: loc.attrs.class.endOffset, text: `class="${attrs.class} ${className}"` });
  }
});
let html = source;
for (const edit of edits.sort((a, b) => b.start - a.start)) html = html.slice(0, edit.start) + edit.text + html.slice(edit.end);
html = html.replace('</head>', '<link rel="stylesheet" href="/assets/css/pages/index.css">\n<link rel="icon" href="/assets/images/mechwaynew.png">\n<link rel="canonical" href="https://www.mechway.in/">\n</head>');
html = html.replace('<!-- Problem', preserved[0] + '\n<!-- Problem');
html = html.replace('<!-- How', preserved[1] + '\n<!-- How');
html = html.replace('</body>', '<script src="/assets/js/pages/index.js"></script>\n<script src="/assets/js/pages/home-pricing.js"></script>\n</body>');
html = html.replaceAll('+919999999999', '+919794575236').replaceAll('+91 99999 99999', '+91 97945 75236');
const css = postcss.parse(styles.join('\n'));
css.walkDecls(decl => {
  if (decl.prop === 'letter-spacing') decl.value = '0';
  if (decl.prop.startsWith('--radius')) decl.value = '8px';
  if (decl.prop === 'font-size' && decl.value.includes('vw')) decl.value = decl.value.match(/clamp\(\s*([^,]+)/)?.[1] || '32px';
});
const extra = postcss.parse(oldCss);
extra.walkRules(rule => {
  if (!/^(\.brands-band|\.brand-heading|\.icon-button|marquee|\.brand-track|\.pricing-section|\.price-switch|\.visit-fees|\.price-table|\.price-explainer|\.sr-only)/.test(rule.selector)) rule.remove();
});
fs.writeFileSync(path.join(root, 'public/index.html'), html);
fs.writeFileSync(path.join(root, 'public/assets/css/pages/index.css'), css.toString() + '\n' + extra.toString() + '\n.pricing-section .shell, .brand-heading.shell { width: min(100% - 40px, 1180px); margin-inline: auto; }\n');
fs.writeFileSync(path.join(root, 'public/assets/js/pages/index.js'), scripts.join('\n'));
console.log('Imported supplied homepage, externalized CSS/JS, retained pricing and marquee.');
