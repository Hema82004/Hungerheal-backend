const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("../middleware/cloudinary");

// Use memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

/**
 * 1️⃣ Add a new donation (image optional, donorId from Authorization header)
 */
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const donorId = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

    const {
      foodName,
      foodType,
      expiryDate,
      quantity,
      pickupLocation,
      fromLocation = "Tambaram"
    } = req.body;

    if (!donorId || !foodName || !expiryDate || !quantity || !pickupLocation) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let imageUrl = null;

    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const uploadResult = await cloudinary.uploader.upload(base64Image, {
        folder: "donations",
        public_id: `donation-${uuidv4()}`,
      });

      imageUrl = uploadResult.secure_url;
    }

    const result = await pool.query(
      `INSERT INTO donation 
        (donor_id, food_name, food_type, expiry_date, quantity, pickup_location, from_location, image_url, donation_date, status, cart_status, is_bought)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), 'available', 'available', false)
       RETURNING *`,
      [donorId, foodName, foodType, expiryDate, quantity, pickupLocation, fromLocation, imageUrl]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error inserting donation:", err.message);
    res.status(500).json({ error: "Failed to add donation" });
  }
});

/**
 * 2️⃣ Get all donations for a specific donor
 */
router.get("/user/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donation WHERE donor_id = $1 ORDER BY donation_date DESC`,
      [req.params.userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching donor donations:", err);
    res.status(500).json({ error: "Failed to get donations" });
  }
});

/**
 * 3️⃣ Get all available donations (not from current user)
 */
router.get("/available/:userId", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donation 
       WHERE status = 'available' AND donor_id != $1 AND cart_status = 'available' AND is_bought = false`,
      [req.params.userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching available donations:", err);
    res.status(500).json({ error: "Failed to get available donations" });
  }
});

/**
 * 4️⃣ Mark donation as bought
 */
router.patch("/buy/:id", async (req, res) => {
  const donationId = req.params.id;
  try {
    const result = await pool.query(
      `UPDATE donation 
       SET cart_status = 'bought', is_bought = true, status = 'booked', checkout_time = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [donationId]
    );
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error updating donation:", err);
    res.status(500).json({ error: "Failed to update donation" });
  }
});


/**
 * 5️⃣ Get all booked donations
 */
router.get("/booked", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM donation 
       WHERE cart_status = 'bought' AND is_bought = true AND status = 'booked'
       ORDER BY donation_date DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("Error fetching booked donations:", err);
    res.status(500).json({ error: "Failed to get booked donations" });
  }
});

/**
 * 6️⃣ Assign volunteer to donation
 */

 router.patch("/volunteer/:id", async (req, res) => {
  const { volunteerId } = req.body;
  const donationId = req.params.id;

  try {
    await pool.query("BEGIN");

    await pool.query(
      `UPDATE donation 
       SET status = 'in_transit'
       WHERE id = $1`,
      [donationId]
    );

    const insertResult = await pool.query(
      `INSERT INTO cart_orders (donation_id, volunteer_id)
       VALUES ($1, $2) RETURNING *`,
      [donationId, volunteerId]
    );

    await pool.query("COMMIT");
    res.status(200).json(insertResult.rows[0]);
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error("Volunteer assignment failed:", err);
    res.status(500).json({ error: "Failed to assign volunteer" });
  }
});


// PUT /api/locations/:userId
router.put("/locations/:userId", async (req, res) => {
  const { userId } = req.params;
  const { latitude, longitude, role } = req.body;

  try {
    await pool.query(`
      INSERT INTO locations (user_id, role, latitude, longitude, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) DO UPDATE SET latitude = $3, longitude = $4, updated_at = NOW()
    `, [userId, role, latitude, longitude]);

    res.status(200).json({ message: "Location updated" });
  } catch (err) {
    console.error("Error updating location:", err);
    res.status(500).json({ error: "Failed to update location" });
  }
});

// GET /api/locations/:userId
router.get("/locations/:userId", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM locations WHERE user_id = $1", [req.params.userId]);
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error fetching location:", err);
    res.status(500).json({ error: "Failed to get location" });
  }
});

// PATCH /api/donations/complete/:id
router.patch("/complete/:id", async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE donation 
      SET status = 'delivered', delivered_at = NOW() 
      WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("Error marking delivery complete:", err);
    res.status(500).json({ error: "Failed to mark as delivered" });
  }
});
module.exports = router;