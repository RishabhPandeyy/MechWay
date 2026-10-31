const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const root = path.resolve(__dirname, '../public/pages');
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
  const filename = path.join(root, file);
  let source = fs.readFileSync(filename, 'utf8');
  const edits = [];
  function visit(node) {
    if (node.attrs?.some(attr => attr.name === 'class' && attr.value.split(/\s+/).includes('customer-brand-name'))) {
      edits.push(node.sourceCodeLocation);
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  }
  visit(parse(source, { sourceCodeLocationInfo: true }));
  for (const edit of edits.sort((a, b) => b.startOffset - a.startOffset)) source = source.slice(0, edit.startOffset) + source.slice(edit.endOffset);
  if (edits.length) fs.writeFileSync(filename, source);
}
