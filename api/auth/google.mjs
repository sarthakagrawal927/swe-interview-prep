import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { findOrCreateUser } from '../db/users.mjs';
import { initDatabase } from '../db/schema.mjs';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

if (!GOOGLE_CLIENT_ID) {
  console.warn('GOOGLE_CLIENT_ID not set');
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export default async function handler(req, res) {
  // Initialize database on first request
  try {
    await initDatabase();
  } catch (err) {
    console.error('Database init error:', err.message);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { credential } = req.body;

  if (!credential) {
    return res.status(400).json({ error: 'credential required' });
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      return res.status(400).json({ error: 'Invalid token payload' });
    }

    const user = await findOrCreateUser({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || payload.email,
      picture: payload.picture,
    });

    const token = signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });

    return res.status(200).json({ user, token });
  } catch (error) {
    console.error('Google auth error:', error.message, error.stack);
    return res.status(401).json({
      error: 'Authentication failed',
      details: error.message,
      hasClientId: !!GOOGLE_CLIENT_ID,
      clientIdLength: GOOGLE_CLIENT_ID?.length,
    });
  }
}
