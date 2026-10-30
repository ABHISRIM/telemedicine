import { Router } from 'express'
import mongoose from 'mongoose'
import Appointment from '../models/Appointment.js'
import Consultation from '../models/Consultation.js'
import Professional from '../models/Professional.js'
import Payment from '../models/Payment.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

async function accessibleAppointment(req, id) {
  if (!mongoose.isValidObjectId(id)) return null
  const appointment = await Appointment.findById(id)
  if (!appointment) return null
  if (appointment.patientId.equals(req.user._id)) return appointment
  if (req.user.role === 'professional') {
    const profile = await Professional.findOne({ userId: req.user._id })
    if (profile && appointment.professionalId.equals(profile._id)) return appointment
  }
  return false
}

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const appointment = await accessibleAppointment(req, req.params.id)
    if (appointment === false) return res.status(403).json({ message: 'You cannot view this consultation.' })
    if (!appointment) return res.status(404).json({ message: 'Consultation not found.' })
    if (appointment.status !== 'accepted') return res.status(403).json({ message: 'The appointment has not been accepted for consultation.' })
    const payment = await Payment.findOne({ appointmentId: appointment._id })
    if (!payment || payment.status !== 'paid') {
      return res.status(402).json({ message: 'Payment is required before joining this consultation.', paymentStatus: payment?.status === 'pending' ? 'unpaid' : (payment?.status || 'unpaid') })
    }
    const start = new Date(appointment.date)
    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(appointment.time)
    if (timeMatch) {
      start.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0)
    }
    const duration = appointment.planDuration || 15
    const windowStart = new Date(start.getTime() - 15 * 60 * 1000)
    const windowEnd = new Date(start.getTime() + duration * 60 * 1000 + 15 * 60 * 1000)
    const now = new Date()
    if (now < windowStart || now > windowEnd) {
      return res.status(423).json({ message: 'The consultation room opens 15 minutes before the appointment and closes after the scheduled session.', start: start.toISOString(), end: windowEnd.toISOString() })
    }
    let consultation = await Consultation.findOne({ appointmentId: appointment._id })
    if (!consultation) consultation = await Consultation.create({ appointmentId: appointment._id, patientId: appointment.patientId, professionalId: appointment.professionalId })
    res.json(consultation)
  } catch (error) { next(error) }
})

router.post('/:id/notes', authenticate, async (req, res, next) => {
  try {
    if (!['professional', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Only the professional can add consultation guidance.' })
    const appointment = await accessibleAppointment(req, req.params.id)
    if (appointment === false) return res.status(403).json({ message: 'You cannot update this consultation.' })
    if (!appointment) return res.status(404).json({ message: 'Consultation not found.' })
    const { notes = '', guidance = '', recommendedCategories = [] } = req.body
    if (notes.length > 5000 || guidance.length > 5000) return res.status(400).json({ message: 'Notes must be under 5000 characters.' })
    const categories = ['Nutrition', 'Yoga', 'Meditation', 'Exercise']
    if (!Array.isArray(recommendedCategories) || recommendedCategories.some((category) => !categories.includes(category))) return res.status(400).json({ message: 'Choose valid wellness resource categories.' })
    const consultation = await Consultation.findOneAndUpdate(
      { appointmentId: appointment._id },
      { $set: { notes, guidance, recommendedCategories }, $setOnInsert: { patientId: appointment.patientId, professionalId: appointment.professionalId } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
    res.json(consultation)
  } catch (error) { next(error) }
})

export default router