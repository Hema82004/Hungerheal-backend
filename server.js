const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cartRoutes = require('./routes/cart');
const donationRoutes = require('./routes/donations');
const pool = require('./db');

const app = express();
const PORT = 5000;
app.use(cors({
  origin: "*", // 🔓 Allow all origins (for development only)
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(bodyParser.json());

// Correct routes here ✅
app.use('/api/cart', cartRoutes);
app.use('/api/donations', donationRoutes);
const expiryRoutes = require("./routes/expiry");
app.use("/api", expiryRoutes);
app.use("/uploads", express.static("uploads"));


const locationRoutes = require('./routes/location');
app.use('/api/location', locationRoutes);

pool.connect()
  .then(() => console.log('✅ Connected to PostgreSQL'))
  .catch(err => console.error('❌ PostgreSQL connection error:', err));
app.get("/", (req, res) => {
  res.send("✅ Backend is running on Render!");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
