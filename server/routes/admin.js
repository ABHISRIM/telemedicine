import { Router } from 'express'
import mongoose from 'mongoose'
import Appointment from '../models/Appointment.js'
import User from '../models/User.js'
import WellnessContent from '../models/WellnessContent.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()
router.use(authenticate, requireRole('admin'))

router.get('/users', async (_req, res, next) => {
  try { res.json(await User.find().select('-password').sort({ createdAt: -1 })) } catch (error) { next(error) }
})

router.put('/users/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'User not found.' })
    if (typeof req.body.active !== 'boolean') return res.status(400).json({ message: 'Provide an active boolean.' })
    if (String(req.user._id) === req.params.id && !req.body.active) return res.status(400).json({ message: 'You cannot deactivate your own admin account.' })
    const user = await User.findByIdAndUpdate(req.params.id, { active: req.body.active }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json(user)
  } catch (error) { next(error) }
})

router.get('/appointments', async (_req, res, next) => {
  try { res.json(await Appointment.find().populate('patientId', 'name email').populate({ path: 'professionalId', populate: { path: 'userId', select: 'name email' } }).sort({ date: -1 })) } catch (error) { next(error) }
})

router.post('/wellness', async (req, res, next) => {
  try { res.status(201).json(await WellnessContent.create(req.body)) } catch (error) { next(error) }
})

router.put('/wellness/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Wellness resource not found.' })
    const item = await WellnessContent.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
    if (!item) return res.status(404).json({ message: 'Wellness resource not found.' })
    res.json(item)
  } catch (error) { next(error) }
})

router.delete('/wellness/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Wellness resource not found.' })
    const item = await WellnessContent.findByIdAndDelete(req.params.id)
    if (!item) return res.status(404).json({ message: 'Wellness resource not found.' })
    res.json({ message: 'Wellness resource deleted.' })
  } catch (error) { next(error) }
})

export default router