import { Router } from 'express'
import mongoose from 'mongoose'
import Professional from '../models/Professional.js'

const router = Router()
const profileQuery = () => Professional.find({ acceptingAppointments: true }).populate({ path: 'userId', match: { active: true }, select: 'name email phone' })
const serializeProfile = (profile) => ({
  _id: profile._id,
  userId: profile.userId?._id,
  name: profile.userId?.name || 'Healthcare professional',
  email: profile.userId?.email,
  phone: profile.userId?.phone,
  specialty: profile.specialty,
  bio: profile.bio,
  experience: profile.experience,
  languages: profile.languages,
  consultationFee: profile.consultationFee || 500,
})

router.get('/', async (_req, res, next) => {
  try { res.json((await profileQuery().sort({ createdAt: -1 })).map(serializeProfile)) } catch (error) { next(error) }
})

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Professional not found.' })
    const profile = await Professional.findOne({ _id: req.params.id, acceptingAppointments: true }).populate({ path: 'userId', match: { active: true }, select: 'name email phone' })
    if (!profile || !profile.userId) return res.status(404).json({ message: 'Professional not found.' })
    res.json(serializeProfile(profile))
  } catch (error) { next(error) }
})

export default router