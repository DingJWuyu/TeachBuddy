import { verifyToken } from '../core/auth.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const session = verifyToken(token);

  if (!session) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  req.user = session;
  return next();
}
