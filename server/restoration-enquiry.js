const { saveSubmission } = require('./submission-request');
const budgets = {
    Bike: { '15000': '₹15,000', '45000': '₹45,000', '80000': '₹80,000+' },
    Car: { 'under-150000': 'Below ₹1.5 lakh', '150000-300000': '₹1.5–₹3 lakh', '300000-plus': '₹3 lakh+' }
};

function createRestorationEnquiryHandler({ RestorationQuote, notify, logger = console }) {
    return async (req, res) => {
        const body = req.body || {};
        const text = key => typeof body[key] === 'string' ? body[key].trim() : '';
        const fullName = text('name'), city = text('location'), vehicleType = text('vehicleType');
        const digits = text('whatsappNumber').replace(/\D/g, '');
        const whatsappNumber = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
        const budgetOption = text('budgetOption');
        const customBudget = typeof body.customBudget === 'number' || typeof body.customBudget === 'string'
            ? Number(body.customBudget) : NaN;
        if (!/^[6-9]\d{9}$/.test(whatsappNumber) || !fullName || fullName.length > 100 || !city || city.length > 300 || !Object.hasOwn(budgets, vehicleType)
            || !(Object.hasOwn(budgets[vehicleType], budgetOption) || budgetOption === 'custom')
            || (budgetOption === 'custom' && (!Number.isSafeInteger(customBudget) || customBudget < 1 || customBudget > 100000000))) {
            return res.status(400).json({ error: 'Enter your name, valid WhatsApp number, location, vehicle type and a valid budget.' });
        }
        let saved, created;
        try {
            ({ record: saved, created } = await saveSubmission(RestorationQuote, 'restoration-enquiry', body.requestId, {
                fullName, city, vehicleType, budgetOption, whatsappNumber,
                budgetRange: budgetOption === 'custom' ? `Custom: ₹${customBudget.toLocaleString('en-IN')}` : budgets[vehicleType][budgetOption],
                ...(budgetOption === 'custom' ? { customBudget } : {}),
                enquirySource: 'restore-quick-form', status: 'pending'
            }));
        } catch (error) {
            if (error.status) return res.status(error.status).json({ error: error.message });
            logger.error('Restoration enquiry: save_failed');
            return res.status(500).json({ error: 'Could not save your enquiry. Please try again.' });
        }
        if (!created) return res.status(200).json({ ok: true, id: saved._id, telegramNotification: { status: 'already_saved' } });
        let telegramNotification;
        try {
            telegramNotification = await notify('restorationEnquiry', saved);
        } catch {
            logger.error('Restoration enquiry: notification_failed');
            telegramNotification = { status: 'failed', reason: 'delivery_failed' };
        }
        return res.status(201).json({ ok: true, id: saved._id, telegramNotification });
    };
}

module.exports = { budgets, createRestorationEnquiryHandler };
