require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// LowDB for fallback storage
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_change_in_production';

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    // Allow localhost for development
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    
    // Allow production domains
    if (origin.includes('mechway.in') || 
        origin.includes('vercel.app') || 
        origin.includes('onrender.com') ||
        origin.includes('newonwheels')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());

// Serve static frontend from parent folder
app.use(express.static(path.join(__dirname, '..')));

// ======================= LOWDB SETUP (Fallback Storage) =======================
const lowdbFile = path.join(__dirname, 'mechway.json');
const adapter = new JSONFile(lowdbFile);
const db = new Low(adapter);

async function initDB() {
  await db.read();
  db.data = db.data || { contacts: [], bookings: [], inquiries: [], payments: [] };
  await db.write();
}

async function addContact(obj) {
  await db.read();
  const entry = { id: nanoid(), created_at: new Date().toISOString(), ...obj };
  db.data.contacts.unshift(entry);
  await db.write();
  return entry;
}

async function addBooking(obj) {
  await db.read();
  const entry = { id: nanoid(), created_at: new Date().toISOString(), ...obj };
  db.data.bookings.unshift(entry);
  await db.write();
  return entry;
}

async function addInquiry(obj) {
  await db.read();
  const entry = { id: nanoid(), created_at: new Date().toISOString(), ...obj };
  db.data.inquiries.unshift(entry);
  await db.write();
  return entry;
}

async function addPayment(obj) {
  await db.read();
  const entry = { id: nanoid(), created_at: new Date().toISOString(), ...obj };
  db.data.payments.unshift(entry);
  await db.write();
  return entry;
}

async function getAllData() {
  await db.read();
  return {
    contacts: db.data.contacts || [],
    bookings: db.data.bookings || [],
    inquiries: db.data.inquiries || [],
    payments: db.data.payments || []
  };
}

// Initialize LowDB
initDB().then(() => console.log('✅ LowDB initialized (fallback storage ready)'));

// ======================= MONGODB CONNECTION (Primary Storage) =======================
let mongoConnected = false;
// Use Atlas URI from environment variable, fallback to local for development
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/mechway';

if (MONGO_URI) {
  mongoose.connect(MONGO_URI)
    .then(() => {
      mongoConnected = true;
      console.log('✅ MongoDB Connected');
    })
    .catch(err => {
      console.warn('⚠️ MongoDB Connection Failed - Using LowDB fallback:', err.message);
    });
} else {
  console.log('⚠️ No MongoDB URI configured - Using LowDB fallback');
}

// ======================= MONGOOSE SCHEMAS =======================

const ContactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  subject: { type: String, default: '' },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const BookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleBrand: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  vehicleColor: { type: String, default: '' },
  problem: { type: String, default: '' },
  servicePrice: { type: Number, default: 0 },
  message: { type: String, required: true },
  latitude: { type: String, default: '' },
  longitude: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const InquirySchema = new mongoose.Schema({
  product_id: { type: String, default: '' },
  product_name: { type: String, required: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const PaymentSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerPhone: { type: String, required: true },
  vehicleType: { type: String, required: true },
  vehicleBrand: { type: String, default: '' },
  vehicleModel: { type: String, default: '' },
  vehicleNumber: { type: String, default: '' },
  vehicleColor: { type: String, default: '' },
  service: { type: String, required: true },
  servicePrice: { type: Number, required: true },
  platformFee: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['cash', 'online'], required: true },
  originalMessage: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, unique: true, sparse: true },
  email: { type: String, unique: true, sparse: true },
  address: { type: String, required: true },
  aadharNo: { type: String, required: true, unique: true },
  mechanicType: { type: String, enum: ['car', 'bike'], default: '' },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Contact = mongoose.model('Contact', ContactSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const Inquiry = mongoose.model('Inquiry', InquirySchema);
const Payment = mongoose.model('Payment', PaymentSchema);
const User = mongoose.model('User', UserSchema);

// ======================= MIDDLEWARE =======================

function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.admin_key;
  if (!process.env.ADMIN_KEY) return res.status(500).json({ error: 'Admin key not configured' });
  if (!key || key !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ======================= API ROUTES =======================

// POST /api/contact
app.post('/api/contact', async (req, res) => {
  const { name, phone, email, subject, message } = req.body || {};
  
  if (!name || !phone || !message) {
    return res.status(400).json({ error: 'name, phone and message are required' });
  }

  try {
    if (mongoConnected) {
      const entry = new Contact({ name, phone, email: email || '', subject: subject || '', message });
      await entry.save();
      return res.json({ ok: true, id: entry._id, storage: 'mongodb' });
    } else {
      const entry = await addContact({ name, phone, email: email || '', subject: subject || '', message });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb' });
    }
  } catch (err) {
    console.error('contact save error', err);
    // Fallback to LowDB on error
    try {
      const entry = await addContact({ name, phone, email: email || '', subject: subject || '', message });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb-fallback' });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Could not save contact' });
    }
  }
});

// POST /api/book
app.post('/api/book', async (req, res) => {
  const { name, phone, vehicleType, vehicleBrand, vehicleModel, vehicleNumber, vehicleColor, problem, servicePrice, message, latitude, longitude } = req.body || {};
  
  if (!name || !phone || !vehicleType || !message) {
    return res.status(400).json({ error: 'name, phone, vehicleType & message are required' });
  }

  try {
    if (mongoConnected) {
      const entry = new Booking({
        name, phone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        problem: problem || '',
        servicePrice: servicePrice || 0,
        message,
        latitude: latitude || '',
        longitude: longitude || ''
      });
      await entry.save();
      return res.json({ ok: true, id: entry._id, storage: 'mongodb' });
    } else {
      const entry = await addBooking({
        name, phone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        problem: problem || '',
        servicePrice: servicePrice || 0,
        message,
        latitude: latitude || '',
        longitude: longitude || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb' });
    }
  } catch (err) {
    console.error('booking save error', err);
    try {
      const entry = await addBooking({
        name, phone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        problem: problem || '',
        servicePrice: servicePrice || 0,
        message,
        latitude: latitude || '',
        longitude: longitude || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb-fallback' });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Could not save booking' });
    }
  }
});

// POST /api/inquiry
app.post('/api/inquiry', async (req, res) => {
  const { product_id, product_name, name, phone, message } = req.body || {};
  
  if (!name || !phone || !product_name) {
    return res.status(400).json({ error: 'name, phone and product_name are required' });
  }

  try {
    if (mongoConnected) {
      const entry = new Inquiry({
        product_id: product_id || '',
        product_name, name, phone,
        message: message || ''
      });
      await entry.save();
      return res.json({ ok: true, id: entry._id, storage: 'mongodb' });
    } else {
      const entry = await addInquiry({
        product_id: product_id || '',
        product_name, name, phone,
        message: message || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb' });
    }
  } catch (err) {
    console.error('inquiry save error', err);
    try {
      const entry = await addInquiry({
        product_id: product_id || '',
        product_name, name, phone,
        message: message || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb-fallback' });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Could not save inquiry' });
    }
  }
});

// POST /api/payment
app.post('/api/payment', async (req, res) => {
  const { customerName, customerPhone, vehicleType, vehicleBrand, vehicleModel, vehicleNumber, vehicleColor, service, servicePrice, platformFee, totalAmount, paymentMethod, originalMessage } = req.body || {};
  
  if (!customerName || !customerPhone || !vehicleType || !service || servicePrice === undefined || servicePrice === null || platformFee === undefined || platformFee === null || totalAmount === undefined || totalAmount === null || !paymentMethod) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (mongoConnected) {
      const entry = new Payment({
        customerName, customerPhone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        service,
        servicePrice: Number(servicePrice),
        platformFee: Number(platformFee),
        totalAmount: Number(totalAmount),
        paymentMethod,
        originalMessage: originalMessage || ''
      });
      await entry.save();
      return res.json({ ok: true, id: entry._id, storage: 'mongodb' });
    } else {
      const entry = await addPayment({
        customerName, customerPhone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        service,
        servicePrice: Number(servicePrice),
        platformFee: Number(platformFee),
        totalAmount: Number(totalAmount),
        paymentMethod,
        originalMessage: originalMessage || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb' });
    }
  } catch (err) {
    console.error('payment save error', err);
    try {
      const entry = await addPayment({
        customerName, customerPhone, vehicleType,
        vehicleBrand: vehicleBrand || '',
        vehicleModel: vehicleModel || '',
        vehicleNumber: vehicleNumber || '',
        vehicleColor: vehicleColor || '',
        service,
        servicePrice: Number(servicePrice),
        platformFee: Number(platformFee),
        totalAmount: Number(totalAmount),
        paymentMethod,
        originalMessage: originalMessage || ''
      });
      return res.json({ ok: true, id: entry.id, storage: 'lowdb-fallback' });
    } catch (fallbackErr) {
      return res.status(500).json({ error: 'Could not save payment' });
    }
  }
});

// GET /api/admin/submissions
app.get('/api/admin/submissions', requireAdmin, async (req, res) => {
  try {
    if (mongoConnected) {
      const contacts = await Contact.find({}).sort({ createdAt: -1 });
      const bookings = await Booking.find({}).sort({ createdAt: -1 });
      const inquiries = await Inquiry.find({}).sort({ createdAt: -1 });
      const payments = await Payment.find({}).sort({ createdAt: -1 });
      return res.json({ contacts, bookings, inquiries, payments, storage: 'mongodb' });
    } else {
      const data = await getAllData();
      return res.json({ ...data, storage: 'lowdb' });
    }
  } catch (err) {
    console.error('admin fetch error', err);
    return res.status(500).json({ error: 'Could not fetch submissions' });
  }
});

// POST /api/signup
app.post('/api/signup', async (req, res) => {
  const { name, phone, email, address, aadharNo, password, mechanicType } = req.body || {};
  
  if (!name || !password || (!phone && !email) || !address || !aadharNo || !mechanicType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    if (mongoConnected) {
      const existingUser = await User.findOne({
        $or: [{ phone: phone || undefined }, { email: email || undefined }, { aadharNo }]
      });
      
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({
        name, phone: phone || '', email: email || '', address, aadharNo, mechanicType, password: hashedPassword
      });
      await newUser.save();
      
      const token = jwt.sign({ userId: newUser._id, email: newUser.email, phone: newUser.phone }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ ok: true, token, user: { id: newUser._id, name: newUser.name, email: newUser.email, phone: newUser.phone, mechanicType: newUser.mechanicType } });
    } else {
      return res.status(500).json({ error: 'Sign up requires MongoDB' });
    }
  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Could not create account' });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { identifier, password } = req.body || {};
  
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  try {
    if (!mongoConnected) {
      return res.status(500).json({ error: 'Login requires MongoDB' });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }]
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, email: user.email, phone: user.phone, mechanicType: user.mechanicType }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ ok: true, token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, mechanicType: user.mechanicType } });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: Date.now(),
    storage: mongoConnected ? 'mongodb' : 'lowdb'
  });
});

// ======================= START SERVER =======================

app.listen(PORT, () => {
  const serverURL = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : `http://localhost:${PORT}`;
  
  console.log(`\n🚀 MechWay backend running at ${serverURL}`);
  console.log(`📊 Admin panel: ${serverURL}/admin`);
  console.log(`💾 Storage: ${mongoConnected ? 'MongoDB' : 'LowDB (file-based)'}\n`);
});
