import { Router } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Professional from '../models/Professional.js'

const router = Router()
const publicUser = (user) => ({ _id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone })

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone = '', role = 'patient', specialty = 'General Wellness', bio = '' } = req.body
    if (!name?.trim() || !email?.trim() || !password) return res.status(400).json({ message: 'Name, email, and password are required.' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters.' })
    if (!['patient', 'professional'].includes(role)) return res.status(400).json({ message: 'Choose a valid account type.' })
    if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'The server authentication secret is not configured.' })
    const user = await User.create({ name, email, password, phone, role })
    if (role === 'professional') await Professional.create({ userId: user._id, specialty, bio })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ user: publicUser(user), token })
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.' })
    next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' })
    if (!process.env.JWT_SECRET) return res.status(503).json({ message: 'The server authentication secret is not configured.' })
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password')
    if (!user || !user.active || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Email or password is incorrect.' })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ user: publicUser(user), token })
  } catch (error) { next(error) }
})

export default router