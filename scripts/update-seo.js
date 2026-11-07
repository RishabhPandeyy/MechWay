const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('parse5');
const { origin, pages } = require('./seo-config');
const root = path.resolve(__dirname, '../public');
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attrs = node => Object.fromEntries((node.attrs || []).map(attr => [attr.name, attr.value]));
const nodes = node => [node, ...(node.childNodes || []).flatMap(nodes)];
const text = node => node?.value || (node?.childNodes || []).map(text).join('');
const normal = value => value.replace(/\s+/g, ' ').trim();
const companyId = `${origin}/#organization`;
const websiteId = `${origin}/#website`;
const city = { '@type': 'City', name: 'Prayagraj', alternateName: 'Allahabad', containedInPlace: { '@type': 'AdministrativeArea', name: 'Uttar Pradesh, India' } };
const country = { '@type': 'Country', name: 'India' };
const serviceDetails = {
  repair: { name: 'Doorstep bike and car mechanic service in Prayagraj', serviceType: 'Mobile mechanic, roadside assistance and vehicle repair' },
  restoration: { name: 'Bike and car restoration and customization across India', serviceType: 'Vehicle restoration, bike and car customization, modification planning, mechanical rebuild, paint and body work' },
  'bike-restoration': { name: 'Classic bike restoration in Prayagraj', serviceType: 'Motorcycle engine, paint, chrome, wiring and suspension restoration' }
};
const selectedFiles = new Set(process.argv.slice(2));

function deferContentImages(source, page) {
  const edits = [];
  for (const node of nodes(parse(source, { sourceCodeLocationInfo: true }))) {
    if (node.tagName !== 'img') continue;
    const a = attrs(node);
    if (a.loading || a.fetchpriority === 'high') continue;
    let deferred = page.kind === 'bike-restoration';
    for (let parent = node.parentNode; parent; parent = parent.parentNode) {
      if (parent.tagName === 'footer' || /(?:^|\s)(?:gallery-grid|gallery-item|product-card|card-img-wrap|brand-track|svc-grid)(?:\s|$)/.test(attrs(parent).class || '')) deferred = true;
    }
    if (!deferred) continue;
    const tag = node.sourceCodeLocation.startTag;
    const offset = tag.endOffset - (source[tag.endOffset - 2] === '/' ? 2 : 1);
    edits.push({ offset, value: ` loading="lazy"${a.decoding ? '' : ' decoding="async"'}` });
  }
  for (const edit of edits.sort((a, b) => b.offset - a.offset)) source = source.slice(0, edit.offset) + edit.value + source.slice(edit.offset);
  return source;
}

function structuredData(page, documentNodes, image) {
  const url = origin + page.path;
  const pageId = `${url}#webpage`;
  const webpage = {
    '@type': page.kind === 'about' ? 'AboutPage' : page.kind === 'contact' ? 'ContactPage' : page.kind === 'shop' ? 'CollectionPage' : 'WebPage',
    '@id': pageId, url, name: page.title, description: page.description, inLanguage: 'en-IN',
    isPartOf: { '@id': websiteId }, about: { '@id': companyId },
    primaryImageOfPage: { '@type': 'ImageObject', url: origin + image }
  };
  const graph = [
    {
      '@type': 'Organization', '@id': companyId, name: 'MechWay', url: origin + '/',
      logo: { '@type': 'ImageObject', url: `${origin}/assets/images/mechwaynew.png` },
      telephone: '+919794575236', email: 'support@mechway.in', areaServed: page.kind === 'restoration' ? country : city,
      sameAs: ['https://www.instagram.com/mechway.in/'],
      contactPoint: { '@type': 'ContactPoint', telephone: '+919794575236', email: 'support@mechway.in', contactType: 'customer support', availableLanguage: ['English', 'Hindi'] }
    },
    { '@type': 'WebSite', '@id': websiteId, url: origin + '/', name: 'MechWay', publisher: { '@id': companyId }, inLanguage: 'en-IN' },
    webpage
  ];
  if (page.path !== '/') {
    const breadcrumbId = `${url}#breadcrumb`;
    webpage.breadcrumb = { '@id': breadcrumbId };
    graph.push({ '@type': 'BreadcrumbList', '@id': breadcrumbId, itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'MechWay Home', item: origin + '/' },
      { '@type': 'ListItem', position: 2, name: normal(text(documentNodes.find(node => node.tagName === 'h1'))), item: url }
    ] });
  }
  const services = page.kind === 'home' ? ['repair', 'restoration'] : serviceDetails[page.kind] ? [page.kind] : [];
  for (const kind of services) {
    const id = `${url}#${kind}-service`;
    graph.push({ '@type': 'Service', '@id': id, ...serviceDetails[kind], provider: { '@id': companyId }, areaServed: page.kind === 'restoration' ? country : city, url: page.kind === 'home' ? `${origin}/pages/${kind === 'repair' ? 'mechanic' : 'startrestoration'}.html` : url });
    webpage.mainEntity = [...(webpage.mainEntity || []), { '@id': id }];
  }
  if (page.kind === 'article') {
    const id = `${url}#article`;
    webpage.mainEntity = { '@id': id };
    graph.push({ '@type': 'BlogPosting', '@id': id, headline: normal(text(documentNodes.find(node => node.tagName === 'h1'))), description: page.description, image: origin + image, inLanguage: 'en-IN', mainEntityOfPage: { '@id': pageId }, author: { '@id': companyId }, publisher: { '@id': companyId } });
  }
  const faqs = documentNodes.filter(node => node.tagName === 'details' && Object.hasOwn(attrs(node), 'data-seo-faq'));
  if (faqs.length) {
    const id = `${url}#faq`;
    webpage.hasPart = { '@id': id };
    graph.push({ '@type': 'FAQPage', '@id': id, mainEntity: faqs.map(node => ({
      '@type': 'Question', name: normal(text(nodes(node).find(child => child.tagName === 'summary'))),
      acceptedAnswer: { '@type': 'Answer', text: normal(text(nodes(node).find(child => attrs(child).class === 'faq-answer'))) }
    })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

for (const page of pages) {
  if (selectedFiles.size && !selectedFiles.has(page.file)) continue;
  const file = path.join(root, page.file);
  const source = fs.readFileSync(file, 'utf8');
  const documentNodes = nodes(parse(source, { sourceCodeLocationInfo: true }));
  const head = documentNodes.find(node => node.tagName === 'head');
  const start = head.sourceCodeLocation.startTag.endOffset;
  const end = head.sourceCodeLocation.endTag.startOffset;
  const managedNames = new Set(['description', 'robots', 'keywords', 'author', 'geo.region', 'geo.placename']);
  const managed = nodes(head).filter(node => {
    const a = attrs(node);
    return node.tagName === 'title' || (node.nodeName === '#comment' && node.data.trim() === 'Search metadata') ||
      (node.tagName === 'meta' && (managedNames.has(a.name) || a.name?.startsWith('twitter:') || a.property?.startsWith('og:'))) ||
      (node.tagName === 'link' && (a.rel === 'canonical' || (a.rel === 'preload' && a.as === 'image' && a.href === '/assets/images/restoration-hero.jpg'))) || (node.tagName === 'script' && a.type === 'application/ld+json');
  });
  let headContent = source.slice(start, end);
  // Replace only managed metadata using parser offsets; preserve the rest of each page.
  for (const node of managed.sort((a, b) => b.sourceCodeLocation.startOffset - a.sourceCodeLocation.startOffset)) {
    const location = node.sourceCodeLocation;
    headContent = headContent.slice(0, location.startOffset - start) + headContent.slice(location.endOffset - start);
  }
  const image = page.kind?.includes('restoration') ? '/assets/images/restoration-hero.jpg' : '/assets/images/mechanic.jpg';
  const url = origin + page.path;
  const metadata = [
    `  <title>${escape(page.title)}</title>`,
    `  <meta name="description" content="${escape(page.description)}">`,
    `  <meta name="robots" content="${page.index ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}">`,
    `  <link rel="canonical" href="${escape(url)}">`,
    '  <meta property="og:site_name" content="MechWay">',
    `  <meta property="og:type" content="${page.kind === 'article' ? 'article' : 'website'}">`,
    '  <meta property="og:locale" content="en_IN">',
    `  <meta property="og:title" content="${escape(page.title)}">`,
    `  <meta property="og:description" content="${escape(page.description)}">`,
    `  <meta property="og:url" content="${escape(url)}">`,
    `  <meta property="og:image" content="${origin}${image}">`,
    `  <meta property="og:image:alt" content="${page.kind?.includes('restoration') ? 'Vehicle restoration at MechWay' : 'MechWay vehicle mechanic service'}">`,
    '  <meta name="twitter:card" content="summary_large_image">',
    `  <meta name="twitter:title" content="${escape(page.title)}">`,
    `  <meta name="twitter:description" content="${escape(page.description)}">`,
    `  <meta name="twitter:image" content="${origin}${image}">`
  ];
  if (page.kind === 'restoration') metadata.push('  <link rel="preload" as="image" href="/assets/images/restoration-hero.jpg" fetchpriority="high">');
  if (page.index) metadata.push(`  <script type="application/ld+json">\n${JSON.stringify(structuredData(page, documentNodes, image), null, 2).replace(/</g, '\\u003c')}\n  </script>`);
  headContent = headContent.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').trimEnd();
  const updated = deferContentImages(source.slice(0, start) + headContent + '\n\n  <!-- Search metadata -->\n' + metadata.join('\n') + '\n' + source.slice(end), page);
  if (updated !== source) fs.writeFileSync(file, updated);
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  pages.filter(page => page.index).map(page => `  <url><loc>${escape(origin + page.path)}</loc></url>`).join('\n') + '\n</urlset>\n';
const robots = `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /uploads/\nDisallow: /private-uploads/\n\nSitemap: ${origin}/sitemap.xml\n`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap);
fs.writeFileSync(path.join(root, 'robots.txt'), robots);
console.log(`Updated SEO for ${selectedFiles.size || pages.length} pages; sitemap contains ${pages.filter(page => page.index).length} public URLs.`);
