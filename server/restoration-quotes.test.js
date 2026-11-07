const test = require('node:test');
const assert = require('node:assert/strict');
const { loadRestorationQuotes, detailedRestorationFilter } = require('./restoration-quotes');
const fs = require('node:fs');
const vm = require('node:vm');
const { parse } = require('parse5');

test('new and historical quotes appear once in date order without detailed restoration requests', async () => {
    const queries = [];
    const model = rows => ({ find(filter) {
        queries.push(filter);
        return { sort() { return this; }, limit() { return this; }, async lean() { return rows; } };
    } });
    const quotes = await loadRestorationQuotes(
        model([{ _id: 'new', createdAt: '2026-11-05', fullName: 'Current' }]),
        model([{ _id: 'older', createdAt: '2026-11-01' }, { _id: 'new', createdAt: '2026-11-05', fullName: 'Legacy copy' }])
    );
    assert.deepEqual(queries, [{}, { enquirySource: 'restore-quick-form' }]);
    assert.deepEqual(quotes.map(row => row._id), ['new', 'older']);
    assert.equal(quotes[0].fullName, 'Current');
    assert.deepEqual(detailedRestorationFilter, { enquirySource: { $ne: 'restore-quick-form' } });
});

test('admin renders quotes separately with search, counts and WhatsApp link; refresh replaces rows', async () => {
    const elements = new Map();
    function walk(node) {
        const id = node.attrs?.find(attr => attr.name === 'id')?.value;
        if (id) elements.set(id, { value: '', style: {}, innerHTML: '', listeners: {},
            addEventListener(event, handler) { this.listeners[event] = handler; }, querySelectorAll() { return []; } });
        for (const child of node.childNodes || []) walk(child);
    }
    walk(parse(fs.readFileSync(require.resolve('../public/server/admin.html'), 'utf8')));
    const payload = { restorationQuotes: [{ _id: 'quote1', fullName: '<Test>', whatsappNumber: '9876543210',
        vehicleType: 'Bike', city: 'Prayagraj', budgetRange: '₹15,000', status: 'pending' }], restorations: [] };
    const context = vm.createContext({
        localStorage: { getItem() { return 'test-key'; }, removeItem() {}, setItem() {} },
        document: { getElementById(id) { assert(elements.has(id), `Missing admin element: ${id}`); return elements.get(id); }, querySelectorAll() { return []; } },
        window: { location: { hostname: 'localhost', protocol: 'http:' }, alert(message) { throw new Error(message); } },
        fetch: async () => ({ ok: true, text: async () => JSON.stringify(payload) })
    });
    vm.runInContext(fs.readFileSync(require.resolve('../public/assets/js/pages/admin.js'), 'utf8'), context);
    await new Promise(resolve => setImmediate(resolve));
    const table = elements.get('tbody-restoration-quotes');
    assert.match(table.innerHTML, /&lt;Test&gt;/);
    assert.match(table.innerHTML, /https:\/\/wa.me\/919876543210/);
    assert.equal(elements.get('badge-restoration-quotes').textContent, 1);
    assert.match(elements.get('tbody-restorations').innerHTML, /No data found/);
    elements.get('search-restoration-quotes').listeners.input({ target: { value: 'missing' } });
    assert.match(table.innerHTML, /No data found/);
    await elements.get('refresh-btn').listeners.click();
    assert.equal((table.innerHTML.match(/<tr>/g) || []).length, 1);
});
