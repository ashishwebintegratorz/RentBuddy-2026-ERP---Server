require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes/routes');
const pathModule = require('path');

require('./cron/subscriptionReminder.cron');

const app = express();
const PORT = process.env.PORT || 4000;

// ✅ REQUEST LOGGER (Add this to see all requests)
app.use((req, res, next) => {
  console.log(`[DEBUG] ${req.method} ${req.url}`);
  next();
});

// ✅ CORS
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://rentbuddy.in',
    'https://www.rentbuddy.in',
    'https://admin.rentbuddy.in',
  ],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

/**
 * ✅ JSON parser with RAW BODY support
 * Razorpay webhook will use req.rawBody
 */
app.use(
  express.json({
    limit: '50mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

/**
 * ✅ URL-ENCODED parser
 * Needed for normal form posts (NOT file uploads)
 */
app.use(
  express.urlencoded({
    extended: true,
    limit: '50mb',
  })
);

// ❌ DO NOT use body-parser separately
// express already includes it

// Static files
app.use('/uploads', express.static(pathModule.join(__dirname, 'uploads')));

// Routes
app.use('/api', routes);

// MongoDB
mongoose
  .connect(process.env.MONGODB_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ DEBUG: Request logging is ACTIVE.`);
});