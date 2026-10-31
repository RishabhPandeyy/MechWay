const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { parse } = require('parse5');
const { origin, pages } = require('./seo-config');
const root = path.resolve(__dirname, '../public');
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
const text = node => node?.value || (node?.childNodes || []).map(text).join('');
const clean = value => value.replace(/\s+/g, ' ').trim();
const publicTitles = new Set();
const publicDescriptions = new Set();

for (const page of pages) {
  const documentNodes = nodes(parse(fs.readFileSync(path.join(root, page.file), 'utf8')));
  function one(tag, predicate = () => true) {
    const matches = documentNodes.filter(node => node.tagName === tag && predicate(attrs(node)));
    assert.equal(matches.length, 1, `${page.file}: expected one ${tag}`);
    return matches[0];
  }
  const title = clean(text(one('title')));
  const description = attrs(one('meta', a => a.name === 'description')).content;
  assert.ok(title.length > 10 && title.length <= 75, `${page.file}: title length`);
  assert.ok(description.length > 20 && description.length <= 185, `${page.file}: description length`);
  const canonical = attrs(one('link', a => a.rel === 'canonical')).href;
  assert.equal(canonical, origin + page.path, `${page.file}: incorrect canonical URL`);
  const robots = attrs(one('meta', a => a.name === 'robots')).content;
  assert.ok(page.index ? !robots.includes('noindex') : robots.includes('noindex'), `${page.file}: incorrect indexing policy`);
  assert.equal(attrs(one('meta', a => a.property === 'og:url')).content, canonical);
  assert.equal(attrs(one('meta', a => a.property === 'og:title')).content, title);
  assert.equal(attrs(one('meta', a => a.property === 'og:description')).content, description);
  const image = new URL(attrs(one('meta', a => a.property === 'og:image')).content);
  assert.equal(image.origin, origin);
  assert.ok(fs.existsSync(path.join(root, image.pathname)), `${page.file}: missing social image`);
  const schemas = documentNodes.filter(node => node.tagName === 'script' && attrs(node).type === 'application/ld+json');
  if (!page.index) {
    assert.equal(schemas.length, 0, `${page.file}: account page has public schema`);
    continue;
  }
  assert.ok(!publicTitles.has(title), `${page.file}: duplicate title`);
  assert.ok(!publicDescriptions.has(description), `${page.file}: duplicate description`);
  publicTitles.add(title);
  publicDescriptions.add(description);
  assert.equal(documentNodes.filter(node => node.tagName === 'h1').length, 1, `${page.file}: public page must have one main heading`);
  assert.equal(schemas.length, 1, `${page.file}: expected one structured-data graph`);
  const schema = JSON.parse(text(schemas[0]));
  assert.equal(schema['@context'], 'https://schema.org');
  const ids = schema['@graph'].map(item => item['@id']);
  assert.equal(new Set(ids).size, ids.length, `${page.file}: duplicate schema IDs`);
  const webpage = schema['@graph'].find(item => item['@id'] === `${canonical}#webpage`);
  assert.equal(webpage.url, canonical);
  assert.equal(webpage.name, title);
  assert.ok(!schema['@graph'].some(item => item.aggregateRating || item.review), `${page.file}: unverified ratings in schema`);
  const visibleFaqs = documentNodes.filter(node => node.tagName === 'details' && Object.hasOwn(attrs(node), 'data-seo-faq'));
  const faqSchema = schema['@graph'].find(item => item['@type'] === 'FAQPage');
  if (visibleFaqs.length) {
    assert.equal(faqSchema.mainEntity.length, visibleFaqs.length);
    visibleFaqs.forEach((node, index) => {
      assert.equal(faqSchema.mainEntity[index].name, clean(text(nodes(node).find(child => child.tagName === 'summary'))));
      assert.equal(faqSchema.mainEntity[index].acceptedAnswer.text, clean(text(nodes(node).find(child => attrs(child).class === 'faq-answer'))));
    });
  }
}
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const expectedUrls = pages.filter(page => page.index).map(page => origin + page.path).sort();
assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]).sort(), expectedUrls, 'Sitemap contains noncanonical or private URLs');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
assert.ok(!robots.includes('Disallow: /pages/'), 'Robots must allow crawlers to read page noindex tags');
console.log(`SEO checks passed: ${pages.length} pages, ${expectedUrls.length} indexable URLs, unique metadata, valid JSON-LD and matching visible FAQs.`);
