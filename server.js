const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });
const cors = require('cors');
const http = require('http'); // Required for Socket.io
const { Server } = require("socket.io"); // Real-time communication
const mongoose = require('mongoose'); // Database
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { calculateWorkSlipMoney } = require('./server/work-slip-money');
const { createPasswordResetHandlers, emailConfiguration, sessionMatches } = require('./server/password-reset');
const { createAdminMechanicHandlers } = require('./server/admin-mechanics');
const { VISIT_PRICE_BY_VEHICLE, calculateEarningSplit, bookingMechanicEarnings } = require('./server/visit-earnings');
const { formatRestorationTelegram } = require('./server/restoration-telegram');
const { createRestorationFiles } = require('./server/restoration-files');
const { createTelegramNotifier, formatSubmission } = require('./server/telegram-notifications');
const { createRestorationEnquiryHandler } = require('./server/restoration-enquiry');
const { saveSubmission } = require('./server/submission-request');
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-jwt-secret';
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || '',
    key_secret: process.env.RAZORPAY_KEY_SECRET || ''
});
// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(['/api', '/uploads', '/server'], (req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    next();
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
const restorationFiles = createRestorationFiles(() => mongoose.connection.db);
// Disk is a cache; MongoDB retains uploaded photos across host restarts/deploys.
app.get('/uploads/restoration/:filename', async (req, res) => {
    try {
        if (await restorationFiles.send(res, req.params.filename)) return;
        res.status(404).json({ error: 'Vehicle photo not found' });
    } catch (err) {
        console.error('Restoration photo read failed:', err.message);
        res.status(503).json({ error: 'Could not load vehicle photo' });
    }
});

const frontendDir = path.join(__dirname, 'public');
const frontendRoutes = require('./public/routes.json');
app.get('/index.html', (req, res) => res.redirect(308, '/' + req.originalUrl.slice(req.path.length)));
app.get(Object.keys(frontendRoutes).filter(route => route !== 'index.html' && !route.startsWith('server/')).map(route => '/' + route), (req, res) => {
    const target = frontendRoutes[req.path.slice(1)];
    res.redirect(308, target + req.originalUrl.slice(req.path.length));
});
app.use(express.static(frontendDir));

const restorationUploadDir = path.join(__dirname, 'uploads', 'restoration');
const restorationRcDir = path.join(__dirname, 'private-uploads', 'restoration-rc');
fs.mkdirSync(restorationUploadDir, { recursive: true });
fs.mkdirSync(restorationRcDir, { recursive: true });
const restorationPhotoFields = ['rcImage', 'govtIdImage', 'frontImage', 'rearImage', 'leftImage', 'rightImage'];
const restorationImageExtensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const restorationUpload = multer({
    storage: multer.diskStorage({
        destination: function (req, file, cb) {
            cb(null, ['rcImage', 'govtIdImage'].includes(file.fieldname) ? restorationRcDir : restorationUploadDir);
        },
        filename: function (req, file, cb) {
            const ext = restorationImageExtensions[file.mimetype];
            cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 10)}${ext}`);
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024, files: restorationPhotoFields.length },
    fileFilter: function (req, file, cb) {
        if (!restorationPhotoFields.includes(file.fieldname) || !restorationImageExtensions[file.mimetype]) {
            cb(new Error('Upload JPG, PNG or WebP images in the six required slots.'));
            return;
        }
        cb(null, true);
    }
});

// --- REAL-TIME SERVER SETUP ---
const server = http.createServer(app);
const io = new Server(server);

// --- MONGODB CONNECTION & SCHEMAS ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mechway';
mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.log('❌ MongoDB Error:', err));

// Mechanic Schema (with Geospatial Index)
const mechanicSchema = new mongoose.Schema({
    name: String,
    socketId: String,
    isOnline: { type: Boolean, default: false },
    location: {
        type: { type: String, default: 'Point' },
        coordinates: [Number] // [Longitude, Latitude]
    }
});
mechanicSchema.index({ location: '2dsphere' }); // Crucial for "Find Nearby" queries
const Mechanic = mongoose.model('Mechanic', mechanicSchema);

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },
    email: { type: String, unique: true, sparse: true },
    address: { type: String, default: '' },
    aadharNo: { type: String, unique: true, sparse: true },
    mechanicType: { type: String, default: '' },
    password: { type: String, required: true, select: false },
    passwordResetHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordResetRequestedAt: { type: Date, select: false },
    passwordResetOtpChallengeHash: { type: String, select: false },
    passwordResetOtpHash: { type: String, select: false },
    passwordResetOtpExpires: { type: Date, select: false },
    passwordResetOtpAttempts: { type: Number, select: false },
    sessionVersion: { type: Number, default: 0 },
    isAvailable: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    serviceArea: { type: String, default: '' },
    upiId: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankAccountNo: { type: String, default: '' },
    bankIfsc: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

const bookingSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    vehicleType: { type: String, default: '' },
    vehicleBrand: { type: String, default: '' },
    vehicleModel: { type: String, default: '' },
    vehicleNumber: { type: String, default: '' },
    vehicleColor: { type: String, default: '' },
    problem: { type: String, default: '' },
    serviceType: { type: String, default: '' },
    timeSlot: { type: String, default: '' },
    bookingDate: { type: Date, default: null },
    servicePrice: { type: Number, default: 0 },
    platformCommission: { type: Number, default: 0 },
    mechanicEarnings: { type: Number, default: null },
    message: { type: String, default: '' },
    latitude: { type: String, default: '' },
    longitude: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    preferredMechanicId: { type: String, default: '' },
    mechanicId: { type: String, default: '' },
    mechanicName: { type: String, default: '' },
    mechanicPhone: { type: String, default: '' },
    mechanicDetails: { type: Object, default: null },
    createdAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null }
}, { strict: false });
const Booking = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);

const paymentSchema = new mongoose.Schema({
    customerName: { type: String, default: '' },
    customerPhone: { type: String, default: '' },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    status: { type: String, required: true },
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    razorpayOrderId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });
const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

const contactSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    subject: { type: String, default: '' },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});
const Contact = mongoose.models.Contact || mongoose.model('Contact', contactSchema);

const restorationRequestSchema = new mongoose.Schema({
    fullName: { type: String, default: '' },
    vehicleType: { type: String, default: 'Bike' },
    mobileNumber: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    city: { type: String, default: '' },
    pickupAddress: { type: String, default: '' },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    brand: { type: String, default: '' },
    modelName: { type: String, default: '' },
    yearOfManufacture: { type: String, default: '' },
    condition: { type: String, default: '' },
    restorationImages: { type: [String], default: [] },
    vehiclePhotos: {
        front: { type: String, default: '' },
        rear: { type: String, default: '' },
        left: { type: String, default: '' },
        right: { type: String, default: '' }
    },
    rcDocument: { type: String, default: '' },
    govtIdDocument: { type: String, default: '' },
    rcPrivate: { type: Boolean, default: false },
    restorationType: { type: String, default: '' },
    budgetRange: { type: String, default: '' },
    budgetOption: { type: String, default: '' },
    customBudget: { type: Number },
    enquirySource: { type: String, default: '' },
    specialNotes: { type: String, default: '' },
    vehicleColor: { type: String, default: '' },
    registrationNumber: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
}, { strict: false });
const RestorationRequest = mongoose.models.RestorationRequest || mongoose.model('RestorationRequest', restorationRequestSchema, 'restoration_requests');
const restorationQuoteSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    city: { type: String, required: true },
    vehicleType: { type: String, enum: ['Bike', 'Car'], required: true },
    budgetOption: { type: String, required: true },
    budgetRange: { type: String, required: true },
    customBudget: Number,
    enquirySource: { type: String, default: 'restore-quick-form' },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
const RestorationQuote = mongoose.models.RestorationQuote || mongoose.model('RestorationQuote', restorationQuoteSchema, 'restoration_quotes');
const { loadRestorationQuotes, detailedRestorationFilter } = require('./server/restoration-quotes');

const payoutRequestSchema = new mongoose.Schema({
    mechanicId: { type: String, required: true },
    mechanicName: { type: String, default: '' },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, default: 'upi' },
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    processedAt: { type: Date, default: null }
}, { strict: false });
const PayoutRequest = mongoose.models.PayoutRequest || mongoose.model('PayoutRequest', payoutRequestSchema);

function mechanicPayload(user) {
    return {
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone || '',
        email: user.email || '',
        address: user.address || '',
        aadharNo: user.aadharNo || '',
        mechanicType: user.mechanicType || '',
        isAvailable: Boolean(user.isAvailable),
        isOnline: Boolean(user.isOnline),
        isApproved: user.isApproved !== false,
        latitude: user.latitude || null,
        longitude: user.longitude || null,
        serviceArea: user.serviceArea || '',
        upiId: user.upiId || '',
        bankName: user.bankName || '',
        bankAccountNo: user.bankAccountNo || '',
        bankIfsc: user.bankIfsc || ''
    };
}

async function authMechanic(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
        req.mechanicAuth = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(req.mechanicAuth.userId).select('sessionVersion isApproved');
        if (!sessionMatches(req.mechanicAuth, user) || user.isApproved === false) return res.status(401).json({ error: 'Session expired. Please log in again.' });
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function adminAuth(req, res, next) {
    const providedKey = req.get('x-admin-key') || req.query.adminKey || '';
    if (!ADMIN_KEY || providedKey !== ADMIN_KEY) {
        return res.status(401).json({ error: 'Unauthorized admin access' });
    }
    next();
}

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

async function getMechanicEarningsSummary(mechanicId) {
    const mechanicIdText = String(mechanicId);
    const completedBookings = await Booking.aggregate([
        {
            $match: {
                status: 'completed',
                $expr: { $eq: [{ $toString: '$mechanicId' }, mechanicIdText] }
            }
        },
        { $project: { servicePrice: 1, vehicleType: 1, mechanicEarnings: 1 } }
    ]);

    const totalEarnings = completedBookings.reduce((sum, booking) => (
        sum + bookingMechanicEarnings(booking)
    ), 0);

    const payoutRequests = await PayoutRequest.aggregate([
        {
            $match: {
                $expr: { $eq: [{ $toString: '$mechanicId' }, mechanicIdText] }
            }
        },
        { $sort: { createdAt: -1 } }
    ]);

    const pendingPayout = payoutRequests.reduce((sum, payout) => (
        String(payout.status || '').toLowerCase() === 'pending'
            ? sum + (Number(payout.amount) || 0)
            : sum
    ), 0);
    const totalPayouts = payoutRequests.reduce((sum, payout) => (
        String(payout.status || '').toLowerCase() === 'completed'
            ? sum + (Number(payout.amount) || 0)
            : sum
    ), 0);
    const availableBalance = Math.max(0, totalEarnings - pendingPayout - totalPayouts);

    return {
        summary: {
            totalEarnings,
            totalJobs: completedBookings.length,
            pendingPayout,
            totalPayouts,
            availableBalance
        },
        payoutRequests
    };
}

function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mechanicLocation(user) {
    const lat = toNumber(user.latitude);
    const lng = toNumber(user.longitude);
    if (lat !== null && lng !== null) return { latitude: lat, longitude: lng };

    const coords = user.location?.coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
        const locationLng = toNumber(coords[0]);
        const locationLat = toNumber(coords[1]);
        if (locationLat !== null && locationLng !== null) {
            return { latitude: locationLat, longitude: locationLng };
        }
    }

    return { latitude: null, longitude: null };
}

function normalizeBooking(booking, mechanic = null) {
    const doc = booking.toObject ? booking.toObject() : booking;
    const bookingLat = toNumber(doc.latitude);
    const bookingLng = toNumber(doc.longitude);
    const mechLoc = mechanic ? mechanicLocation(mechanic) : { latitude: null, longitude: null };
    const distance = bookingLat !== null && bookingLng !== null && mechLoc.latitude !== null && mechLoc.longitude !== null
        ? haversineKm(mechLoc.latitude, mechLoc.longitude, bookingLat, bookingLng)
        : null;

    return {
        ...doc,
        id: doc._id,
        _id: doc._id,
        customerName: doc.name || doc.customerName || '',
        customerPhone: doc.phone || doc.customerPhone || '',
        service: doc.problem || doc.service || '',
        distance: distance === null ? doc.distance : Number(distance.toFixed(2))
    };
}

function generateBookingOTP(seed) {
    let hash = 0;
    const text = String(seed || '');
    for (let i = 0; i < text.length; i++) {
        const chr = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return (100000 + (Math.abs(hash) % 900000)).toString();
}

function computeBookingOTP(booking) {
    if (!booking) return '';
    const phone = String(booking.phone || booking.customerPhone || '').trim();
    const id = String(booking._id || booking.id || '').trim();
    const seed = phone + id;
    return seed.trim().length >= 4 ? generateBookingOTP(seed) : '';
}

// --- SOCKET.IO LOGIC ---
io.on('connection', (socket) => {
    console.log('🔌 User connected:', socket.id);

    // 1. MECHANIC: Go Online / Update Location
    socket.on('mechanic_location_update', async (data) => {
        const { name, lat, lng } = data;
        // Update or Create Mechanic
        await Mechanic.findOneAndUpdate(
            { name: name },
            { 
                socketId: socket.id,
                isOnline: true,
                location: { type: 'Point', coordinates: [lng, lat] }
            },
            { upsert: true, new: true }
        );
    });

    // 2. CUSTOMER: Request Service
    socket.on('request_mechanic', async (data) => {
        const { customerName, lat, lng, problem } = data;
        console.log(`🔍 Searching mechanics near ${lat}, ${lng} for ${customerName}`);

        // Find mechanics within 5km (5000 meters)
        const nearbyMechanics = await Mechanic.find({
            isOnline: true,
            location: {
                $near: {
                    $geometry: { type: "Point", coordinates: [lng, lat] },
                    $maxDistance: 5000 
                }
            }
        });

        if (nearbyMechanics.length > 0) {
            // Broadcast to all nearby mechanics
            nearbyMechanics.forEach(mech => {
                io.to(mech.socketId).emit('new_job_alert', {
                    customerName, lat, lng, problem, customerSocketId: socket.id
                });
            });
        } else {
            socket.emit('no_mechanics_found');
        }
    });

    // 3. MECHANIC: Accept Job
    socket.on('accept_job', (data) => {
        const { mechanicName, customerSocketId } = data;
        // Notify Customer
        io.to(customerSocketId).emit('mechanic_assigned', {
            mechanicName: mechanicName,
            eta: '10 mins' // You can calculate real ETA using Google Matrix API
        });
    });

    socket.on('disconnect', async () => {
        await Mechanic.findOneAndUpdate({ socketId: socket.id }, { isOnline: false });
    });
});

// --- TELEGRAM CONFIGURATION (👉 Yahan apni details daalein) ---
const telegram = createTelegramNotifier({ env: process.env, post: (...args) => axios.post(...args) });
const sendTelegramMessage = (text, event) => telegram.send(text, event);
const notifySubmission = async (event, record) => {
    try {
        return await sendTelegramMessage(formatSubmission(event, record, process.env.PUBLIC_BASE_URL || 'https://www.mechway.in'), event);
    } catch {
        console.error(`Telegram ${event}: notification_format_failed`);
        return { status: 'failed', reason: 'notification_format_failed' };
    }
};
app.get('/api/admin/telegram-status', adminAuth, (req, res) => res.json({ ok: true, ...telegram.getStatus() }));
app.post('/api/restoration-enquiry', createRestorationEnquiryHandler({ RestorationQuote, notify: notifySubmission }));

// --- API Routes (Mocking backend logic for local testing) ---

// Booking API
app.post('/api/book', async (req, res) => {
    console.log('📝 Booking Request:', req.body);

    const {
        name, phone, vehicleType, vehicleBrand, vehicleModel, vehicleNumber,
        vehicleColor, problem, message, latitude, longitude,
        mechanicId, mechanicName, mechanicPhone
    } = req.body || {};

    if (!/^[6-9]\d{9}$/.test(String(phone || '').replace(/\D/g, '')) || !['Car', 'Bike'].includes(vehicleType) || !String(message || '').trim()) {
        return res.status(400).json({ error: 'A valid phone number, vehicle type and location are required' });
    }

    try {
        const { record: booking, created } = await saveSubmission(Booking, 'booking', req.body.requestId, {
            name: String(name || '').trim(),
            phone: String(phone).replace(/\D/g, ''),
            vehicleType,
            vehicleBrand: vehicleBrand || '',
            vehicleModel: vehicleModel || '',
            vehicleNumber: vehicleNumber || '',
            vehicleColor: vehicleColor || '',
            problem: problem || '',
            serviceType: req.body.serviceType || '',
            timeSlot: req.body.timeSlot || '',
            bookingDate: req.body.bookingDate ? new Date(req.body.bookingDate) : null,
            servicePrice: VISIT_PRICE_BY_VEHICLE[vehicleType],
            message,
            latitude: latitude || '',
            longitude: longitude || '',
            status: 'pending',
            preferredMechanicId: mechanicId || '',
            mechanicId: mechanicId || '',
            mechanicName: mechanicName || '',
            mechanicPhone: mechanicPhone || ''
        });

        const telegramNotification = created ? await notifySubmission('booking', booking) : { status: 'already_saved' };

        res.json({
            ok: true,
            id: booking._id,
            bookingId: booking._id,
            telegramNotification,
            booking: normalizeBooking(booking)
        });
    } catch (err) {
        console.error('❌ Booking save error:', err);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save booking' });
    }
});

app.post('/api/restoration', restorationUpload.fields(restorationPhotoFields.map(name => ({ name, maxCount: 1 }))), async (req, res) => {
    const body = req.body || {};
    const uploadedFiles = Object.values(req.files || {}).flat();
    const cleanupUploads = () => Promise.all(uploadedFiles.map(file => fs.promises.unlink(file.path).catch(() => {})));
    const requiredPhotosPresent = restorationPhotoFields.every(name => req.files?.[name]?.length === 1);
    if (!requiredPhotosPresent) {
        await cleanupUploads();
        return res.status(400).json({ error: 'Upload all six images: government ID, RC, front, back, left side and right side.' });
    }
    const vehiclePhotos = {
        front: `/uploads/restoration/${req.files.frontImage[0].filename}`,
        rear: `/uploads/restoration/${req.files.rearImage[0].filename}`,
        left: `/uploads/restoration/${req.files.leftImage[0].filename}`,
        right: `/uploads/restoration/${req.files.rightImage[0].filename}`
    };
    const publicPhotos = Object.values(vehiclePhotos);

    const registrationNumber = String(body.registrationNumber || '').trim().toUpperCase();
    const fullName = String(body.fullName || '').trim();
    const mobileNumber = String(body.mobileNumber || '').trim();
    const email = String(body.email || '').trim();
    const city = String(body.city || '').trim();
    const pickupAddress = String(body.pickupAddress || '').trim();
    const vehicleType = String(body.vehicleType || 'Bike').trim();
    const latitude = body.latitude === '' || body.latitude == null ? null : Number(body.latitude);
    const longitude = body.longitude === '' || body.longitude == null ? null : Number(body.longitude);
    const brand = String(body.brand || '').trim();
    const modelName = String(body.modelName || '').trim();
    const condition = String(body.condition || '').trim();
    const restorationType = String(body.restorationType || '').trim();

    if (!/[A-Z0-9]/.test(registrationNumber) || registrationNumber.length > 20 || !fullName || !mobileNumber || !email || !city || !pickupAddress || !brand || !modelName || !condition || !['Bike', 'Car'].includes(vehicleType)) {
        await cleanupUploads();
        return res.status(400).json({ error: 'Please fill all required restoration fields.' });
    }
    if ((latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
        (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))) {
        await cleanupUploads();
        return res.status(400).json({ error: 'Invalid pickup coordinates.' });
    }

    const persistedFiles = [];
    let requestSaved = false;
    try {
        for (const file of uploadedFiles) {
            await restorationFiles.save(file);
            persistedFiles.push(file);
        }
        const { record: restorationRequest, created } = await saveSubmission(RestorationRequest, 'restoration', body.requestId, {
            fullName,
            vehicleType,
            mobileNumber: mobileNumber.replace(/\D/g, ''),
            whatsappNumber: body.whatsappNumber || '',
            email,
            city,
            pickupAddress,
            latitude,
            longitude,
            brand,
            modelName,
            yearOfManufacture: body.yearOfManufacture || '',
            condition,
            restorationImages: publicPhotos,
            vehiclePhotos,
            rcDocument: req.files.rcImage[0].filename,
            govtIdDocument: req.files.govtIdImage[0].filename,
            rcPrivate: true,
            restorationType: restorationType || body.restorationType || '',
            budgetRange: body.budgetRange || '',
            specialNotes: body.specialNotes || '',
            vehicleColor: body.vehicleColor || '',
            registrationNumber,
            status: 'pending'
        });
        if (!created) {
            await cleanupUploads();
            await Promise.all(persistedFiles.map(file => restorationFiles.remove(file).catch(() => {})));
            return res.json({ ok: true, id: restorationRequest._id, bookingId: restorationRequest._id,
                images: restorationRequest.restorationImages, collection: 'restoration_requests',
                telegramNotification: { status: 'already_saved' } });
        }
        requestSaved = true;

        let telegramNotification;
        try {
            telegramNotification = await sendTelegramMessage(formatRestorationTelegram(restorationRequest, {
                dashboardBaseUrl: process.env.PUBLIC_BASE_URL || 'https://www.mechway.in',
                assetBaseUrl: process.env.RESTORATION_ASSET_BASE_URL || 'https://newonwheels.onrender.com'
            }), 'restoration');
        } catch {
            console.error('Telegram restoration: notification_format_failed');
            telegramNotification = { status: 'failed', reason: 'notification_format_failed' };
        }
        res.json({
            ok: true,
            id: restorationRequest._id,
            bookingId: restorationRequest._id,
            images: publicPhotos,
            collection: 'restoration_requests',
            telegramNotification,
            message: 'Restoration request saved successfully.'
        });
    } catch (err) {
        if (!requestSaved) {
            await cleanupUploads();
            await Promise.all(persistedFiles.map(file => restorationFiles.remove(file).catch(() => {})));
        }
        console.error('❌ Restoration save error:', err);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Could not save restoration request.' });
    }
});

app.get('/api/admin/restorations/:id/:document(rc|govt-id)', async (req, res) => {
    const adminKey = process.env.ADMIN_KEY || '';
    if (!adminKey || req.headers['x-admin-key'] !== adminKey) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    try {
        const restoration = await RestorationRequest.findById(req.params.id).lean();
        const isGovtId = req.params.document === 'govt-id';
        const documentName = isGovtId ? restoration?.govtIdDocument : restoration?.rcDocument;
        if (!restoration?.rcPrivate || !documentName) {
            return res.status(404).json({ ok: false, error: 'RC image not found' });
        }
        const rcPath = path.join(restorationRcDir, path.basename(documentName));
        const downloadName = `${isGovtId ? 'Govt-ID' : 'RC'}-${req.params.id}${path.extname(rcPath)}`;
        res.set('Cache-Control', 'private, no-store');
        try {
            await fs.promises.access(rcPath, fs.constants.R_OK);
            return res.download(rcPath, downloadName);
        } catch (err) {
            if (err.code !== 'ENOENT') throw err;
        }
        if (await restorationFiles.send(res, path.basename(rcPath), { privateFile: true, downloadName })) return;
        return res.status(404).json({ ok: false, error: 'RC image not found' });
    } catch (err) {
        return res.status(404).json({ ok: false, error: 'RC image not found' });
    }
});

// Admin: list restoration requests (protected by ADMIN_KEY)
app.get('/api/admin/restorations', async (req, res) => {
    const adminKey = process.env.ADMIN_KEY || '';
    const provided = req.headers['x-admin-key'] || req.query.key || '';
    if (!adminKey || provided !== adminKey) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    try {
        const items = await RestorationRequest.find(detailedRestorationFilter).sort({ createdAt: -1 }).limit(500).lean();
        return res.json({ ok: true, count: items.length, restorations: items });
    } catch (err) {
        console.error('❌ Could not fetch restorations:', err);
        return res.status(500).json({ ok: false, error: 'Could not read restorations' });
    }
});

app.use((error, req, res, next) => {
    if (error) {
        console.error('❌ Express error:', error);
        if (error instanceof multer.MulterError || error.message) {
            return res.status(400).json({ ok: false, error: error.message || 'File upload failed.' });
        }
    }
    next(error);
});

app.get('/api/mechanic/work-slips', authMechanic, async (req, res) => {
    try {
        const bookings = await Booking.find({
            mechanicId: String(req.mechanicAuth.userId),
            workSlip: { $exists: true, $ne: null }
        }).sort({ updatedAt: -1, createdAt: -1 }).lean();

        const slips = bookings.map((booking) => ({
            _id: booking._id,
            customerName: booking.name || booking.customerName || 'Customer',
            customerPhone: booking.phone || booking.customerPhone || '',
            vehicleType: booking.vehicleType || '',
            workSlip: booking.workSlip || {}
        }));

        res.json({ ok: true, slips });
    } catch (err) {
        console.error('❌ Work slips fetch error:', err);
        res.status(500).json({ ok: false, error: 'Could not load work slips' });
    }
});

app.post('/api/mechanic/work-slip', authMechanic, async (req, res) => {
    try {
        const bookingId = String(req.body?.bookingId || '').trim();
        if (!bookingId) {
            return res.status(400).json({ ok: false, error: 'bookingId is required' });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ ok: false, error: 'Booking not found' });
        }

        const currentMechanicId = String(req.mechanicAuth.userId);
        const isAssignedMechanic = String(booking.mechanicId || '') === currentMechanicId || String(booking.preferredMechanicId || '') === currentMechanicId;
        if (!isAssignedMechanic) {
            return res.status(403).json({ ok: false, error: 'You are not assigned to this booking' });
        }

        let money;
        try {
            money = calculateWorkSlipMoney(req.body?.labourCharge ?? 0, req.body?.partsCharge ?? 0);
        } catch (err) {
            return res.status(400).json({ ok: false, error: err.message });
        }
        const { labourCharge, partsCharge, totalCharge, platformCommission, mechanicEarnings } = money;
        if (req.body?.totalCharge != null && (!Number.isFinite(Number(req.body.totalCharge)) || Math.abs(Number(req.body.totalCharge) - totalCharge) > 0.001)) {
            return res.status(400).json({ ok: false, error: 'Total must equal labour plus parts charges' });
        }

        const workSlip = {
            summary: String(req.body?.summary || '').trim(),
            workDone: String(req.body?.workDone || '').trim(),
            partsUsed: String(req.body?.partsUsed || '').trim(),
            labourCharge,
            partsCharge,
            totalCharge,
            platformCommission,
            mechanicEarnings,
            notes: String(req.body?.notes || '').trim(),
            submittedAt: new Date().toISOString(),
            paymentLink: '',
            delivery: { status: 'not_sent' }
        };

        const amount = totalCharge;
        const customerName = String(booking.name || 'Customer');
        const customerPhone = String(booking.phone || '').replace(/\D/g, '');
        const mechanicName = String(booking.mechanicName || req.mechanicAuth.name || 'Mechanic');
        const mechanicPhone = String(booking.mechanicPhone || '').replace(/\D/g, '');
        const publicBase = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        let paymentLink = '';

        // If Razorpay keys configured, create a Razorpay payment link now and store the short_url
        try {
            if (amount > 0 && razorpay && razorpay.key_id && razorpay.key_secret) {
                const rpLink = await razorpay.paymentLink.create({
                    amount: Math.round(Number(amount || 0) * 100),
                    currency: 'INR',
                    description: `MechWay Service Payment - ${bookingId || 'Booking'}`,
                    customer: { name: customerName || 'Customer', contact: customerPhone || '' },
                    notes: { bookingId, mechanicName, mechanicPhone },
                    reminder_enable: true,
                    callback_url: `${(process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '')}/pages/booking-confirmed.html`,
                    callback_method: 'get'
                });
                paymentLink = rpLink.short_url || rpLink.url || '';
            }
        } catch (err) {
            console.error('❌ Razorpay create link error (work-slip):', err?.error || err?.message || err);
            // The work slip can still be shared without an unverified payment URL.
        }

        workSlip.paymentLink = paymentLink;

        booking.workSlip = workSlip;
        booking.updatedAt = new Date();
        await booking.save();

        const telegramNotification = await notifySubmission('workSlip', { ...workSlip, _id: booking._id, name: customerName, phone: customerPhone, mechanicName });
        res.json({
            ok: true,
            booking: normalizeBooking(booking),
            customerName,
            customerPhone,
            paymentLink,
            workSlip,
            telegramNotification
        });
    } catch (err) {
        console.error('❌ Work slip save error:', err);
        res.status(500).json({ ok: false, error: 'Could not save work slip' });
    }
});

// Send Work Slip via WhatsApp Cloud API
app.post('/api/mechanic/send-workslip-whatsapp', authMechanic, async (req, res) => {
    try {
        const bookingId = String(req.body?.bookingId || '').trim();
        if (!bookingId) return res.status(400).json({ ok: false, error: 'bookingId required' });

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ ok: false, error: 'Booking not found' });

        const currentMechanicId = String(req.mechanicAuth.userId);
        if (String(booking.mechanicId || '') !== currentMechanicId && String(booking.preferredMechanicId || '') !== currentMechanicId) {
            return res.status(403).json({ ok: false, error: 'You are not assigned to this booking' });
        }

        const workSlip = booking.workSlip;
        if (!workSlip?.submittedAt) return res.status(409).json({ ok: false, error: 'Save the work slip before sending it' });
        const labour = Number(workSlip.labourCharge || 0);
        const parts = Number(workSlip.partsCharge || 0);
        const total = Number(workSlip.totalCharge || (labour + parts)) || 0;

        let customerPhone = String(booking.phone || booking.customerPhone || '').replace(/\D/g, '');
        // Normalize to India country code if missing
        if (customerPhone.length === 10) customerPhone = '91' + customerPhone;
        if (!/^91[6-9]\d{9}$/.test(customerPhone)) return res.status(400).json({ ok: false, error: 'Valid customer phone missing' });

        // Build message
        const lines = [];
        lines.push('🔧 MechWay Work Slip');
        lines.push('');
        lines.push(`Hello ${booking.name || 'Customer'},`);
        lines.push(`Summary: ${workSlip.summary || '—'}`);
        lines.push(`Work Done: ${workSlip.workDone || '—'}`);
        lines.push(`Parts Used: ${workSlip.partsUsed || '—'}`);
        lines.push(`Labour Charge: ₹${labour}`);
        lines.push(`Parts Charge: ₹${parts}`);
        lines.push(`Total Charge: ₹${total}`);

        // Prefer server-generated payment link if present
        const paymentLink = workSlip.paymentLink || '';
        if (paymentLink) lines.push(`Pay securely: ${paymentLink}`);

        lines.push(`Notes: ${workSlip.notes || '—'}`);
        lines.push('');
        lines.push(`Mechanic: ${booking.mechanicName || req.mechanicAuth.name || 'Mechanic'}`);
        lines.push(`Phone: ${booking.mechanicPhone || ''}`);

        const message = lines.join('\n');

        // WhatsApp Cloud API details
        const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
        const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';

        if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
            return res.status(503).json({ ok: false, error: 'WhatsApp credentials not configured' });
        }

        const url = `https://graph.facebook.com/v17.0/${WHATSAPP_PHONE_ID}/messages`;
        const payload = {
            messaging_product: 'whatsapp',
            to: customerPhone,
            type: 'text',
            text: { body: message }
        };

        const apiRes = await axios.post(url, payload, {
            headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }
        });

        if (apiRes?.data) {
            console.log('✅ WhatsApp sent:', apiRes.data);
            booking.workSlip.delivery = {
                status: 'sent',
                attemptedAt: new Date().toISOString(),
                providerMessageId: apiRes.data.messages?.[0]?.id || ''
            };
            booking.markModified('workSlip');
            await booking.save();
            return res.json({ ok: true, result: apiRes.data });
        }

        res.status(500).json({ ok: false, error: 'WhatsApp API did not return success' });
    } catch (err) {
        console.error('❌ Send WhatsApp error:', err?.response?.data || err.message || err);
        res.status(500).json({ ok: false, error: 'Could not send WhatsApp message' });
    }
});

// Payment API
app.post('/api/payment', async (req, res) => {
    try {
        const paymentMethod = String(req.body?.paymentMethod || '').toLowerCase();
        const customerName = String(req.body?.customerName || '').trim();
        const customerPhone = String(req.body?.customerPhone || '').replace(/\D/g, '');
        const requestedAmount = Number(req.body?.totalAmount);
        if (!customerName || !customerPhone || !Number.isFinite(requestedAmount) || requestedAmount <= 0 || !['cash', 'online'].includes(paymentMethod)) {
            return res.status(400).json({ error: 'Valid customer, amount and payment method are required' });
        }

        let totalAmount = requestedAmount;
        let status = 'pending';
        let razorpayPaymentId;
        let razorpayOrderId = '';
        if (paymentMethod === 'online') {
            razorpayPaymentId = String(req.body.razorpayPaymentId || '').trim();
            razorpayOrderId = String(req.body.razorpayOrderId || '').trim();
            const signature = String(req.body.razorpaySignature || '').trim();
            if (!process.env.RAZORPAY_KEY_SECRET || !razorpayPaymentId || !razorpayOrderId || !/^[a-f0-9]{64}$/i.test(signature)) {
                return res.status(400).json({ error: 'Payment verification details are missing' });
            }
            const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
            if (!crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'))) {
                return res.status(400).json({ error: 'Invalid payment signature' });
            }

            const [order, gatewayPayment] = await Promise.all([
                razorpay.orders.fetch(razorpayOrderId),
                razorpay.payments.fetch(razorpayPaymentId)
            ]);
            if (gatewayPayment.order_id !== razorpayOrderId || order.currency !== 'INR' || gatewayPayment.currency !== 'INR' || gatewayPayment.amount !== order.amount || !['authorized', 'captured'].includes(gatewayPayment.status)) {
                return res.status(400).json({ error: 'Payment amount or status could not be verified' });
            }
            totalAmount = order.amount / 100;
            status = gatewayPayment.status === 'captured' ? 'paid' : 'pending';
            const existing = await Payment.findOne({ razorpayPaymentId });
            if (existing) return res.json({ ok: true, id: existing._id, status: existing.status });
        }

        const saved = await Payment.create({
            customerName, customerPhone, totalAmount, paymentMethod, status,
            ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
            razorpayOrderId,
            vehicleType: req.body.vehicleType || '',
            vehicleBrand: req.body.vehicleBrand || '',
            vehicleModel: req.body.vehicleModel || '',
            service: req.body.service || '',
            bookingId: req.body.bookingId || '',
            mechanicName: req.body.mechanicName || ''
        });
        const telegramNotification = await notifySubmission('payment', saved);
        res.json({ ok: true, id: saved._id, status, telegramNotification });
    } catch (err) {
        if (err?.code === 11000 && req.body?.razorpayPaymentId) {
            const existing = await Payment.findOne({ razorpayPaymentId: req.body.razorpayPaymentId });
            if (existing) return res.json({ ok: true, id: existing._id, status: existing.status });
        }
        console.error('❌ Payment save error:', err);
        res.status(500).json({ error: 'Could not verify or save payment' });
    }
});

app.get('/api/payment/checkout', async (req, res) => {
    try {
        const amount = Number(req.query.amount || 0);
        const customerName = String(req.query.name || 'Customer').trim();
        const customerPhone = String(req.query.phone || '').replace(/\D/g, '');
        const bookingId = String(req.query.bookingId || '').trim();
        const mechanicName = String(req.query.mechanicName || 'Mechanic').trim();
        const mechanicPhone = String(req.query.mechanicPhone || '').replace(/\D/g, '');

        if (!Number.isFinite(amount) || amount <= 0) {
            return res.status(400).json({ ok: false, error: 'Valid amount is required' });
        }

        if (!razorpay.key_id || !razorpay.key_secret) {
            return res.status(503).json({
                ok: false,
                error: 'Razorpay keys are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the environment.'
            });
        }

        const paymentLink = await razorpay.paymentLink.create({
            amount: Math.round(amount * 100),
            currency: 'INR',
            description: `MechWay Service Payment - ${bookingId || 'Booking'}`,
            customer: {
                name: customerName || 'Customer',
                contact: customerPhone || '9999999999'
            },
            notes: {
                bookingId,
                mechanicName,
                mechanicPhone,
                customerName,
                customerPhone
            },
            notify: {
                sms: true,
                email: false
            },
            reminder_enable: true,
            callback_url: `${(process.env.PUBLIC_BASE_URL || 'https://www.mechway.in').replace(/\/$/, '')}/pages/booking-confirmed.html`,
            callback_method: 'get'
        });

        const checkoutUrl = paymentLink.short_url || paymentLink.url || '';
        if (!checkoutUrl) {
            return res.status(500).json({ ok: false, error: 'Could not generate Razorpay payment link' });
        }

        res.redirect(checkoutUrl);
    } catch (err) {
        console.error('❌ Razorpay checkout error:', err);
        res.status(500).json({ ok: false, error: 'Could not create Razorpay payment link' });
    }
});

// Contact API
app.post(['/api/contact', '/api/inquiry'], async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').replace(/\D/g, '');
    const product = req.path === '/api/inquiry' ? String(req.body?.product_name || '').trim().slice(0, 180) : '';
    const message = String(req.body?.message || '').trim() || (product ? `Product enquiry: ${product}` : '');
    if (!name || !/^[6-9]\d{9}$/.test(phone) || !message) {
        return res.status(400).json({ error: 'Name, valid phone and message are required' });
    }
    try {
        const saved = await Contact.create({
            name, phone, message,
            email: String(req.body.email || '').trim(),
            subject: product || String(req.body.subject || '').trim()
        });
        const telegramNotification = await notifySubmission('contact', saved);
        res.json({ ok: true, id: saved._id, telegramNotification });
    } catch (err) {
        console.error('❌ Contact save error:', err);
        res.status(500).json({ error: 'Could not save contact message' });
    }
});

app.get('/api/admin/submissions', adminAuth, async (req, res) => {
    try {
        const [bookings, payouts, users, restorationRequests, storedPayments, storedContacts, restorationQuotes] = await Promise.all([
            Booking.find({}).sort({ createdAt: -1 }).limit(500).lean(),
            PayoutRequest.find({}).sort({ createdAt: -1 }).limit(200).lean(),
            User.find({}).sort({ createdAt: -1 }).limit(500).lean(),
            RestorationRequest.find(detailedRestorationFilter).sort({ createdAt: -1 }).limit(500).lean(),
            Payment.find({}).sort({ createdAt: -1 }).limit(500).lean(),
            Contact.find({}).sort({ createdAt: -1 }).limit(500).lean(),
            loadRestorationQuotes(RestorationQuote, RestorationRequest)
        ]);

        let legacy = {};
        try {
            legacy = JSON.parse(fs.readFileSync(path.join(__dirname, 'server', 'mechway.json'), 'utf8'));
        } catch (err) {
            if (err.code !== 'ENOENT') console.error('❌ Legacy submissions read error:', err);
        }
        const byDate = (a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0);
        const contacts = [...storedContacts, ...(legacy.contacts || [])].sort(byDate);
        const inquiries = legacy.inquiries || [];
        const payments = [...storedPayments, ...(legacy.payments || [])].sort(byDate);
        const workSlips = [];

        res.json({
            ok: true,
            bookings,
            payments,
            contacts,
            inquiries,
            mechanics: users,
            workSlips,
            payouts,
            restorationQuotes,
            restorations: restorationRequests,
            restorationRequests
        });
    } catch (err) {
        console.error('❌ Admin submissions fetch error:', err);
        res.status(500).json({ error: 'Could not load admin submissions' });
    }
});

app.get('/api/admin/restoration-quotes', adminAuth, async (req, res) => {
    try {
        const quotes = await loadRestorationQuotes(RestorationQuote, RestorationRequest);
        res.json({ ok: true, count: quotes.length, quotes });
    } catch {
        res.status(500).json({ error: 'Could not load restoration quotes' });
    }
});

const adminMechanics = createAdminMechanicHandlers(User);
app.post('/api/admin/mechanics/:id/approve', adminAuth, adminMechanics.approve);
app.post('/api/admin/mechanics/:id/set-password', adminAuth, adminMechanics.setPassword);

app.get('/api/admin/restoration-requests', adminAuth, async (req, res) => {
    try {
        const requests = await RestorationRequest.find(detailedRestorationFilter).sort({ createdAt: -1 }).lean();
        res.json({ ok: true, restorationRequests: requests, count: requests.length });
    } catch (err) {
        console.error('❌ Restoration requests fetch error:', err);
        res.status(500).json({ error: 'Could not load restoration requests' });
    }
});

// Mechanic login API
app.post(['/api/mechanic/login', '/api/login'], async (req, res) => {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
        return res.status(400).json({ error: 'Phone/email and password are required' });
    }

    try {
        const cleanIdentifier = String(identifier).trim();
        const digitsIdentifier = cleanIdentifier.replace(/\D/g, '');
        const phoneCandidates = [...new Set([
            cleanIdentifier,
            digitsIdentifier,
            digitsIdentifier.length > 10 ? digitsIdentifier.slice(-10) : digitsIdentifier,
            digitsIdentifier.length === 10 ? `91${digitsIdentifier}` : ''
        ].filter(Boolean))];
        const user = await User.findOne({
            $or: [
                { email: cleanIdentifier.toLowerCase() },
                { email: cleanIdentifier },
                ...phoneCandidates.map(phone => ({ phone }))
            ]
        }).select('+password');

        if (!user) {
            return res.status(401).json({ error: 'Invalid phone/email or password' });
        }

        const passwordOk = await bcrypt.compare(password, user.password);
        if (!passwordOk) {
            return res.status(401).json({ error: 'Invalid phone/email or password' });
        }

        if (user.isApproved === false) {
            return res.status(403).json({ error: 'Your mechanic account is pending approval' });
        }

        const token = jwt.sign(
            { userId: user._id, email: user.email || '', phone: user.phone || '', mechanicType: user.mechanicType || '', sessionVersion: user.sessionVersion || 0 },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        const mechanic = mechanicPayload(user);

        res.json({
            ok: true,
            message: 'Logged in successfully',
            token,
            mechanic,
            user: mechanic
        });
    } catch (err) {
        console.error('❌ Mechanic login error:', err);
        res.status(500).json({ error: 'Could not process login' });
    }
});

// Mechanic Signup
app.post('/api/mechanic/signup', async (req, res) => {
    try {
        const body = req.body || {};
        const name = String(body.name || '').trim();
        const phone = String(body.phone || '').replace(/\D/g, '');
        const email = String(body.email || '').trim().toLowerCase();
        const aadharNo = String(body.aadharNo || '').replace(/\s/g, '');
        const password = String(body.password || '');

        if (!name || !phone || !password) {
            return res.status(400).json({ ok: false, error: 'Name, phone and password are required' });
        }

        const identityChecks = [{ phone }];
        if (email) identityChecks.push({ email });
        if (aadharNo) identityChecks.push({ aadharNo });
        const existing = await User.findOne({ $or: identityChecks });
        if (existing) {
            const field = existing.phone === phone ? 'phone' : email && existing.email === email ? 'email' : 'aadharNo';
            const message = field === 'aadharNo'
                ? 'This Aadhaar number is already registered. Log in to your existing account, use Forgot Password, or contact MechWay if you need help.'
                : `This ${field === 'phone' ? 'phone number' : 'email address'} is already registered. Please log in or use Forgot Password.`;
            return res.status(409).json({ ok: false, field, error: message });
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            phone,
            email: email || undefined,
            address: String(body.address || '').trim(),
            ...(aadharNo ? { aadharNo } : {}),
            mechanicType: String(body.mechanicType || '').trim(),
            experience: String(body.experience || '').trim(),
            serviceArea: String(body.serviceArea || '').trim(),
            latitude: toNumber(body.latitude),
            longitude: toNumber(body.longitude),
            upiId: String(body.upiId || '').trim(),
            bankName: String(body.bankName || '').trim(),
            bankAccountNo: String(body.bankAccountNo || '').trim(),
            bankIfsc: String(body.bankIfsc || '').trim().toUpperCase(),
            password: hashed,
            isAvailable: Boolean(body.isAvailable) || false,
            isApproved: false
        });

        const telegramNotification = await notifySubmission('signup', user);

        res.json({ ok: true, telegramNotification, mechanic: { id: user._id, _id: user._id, name: user.name, phone: user.phone } });
    } catch (err) {
        if (err.code === 11000) {
            const field = Object.keys(err.keyPattern || err.keyValue || {}).find(key => ['phone', 'email', 'aadharNo'].includes(key));
            const label = { phone: 'phone number', email: 'email address', aadharNo: 'Aadhaar number' }[field] || 'account details';
            return res.status(409).json({ ok: false, ...(field ? { field } : {}), error: `This ${label} is already registered. Please log in to your existing account, use Forgot Password, or contact MechWay for help.` });
        }
        console.error('❌ Mechanic signup error:', err.name || 'Error');
        res.status(500).json({ ok: false, error: 'Could not create mechanic account' });
    }
});

app.get('/api/mechanic/profile', authMechanic, async (req, res) => {
    try {
        const user = await User.findById(req.mechanicAuth.userId);
        if (!user) return res.status(404).json({ error: 'Mechanic not found' });
        res.json({ ok: true, mechanic: mechanicPayload(user), user: mechanicPayload(user) });
    } catch (err) {
        console.error('❌ Mechanic profile error:', err);
        res.status(500).json({ error: 'Could not load mechanic profile' });
    }
});

app.get('/api/mechanics', async (req, res) => {
    const customerLat = toNumber(req.query.lat);
    const customerLng = toNumber(req.query.lng);
    const radius = toNumber(req.query.radius) || 4;
    const type = String(req.query.type || '').trim().toLowerCase();

    try {
        const query = { isApproved: { $ne: false }, isAvailable: true };
        if (type === 'car' || type === 'bike') {
            query.$or = [
                { mechanicType: type },
                { mechanicType: 'both' },
                { mechanicType: '' },
                { mechanicType: { $exists: false } }
            ];
        }

        const users = await User.find(query).lean();
        const mechanics = users.map(user => {
            const location = mechanicLocation(user);
            const distance = customerLat !== null && customerLng !== null && location.latitude !== null && location.longitude !== null
                ? haversineKm(customerLat, customerLng, location.latitude, location.longitude)
                : null;

            return {
                id: user._id,
                _id: user._id,
                name: user.name || 'Mechanic',
                phone: user.phone || '',
                email: user.email || '',
                mechanicType: user.mechanicType || '',
                serviceArea: user.serviceArea || user.address || 'Prayagraj',
                isAvailable: Boolean(user.isAvailable),
                isOnline: Boolean(user.isOnline),
                latitude: location.latitude,
                longitude: location.longitude,
                distance: distance === null ? null : Number(distance.toFixed(2)),
                rating: user.rating || '',
                experience: user.experience || ''
            };
        })
        .filter(mechanic => mechanic.latitude !== null && mechanic.longitude !== null)
        .filter(mechanic => mechanic.distance === null || mechanic.distance <= radius)
        .sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));

        res.json({ ok: true, mechanics, count: mechanics.length, radius });
    } catch (err) {
        console.error('❌ Mechanics fetch error:', err);
        res.status(500).json({ ok: false, error: 'Could not fetch mechanics' });
    }
});

app.put('/api/mechanic/availability', authMechanic, async (req, res) => {
    try {
        const isAvailable = Boolean(req.body?.isAvailable);
        const user = await User.findByIdAndUpdate(
            req.mechanicAuth.userId,
            { isAvailable, isOnline: isAvailable },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'Mechanic not found' });
        res.json({ ok: true, mechanic: mechanicPayload(user), user: mechanicPayload(user) });
    } catch (err) {
        console.error('❌ Availability update error:', err);
        res.status(500).json({ error: 'Could not update availability' });
    }
});

app.put('/api/mechanic/update-profile', authMechanic, async (req, res) => {
    try {
        const body = req.body || {};
        const update = {};

        if (body.name !== undefined) update.name = String(body.name).trim();
        if (body.phone !== undefined) update.phone = String(body.phone).trim();
        if (body.mechanicType !== undefined) update.mechanicType = String(body.mechanicType).trim().toLowerCase();
        if (body.serviceArea !== undefined) update.serviceArea = String(body.serviceArea).trim();
        if (body.upiId !== undefined) update.upiId = String(body.upiId).trim();
        if (body.bankName !== undefined) update.bankName = String(body.bankName).trim();
        if (body.bankIfsc !== undefined) update.bankIfsc = String(body.bankIfsc).trim().toUpperCase();
        if (body.bankAccountNo !== undefined && String(body.bankAccountNo).trim()) {
            update.bankAccountNo = String(body.bankAccountNo).trim();
        }

        if (body.latitude !== undefined || body.longitude !== undefined) {
            const latitude = toNumber(body.latitude);
            const longitude = toNumber(body.longitude);
            if (latitude === null || longitude === null) {
                return res.status(400).json({ error: 'Valid latitude and longitude are required' });
            }
            update.latitude = latitude;
            update.longitude = longitude;
        }

        const user = await User.findByIdAndUpdate(
            req.mechanicAuth.userId,
            update,
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'Mechanic not found' });
        const telegramNotification = await notifySubmission('profile', user);
        res.json({ ok: true, telegramNotification, mechanic: mechanicPayload(user), user: mechanicPayload(user) });
    } catch (err) {
        console.error('❌ Profile update error:', err);
        res.status(500).json({ error: 'Could not update profile' });
    }
});

app.get('/api/mechanic/nearby-bookings', authMechanic, async (req, res) => {
    try {
        const mechanic = await User.findById(req.mechanicAuth.userId).lean();
        if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });

        const freshSince = new Date(Date.now() - 30 * 60 * 1000);
        const preferredIds = ['', String(mechanic._id)];
        const bookings = await Booking.find({
            status: { $in: ['pending', 'new', ''] },
            createdAt: { $gte: freshSince },
            $or: [
                { preferredMechanicId: { $in: preferredIds } },
                { preferredMechanicId: { $exists: false } }
            ]
        }).sort({ createdAt: -1 }).limit(100);

        const mechanicType = String(mechanic.mechanicType || '').toLowerCase();
        const normalized = bookings
            .map(booking => normalizeBooking(booking, mechanic))
            .filter(booking => {
                const bookingType = String(booking.vehicleType || '').toLowerCase();
                if (mechanicType && bookingType && mechanicType !== 'both' && mechanicType !== bookingType) return false;
                if (booking.preferredMechanicId && String(booking.preferredMechanicId) === String(mechanic._id)) return true;
                return booking.distance == null || booking.distance <= 10;
            });

        res.json({ ok: true, bookings: normalized });
    } catch (err) {
        console.error('❌ Nearby bookings error:', err);
        res.status(500).json({ error: 'Could not fetch nearby bookings' });
    }
});

app.get(['/api/bookings/pending', '/api/booking/pending'], authMechanic, async (req, res) => {
    try {
        const mechanic = await User.findById(req.mechanicAuth.userId).lean();
        const freshSince = new Date(Date.now() - 30 * 60 * 1000);
        const bookings = await Booking.find({
            status: { $in: ['pending', 'new', ''] },
            createdAt: { $gte: freshSince }
        })
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ ok: true, bookings: bookings.map(booking => normalizeBooking(booking, mechanic)) });
    } catch (err) {
        console.error('❌ Pending bookings error:', err);
        res.status(500).json({ error: 'Could not fetch pending bookings' });
    }
});

app.post('/api/mechanic/notify-booking', async (req, res) => {
    const { bookingId, mechanicId, mechanicName, mechanicPhone } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    try {
        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            {
                status: 'pending',
                preferredMechanicId: mechanicId || '',
                mechanicId: mechanicId || '',
                mechanicName: mechanicName || '',
                mechanicPhone: mechanicPhone || ''
            },
            { new: true }
        );
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json({ ok: true, booking: normalizeBooking(booking) });
    } catch (err) {
        console.error('❌ Notify booking error:', err);
        res.status(500).json({ error: 'Could not notify mechanic' });
    }
});

app.post('/api/mechanic/accept-booking', authMechanic, async (req, res) => {
    const { bookingId, mechanicDetails = {} } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    try {
        const mechanic = await User.findById(req.mechanicAuth.userId).lean();
        if (!mechanic) return res.status(404).json({ error: 'Mechanic not found' });

        const details = {
            id: mechanic._id,
            name: mechanicDetails.name || mechanic.name || '',
            phone: mechanicDetails.phone || mechanic.phone || '',
            mechanicType: mechanicDetails.mechanicType || mechanic.mechanicType || '',
            serviceArea: mechanicDetails.serviceArea || mechanic.serviceArea || mechanic.address || '',
            latitude: mechanicDetails.latitude || mechanic.latitude || '',
            longitude: mechanicDetails.longitude || mechanic.longitude || '',
            rating: mechanicDetails.rating || mechanic.rating || '',
            experience: mechanicDetails.experience || mechanic.experience || ''
        };

        const freshSince = new Date(Date.now() - 30 * 60 * 1000);
        const booking = await Booking.findOneAndUpdate(
            {
                _id: bookingId,
                status: { $in: ['pending', 'new', ''] },
                createdAt: { $gte: freshSince },
                $or: [
                    { preferredMechanicId: { $in: ['', String(mechanic._id)] } },
                    { preferredMechanicId: { $exists: false } }
                ]
            },
            {
                status: 'accepted',
                mechanicId: String(mechanic._id),
                mechanicName: details.name,
                mechanicPhone: details.phone,
                mechanicDetails: details,
                acceptedAt: new Date()
            },
            { new: true }
        );
        if (!booking) return res.status(409).json({ error: 'Booking no longer available' });
        res.json({ ok: true, booking: normalizeBooking(booking, mechanic) });
    } catch (err) {
        console.error('❌ Accept booking error:', err);
        res.status(500).json({ error: 'Could not accept booking' });
    }
});

app.post('/api/mechanic/reject-booking', authMechanic, async (req, res) => {
    const { bookingId } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    try {
        const mechanicId = String(req.mechanicAuth.userId);
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        if (String(booking.preferredMechanicId || '') === mechanicId) {
            booking.preferredMechanicId = '';
            booking.mechanicId = '';
            booking.mechanicName = '';
            booking.mechanicPhone = '';
        }
        booking.rejectedAt = new Date();
        await booking.save();
        res.json({ ok: true, booking: normalizeBooking(booking) });
    } catch (err) {
        console.error('❌ Reject booking error:', err);
        res.status(500).json({ error: 'Could not reject booking' });
    }
});

app.post('/api/mechanic/generate-otp', authMechanic, async (req, res) => {
    const { bookingId } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (String(booking.mechanicId || '') !== String(req.mechanicAuth.userId)) {
            return res.status(403).json({ error: 'You are not assigned to this booking' });
        }

        const otp = computeBookingOTP(booking);
        if (!otp) {
            return res.status(400).json({ error: 'Could not generate OTP for this booking' });
        }

        booking.otp = otp;
        booking.otpGeneratedAt = new Date();
        await booking.save();

        console.log(`🔐 Generated OTP for booking ${bookingId}: ${otp}`);
        res.json({ ok: true, otp });
    } catch (err) {
        console.error('❌ Generate OTP error:', err);
        res.status(500).json({ error: 'Could not generate OTP' });
    }
});

app.post('/api/mechanic/verify-otp', authMechanic, async (req, res) => {
    const { bookingId, otp } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });
    if (!otp || typeof otp !== 'string') return res.status(400).json({ error: 'otp is required' });

    try {
        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        if (String(booking.mechanicId || '') !== String(req.mechanicAuth.userId)) {
            return res.status(403).json({ error: 'You are not assigned to this booking' });
        }
        if (String(booking.status || '').toLowerCase() !== 'accepted') {
            return res.status(409).json({ error: 'Booking is not in an accepted state' });
        }

        const expectedOtp = computeBookingOTP(booking);
        if (!expectedOtp || expectedOtp !== String(otp).trim()) {
            return res.status(400).json({ error: 'Wrong OTP' });
        }

        const split = calculateEarningSplit(booking.servicePrice, booking.vehicleType);
        booking.status = 'completed';
        booking.completedAt = new Date();
        booking.platformCommission = split.platformCommission;
        booking.mechanicEarnings = split.mechanicEarnings;
        await booking.save();

        res.json({
            ok: true,
            amount: split.mechanicEarnings,
            grossAmount: split.grossAmount,
            platformCommission: split.platformCommission
        });
    } catch (err) {
        console.error('❌ Verify OTP error:', err);
        res.status(500).json({ error: 'Could not verify OTP' });
    }
});

app.get('/api/booking/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json({ ok: true, booking: normalizeBooking(booking) });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch booking' });
    }
});

app.get('/api/booking/:bookingId/details', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId);
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json({ ok: true, booking: normalizeBooking(booking) });
    } catch (err) {
        res.status(500).json({ error: 'Could not fetch booking details' });
    }
});

app.post('/api/booking/release-preferred-mechanic', async (req, res) => {
    const { bookingId } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: 'bookingId is required' });

    try {
        const booking = await Booking.findByIdAndUpdate(
            bookingId,
            { preferredMechanicId: '', mechanicId: '', mechanicName: '', mechanicPhone: '' },
            { new: true }
        );
        if (!booking) return res.status(404).json({ error: 'Booking not found' });
        res.json({ ok: true, booking: normalizeBooking(booking) });
    } catch (err) {
        res.status(500).json({ error: 'Could not release preferred mechanic' });
    }
});

const passwordReset = createPasswordResetHandlers({
    User, ...emailConfiguration(),
    notifyPasswordHelp: async text => {
        const result = await sendTelegramMessage(text, 'passwordHelp');
        if (result.status !== 'sent') throw new Error('Telegram did not accept password help request');
    }
});
app.post('/api/mechanic/request-password-help', passwordReset.help);
app.post('/api/mechanic/forgot-password', passwordReset.request);
app.post('/api/mechanic/verify-reset-otp', passwordReset.verify);
app.post('/api/mechanic/reset-password', passwordReset.reset);

// Earnings summary for mechanic
app.get('/api/mechanic/earnings', authMechanic, async (req, res) => {
    try {
        const mechanicId = String(req.mechanicAuth.userId);
        const { summary, payoutRequests } = await getMechanicEarningsSummary(mechanicId);
        res.json({ ok: true, summary, payoutRequests });
    } catch (err) {
        console.error('❌ Earnings error:', err);
        res.status(500).json({ ok: false, error: 'Could not compute earnings' });
    }
});

app.post('/api/mechanic/request-payout', authMechanic, async (req, res) => {
    try {
        const mechanicId = String(req.mechanicAuth.userId);
        const paymentMethod = String(req.body?.paymentMethod || 'upi').toLowerCase();
        const mechanic = await User.findById(mechanicId).lean();
        const { summary } = await getMechanicEarningsSummary(mechanicId);
        const requestedAmount = Number(req.body?.amount);
        const amount = Number.isFinite(requestedAmount) && requestedAmount > 0
            ? Math.min(requestedAmount, summary.availableBalance)
            : summary.availableBalance;

        if (!amount || amount <= 0) {
            return res.status(400).json({ ok: false, error: 'No available balance to withdraw' });
        }

        const payout = await PayoutRequest.create({
            mechanicId,
            mechanicName: mechanic?.name || req.mechanicAuth.email || '',
            amount,
            paymentMethod,
            status: 'pending'
        });
        const updated = await getMechanicEarningsSummary(mechanicId);
        const telegramNotification = await notifySubmission('payout', payout);

        res.json({
            ok: true,
            telegramNotification,
            payout,
            summary: updated.summary,
            payoutRequests: updated.payoutRequests
        });
    } catch (err) {
        console.error('❌ Payout request error:', err);
        res.status(500).json({ ok: false, error: 'Could not create payout request' });
    }
});

// Create an order with the gateway before opening Checkout.
app.post('/api/create-order', async (req, res) => {
    const rawAmount = Number(req.body?.amount);
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || Math.round(rawAmount * 100) < 100) {
        return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(503).json({ error: 'Online payments are not configured' });
    }
    try {
        const order = await razorpay.orders.create({ amount: Math.round(rawAmount * 100), currency: 'INR' });
        res.json({ id: order.id, key_id: process.env.RAZORPAY_KEY_ID, amount: order.amount, currency: order.currency });
    } catch (err) {
        console.error('❌ Razorpay order error:', err);
        res.status(502).json({ error: 'Could not create payment order' });
    }
});

// Start the server
server.listen(PORT, () => {
    console.log(`\n🚀 Server running locally!`);
    console.log(`👉 Open Mechanic Page: http://localhost:${PORT}/mechanic.html`);
    console.log(`👉 Open Mechanic App:  http://localhost:${PORT}/mechanic_dashboard.html`);
    console.log(`👉 Open Home Page:     http://localhost:${PORT}/index.html`);
});
