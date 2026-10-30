import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export async function authenticate(req, res, next) {
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ message: 'Authentication is required.' })
  if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'JWT_SECRET is not configured.' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.id)
    if (!user || !user.active) return res.status(401).json({ message: 'This account is unavailable.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Your session is invalid or has expired.' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'You do not have access to this resource.' })
    next()
  }
}