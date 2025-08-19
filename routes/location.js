const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST /api/location
router.post('/location', async (req, res) => {
  const { user_id, role, latitude, longitude } = req.body;

  if (!user_id || !role || !latitude || !longitude) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    await pool.query(
      `INSERT INTO location (user_id, role, latitude, longitude, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET role = $2, latitude = $3, longitude = $4, updated_at = NOW()`,
      [user_id, role, latitude, longitude]
    );

    res.status(201).json({ message: 'Location inserted/updated successfully' });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
