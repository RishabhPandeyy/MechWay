const detailedRestorationFilter = { enquirySource: { $ne: 'restore-quick-form' } };

async function loadRestorationQuotes(RestorationQuote, RestorationRequest) {
    const [quotes, legacyQuotes] = await Promise.all([
        RestorationQuote.find({}).sort({ createdAt: -1 }).limit(500).lean(),
        RestorationRequest.find({ enquirySource: 'restore-quick-form' }).sort({ createdAt: -1 }).limit(500).lean()
    ]);
    // Keep older enquiries visible without rewriting production records.
    const unique = new Map();
    for (const quote of [...quotes, ...legacyQuotes]) {
        const id = String(quote._id);
        if (!unique.has(id)) unique.set(id, quote);
    }
    return [...unique.values()]
        .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
        .slice(0, 500);
}

module.exports = { loadRestorationQuotes, detailedRestorationFilter };
