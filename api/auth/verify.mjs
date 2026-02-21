import jwt from 'jsonwebtoken';
import { getUserById } from '../db/users.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export async function requireAuth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  const token = authHeader.slice(7);
  const decoded = verifyToken(token);

  if (!decoded || !decoded.userId) {
    res.status(401).json({ error: 'Invalid token' });
    return null;
  }

  const user = await getUserById(decoded.userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }

  return user;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  return res.status(200).json({ user });
}
