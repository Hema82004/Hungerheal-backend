// middleware/firebaseAuth.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json'); // path to your Firebase service key

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.donorId = decodedToken.uid; // ✅ Set donorId from Firebase UID
    next();
  } catch (err) {
    console.error('Firebase auth error:', err);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = verifyFirebaseToken;
