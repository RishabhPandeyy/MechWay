const escapeHtml = value => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function formatRestorationTelegram(request, { dashboardBaseUrl, assetBaseUrl }) {
    const value = (input, limit = 250) => escapeHtml(String(input ?? '').trim().slice(0, limit) || 'Not provided');
    const id = String(request._id || '').slice(-6).toUpperCase();
    const lines = [
        `<b>New restoration request | MW-REST-${escapeHtml(id)}</b>`,
        '',
        `<b>Name:</b> ${value(request.fullName, 100)}`,
        `<b>Phone:</b> ${value(request.mobileNumber, 20)}`,
        `<b>WhatsApp:</b> ${value(request.whatsappNumber, 20)}`,
        `<b>Email:</b> ${value(request.email, 150)}`,
        `<b>Vehicle:</b> ${value(request.vehicleType, 20)} | ${value(request.brand, 80)} ${value(request.modelName, 80)}`,
        `<b>Year:</b> ${value(request.yearOfManufacture, 20)}`,
        `<b>Registration:</b> ${value(request.registrationNumber, 30)}`,
        `<b>Condition:</b> ${value(request.condition, 150)}`,
        `<b>Scope:</b> ${value(request.restorationType, 300)}`,
        `<b>Budget:</b> ${value(request.budgetRange, 100)}`,
        `<b>Pickup:</b> ${value(request.pickupAddress, 350)}, ${value(request.city, 100)}`,
        `<b>Notes:</b> ${value(request.specialNotes, 500)}`,
        ''
    ];
    const lat = Number(request.latitude);
    const lon = Number(request.longitude);
    if (request.latitude != null && request.longitude != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        lines.push(`<a href="https://www.openstreetmap.org/?mlat=${lat}&amp;mlon=${lon}#map=17/${lat}/${lon}">Open pickup location</a>`);
    }
    const photos = [
        ['Front', request.vehiclePhotos?.front],
        ['Back', request.vehiclePhotos?.rear],
        ['Left', request.vehiclePhotos?.left],
        ['Right', request.vehiclePhotos?.right]
    ];
    for (const [label, filePath] of photos) {
        if (filePath && /^\/uploads\/restoration\/[A-Za-z0-9._-]+$/.test(filePath)) {
            const url = new URL(filePath, assetBaseUrl).href;
            lines.push(`<a href="${escapeHtml(url)}">${label} vehicle photo</a>`);
        }
    }
    const dashboardUrl = new URL('/server/admin.html', dashboardBaseUrl).href;
    lines.push('', `<b>RC:</b> View in the protected admin panel`, `<a href="${escapeHtml(dashboardUrl)}">Open admin panel</a>`);
    return lines.join('\n');
}

module.exports = { formatRestorationTelegram };
