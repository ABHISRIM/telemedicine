import { Router } from 'express'
import mongoose from 'mongoose'
import Appointment from '../models/Appointment.js'
import Professional from '../models/Professional.js'
import Payment from '../models/Payment.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()
const populated = (query) => query.populate('patientId', 'name email phone').populate({ path: 'professionalId', populate: { path: 'userId', select: 'name email' } })

export const consultationPlans = {
  basic: { id: 'basic', name: 'Basic Consultation', price: 99, duration: 15, description: '15-minute consultation session' },
  meditation: { id: 'meditation', name: 'Meditation Session', price: 49, duration: 15, description: '15-minute meditation session' },
  yoga: { id: 'yoga', name: 'Yoga Session', price: 79, duration: 30, description: '30-minute yoga session' },
  wellness: { id: 'wellness', name: 'Wellness Package', price: 199, duration: 60, description: 'Basic consultation, meditation session, and yoga session' },
}

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patient accounts can request appointments.' })
    const { professionalId, date, time, consultationType = 'video', planId = 'basic' } = req.body
    if (!mongoose.isValidObjectId(professionalId) || !date || !time) return res.status(400).json({ message: 'Professional, date, and time are required.' })
    const appointmentDate = new Date(date)
    if (Number.isNaN(appointmentDate.getTime()) || appointmentDate < new Date(new Date().setHours(0, 0, 0, 0))) return res.status(400).json({ message: 'Choose a current or future date.' })
    if (!['video', 'audio'].includes(consultationType)) return res.status(400).json({ message: 'Choose a valid consultation type.' })
    const professional = await Professional.findOne({ _id: professionalId, acceptingAppointments: true })
    if (!professional) return res.status(404).json({ message: 'Professional not found or unavailable.' })
    const plan = consultationPlans[planId]
    if (!plan) return res.status(400).json({ message: 'Select a valid consultation plan.' })
    const appointment = await Appointment.create({
      patientId: req.user._id,
      professionalId,
      date: appointmentDate,
      time,
      consultationType,
      planId: plan.id,
      planName: plan.name,
      planPrice: plan.price,
      planDuration: plan.duration,
    })
    res.status(201).json(await populated(Appointment.findById(appointment._id)))
  } catch (error) { next(error) }
})

router.get('/', authenticate, async (req, res, next) => {
  try {
    let query = {}
    if (req.user.role === 'patient') query.patientId = req.user._id
    if (req.user.role === 'professional') {
      const profile = await Professional.findOne({ userId: req.user._id })
      if (!profile) return res.json([])
      query.professionalId = profile._id
    }
    const appointments = await populated(Appointment.find(query).sort({ date: 1, time: 1 }))
    const payments = await Payment.find({ appointmentId: { $in: appointments.map((item) => item._id) } })
    const paymentByAppointment = new Map(payments.map((item) => [String(item.appointmentId), item]))
    res.json(appointments.map((appointment) => {
      const payment = paymentByAppointment.get(String(appointment._id))
      const serialized = appointment.toObject()
      const plan = consultationPlans[appointment.planId] || consultationPlans.basic
      if (!appointment.planId || appointment.planId === 'basic' || appointment.planName === 'Basic Consultation') {
        serialized.planId = 'basic'
        serialized.planName = plan.name
        serialized.planPrice = plan.price
        serialized.planDuration = plan.duration
      }
      serialized.payment = payment
        ? {
            status: payment.status,
            amount: payment.amount,
            currency: payment.currency,
            paymentId: payment.paymentId,
            paymentDate: payment.paymentDate,
            transactionId: payment.paymentId,
            planId: appointment.planId,
            planName: appointment.planName,
            duration: appointment.planDuration,
            planId: payment.planId,
            planName: payment.planName,
          }
        : {
            status: 'unpaid',
            amount: appointment.planPrice || appointment.professionalId?.consultationFee || 500,
            currency: 'INR',
            paymentId: null,
            paymentDate: null,
            planId: appointment.planId,
            planName: appointment.planName,
            duration: appointment.planDuration,
          }
      return serialized
    }))
  } catch (error) { next(error) }
})

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Appointment not found.' })
    const appointment = await Appointment.findById(req.params.id)
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    const profile = req.user.role === 'professional' ? await Professional.findOne({ userId: req.user._id }) : null
    const isPatient = appointment.patientId.equals(req.user._id)
    const isProfessional = profile && appointment.professionalId.equals(profile._id)
    if (req.user.role !== 'admin' && !isPatient && !isProfessional) return res.status(403).json({ message: 'You cannot update this appointment.' })
    const { status } = req.body
    const allowed = isPatient ? ['cancelled'] : isProfessional ? ['accepted', 'rejected', 'completed'] : ['accepted', 'rejected', 'completed', 'cancelled']
    if (!allowed.includes(status)) return res.status(400).json({ message: 'That appointment status change is not allowed.' })
    appointment.status = status
    await appointment.save()
    res.json(await populated(Appointment.findById(appointment._id)))
  } catch (error) { next(error) }
})

export default router