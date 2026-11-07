const escapeHtml = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const events = {
    restorationEnquiry: ['New bike / car restoration enquiry', {
        _id: 'Enquiry ID', fullName: 'Name', vehicleType: 'Vehicle', city: 'Location', budgetRange: 'Budget'
    }],
    booking: ['New booking request', {
        _id: 'Booking ID', name: 'Name', phone: 'Phone', vehicleType: 'Vehicle', vehicleBrand: 'Brand',
        vehicleModel: 'Model', vehicleNumber: 'Registration', vehicleColor: 'Colour', serviceType: 'Visit type',
        bookingDate: 'Date', timeSlot: 'Time slot', problem: 'Service', servicePrice: 'Visiting charge (INR)',
        message: 'Location / details', mechanicName: 'Preferred mechanic', mechanicPhone: 'Mechanic phone'
    }],
    signup: ['New mechanic registration - approval required', {
        _id: 'Mechanic ID', name: 'Name', phone: 'Phone', email: 'Email', address: 'Address',
        mechanicType: 'Vehicle expertise', experience: 'Experience', serviceArea: 'Service area'
    }],
    contact: ['New contact enquiry', { _id: 'Enquiry ID', name: 'Name', phone: 'Phone', email: 'Email', subject: 'Subject', message: 'Message' }],
    payment: ['New payment record', {
        _id: 'Record ID', bookingId: 'Booking ID', customerName: 'Customer', customerPhone: 'Phone',
        totalAmount: 'Amount (INR)', paymentMethod: 'Method', status: 'Payment status', service: 'Service', mechanicName: 'Mechanic'
    }],
    workSlip: ['Mechanic submitted a work slip', {
        _id: 'Booking ID', name: 'Customer', phone: 'Phone', mechanicName: 'Mechanic', summary: 'Summary',
        workDone: 'Work completed', partsUsed: 'Parts', labourCharge: 'Labour (INR)', partsCharge: 'Parts (INR)',
        totalCharge: 'Total (INR)', platformCommission: 'MechWay commission (INR)', notes: 'Notes'
    }],
    profile: ['Mechanic profile updated', { _id: 'Mechanic ID', name: 'Name', phone: 'Phone', mechanicType: 'Vehicle expertise', serviceArea: 'Service area' }],
    payout: ['New mechanic payout request', { _id: 'Request ID', mechanicId: 'Mechanic ID', mechanicName: 'Mechanic', amount: 'Amount (INR)', paymentMethod: 'Method', status: 'Status' }]
};

function formatSubmission(event, record, dashboardBaseUrl = 'https://www.mechway.in') {
    const definition = events[event];
    if (!definition) throw new Error('Unknown notification event');
    const [title, fields] = definition;
    const lines = [`<b>${title}</b>`, ''];
    // An explicit allowlist keeps passwords, identity documents and banking details out of chat.
    for (const [key, label] of Object.entries(fields)) {
        const raw = String(record[key] ?? '').trim();
        if (!raw) continue;
        const shortened = raw.length > 180 ? raw.slice(0, 177) + '...' : raw;
        lines.push(`<b>${label}:</b> ${escapeHtml(shortened)}`);
    }
    const lat = Number(record.latitude), lon = Number(record.longitude);
    if (record.latitude != null && record.longitude != null && record.latitude !== '' && record.longitude !== '' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        lines.push(`<a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}">Open location</a>`);
    }
    lines.push('', `<a href="${escapeHtml(new URL('/server/admin.html', dashboardBaseUrl).href)}">Full details in admin panel</a>`);
    return lines.join('\n');
}

function createTelegramNotifier({ env, post, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), logger = console }) {
    const token = String(env.TELEGRAM_BOT_TOKEN || '').trim();
    const chatId = String(env.TELEGRAM_CHAT_ID || '').trim();
    const tokenConfigured = !!token && token !== 'YOUR_BOT_TOKEN_HERE';
    const chatConfigured = !!chatId && chatId !== 'YOUR_CHAT_ID_HERE';
    const lastDelivery = {};
    function finish(event, status, reason) {
        const result = { status, ...(reason ? { reason } : {}) };
        lastDelivery[event] = { ...result, checkedAt: new Date().toISOString() };
        if (status !== 'sent') logger.error(`Telegram ${event}: ${reason}`);
        return result;
    }
    async function send(text, event = 'submission') {
        if (!tokenConfigured || !chatConfigured) return finish(event, 'not_configured', 'missing_credentials');
        for (let attempt = 0; attempt < 2; attempt++) {
            let status, data;
            try {
                const response = await post(`https://api.telegram.org/bot${token}/sendMessage`, {
                    chat_id: chatId, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true }
                }, { timeout: 8000 });
                if (response.data?.ok === true) return finish(event, 'sent');
                status = response.data?.error_code || response.status;
                data = response.data;
            } catch (error) {
                status = error.response?.data?.error_code || error.response?.status;
                data = error.response?.data;
            }
            const wait = status === 429 ? Number(data?.parameters?.retry_after ?? 1) * 1000 : 500;
            const retryable = status == null || status === 429 || status >= 500;
            if (attempt === 0 && retryable && Number.isFinite(wait) && wait >= 0 && wait <= 3000) {
                await sleep(wait);
                continue;
            }
            // Never log the Axios error: it contains the bot token and customer message.
            const reason = status === 401 ? 'invalid_bot_token' : status === 403 ? 'bot_access_denied'
                : status === 400 ? 'invalid_chat_or_message' : status === 429 ? 'rate_limited' : 'delivery_failed';
            return finish(event, 'failed', reason);
        }
    }
    return { send, getStatus: () => ({ tokenConfigured, chatConfigured, lastDelivery: { ...lastDelivery } }) };
}

module.exports = { createTelegramNotifier, formatSubmission };
