const express = require('express');
const router = express.Router();
const pool = require('../db');
const admin = require('firebase-admin');

// ✅ Middleware to verify Firebase token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No Firebase token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = { uid: decodedToken.uid }; // ⬅️ Set recipient ID here
    next();
  } catch (err) {
    console.error('Firebase auth error:', err);
    return res.status(403).json({ message: 'Invalid Firebase token' });
  }
};

// 🛒 POST /api/cart/checkout
router.post('/checkout', verifyFirebaseToken, async (req, res) => {
  const {
    foodName,
    foodType,
    quantity,
    expiryDate,
    pickupLocation,
    donationDate,
    serviceType,
    totalPrice
  } = req.body;

  const recipientId = req.user.uid; // ✅ From Firebase

  console.log("📥 Request Body:", req.body);
  console.log("👤 Firebase UID (recipientId):", recipientId);

  try {
    const donationResult = await pool.query(
      `SELECT * FROM donation 
       WHERE food_name = $1 
         AND food_type = $2 
         AND quantity = $3 
         AND expiry_date = $4 
         AND pickup_location = $5 
         AND status = 'available'
       LIMIT 1`,
      [foodName, foodType, quantity, expiryDate, pickupLocation]
    );

    if (donationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found or already processed.' });
    }

    const donationId = donationResult.rows[0].id;

    const updateQuery = `
      UPDATE donation 
      SET status = 'completed',
          cart_status = 'bought',
          is_bought = true,
          checkout_time = CURRENT_TIMESTAMP,
          recipient_id = $2         -- ✅ Save recipient
      WHERE donor_id = $1
      RETURNING *`;

    const updateResult = await pool.query(updateQuery, [donationId, recipientId]);

    return res.status(200).json({
      message: '✅ Donation marked as bought and completed.',
      donation: updateResult.rows[0],
    });

  } catch (err) {
    console.error('❌ Error processing cart checkout:', err);
    res.status(500).json({ error: 'Server error processing donation' });
  }
});

module.exports = router;
