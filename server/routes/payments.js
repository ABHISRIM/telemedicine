import crypto from 'node:crypto'
import { Router } from 'express'
import mongoose from 'mongoose'
import Razorpay from 'razorpay'
import Appointment from '../models/Appointment.js'
import Payment from '../models/Payment.js'
import Professional from '../models/Professional.js'
import { authenticate } from '../middleware/auth.js'
import { consultationPlans } from './appointments.js'

const router = Router()

function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay test credentials are not configured.')
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  })
}

router.get('/config/key', authenticate, (req, res) => {
  const keyId = process.env.RAZORPAY_KEY_ID || ''
  const secretConfigured = Boolean(process.env.RAZORPAY_KEY_SECRET)
  res.json({
    keyId,
    configured: Boolean(keyId && secretConfigured && keyId.startsWith('rzp_test_')),
    mode: keyId.startsWith('rzp_test_') ? 'test' : keyId ? 'gateway-key-configured' : 'not-configured',
  })
})

router.post('/orders', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can create payments.' })
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const appointment = await Appointment.findById(appointmentId).populate('professionalId', 'consultationFee')
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    if (!appointment.patientId.equals(req.user._id)) return res.status(403).json({ message: 'You cannot pay for this appointment.' })
    if (['cancelled', 'rejected'].includes(appointment.status)) return res.status(400).json({ message: 'Payment is not available for this appointment.' })

    const existing = await Payment.findOne({ appointmentId })
    if (existing?.status === 'paid') return res.status(409).json({ message: 'This appointment has already been paid.' })
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({
        message: 'Razorpay test credentials are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env, then restart the backend.',
      })
    }

    const plan = consultationPlans[appointment.planId || 'basic'] || consultationPlans.basic
    const serverPrice = plan.price
    if (appointment.planPrice !== serverPrice) {
      appointment.planId = plan?.id || 'basic'
      appointment.planName = plan?.name || 'Basic Consultation'
      appointment.planPrice = serverPrice
      appointment.planDuration = plan?.duration || 15
      await appointment.save()
    }
    const amount = Math.round(serverPrice * 100)
    if (appointment.planId === 'basic' && amount !== 9900) {
      return res.status(500).json({ message: 'Basic Consultation is configured with an invalid server price.' })
    }
    const razorpay = razorpayClient()
    if (existing?.status === 'pending' && existing.orderId && existing.amount * 100 === amount) {
      return res.status(201).json({
        orderId: existing.orderId,
        amount,
        currency: 'INR',
        keyId: process.env.RAZORPAY_KEY_ID,
        name: 'TeleWellness',
        description: appointment.planName || 'Consultation payment',
      })
    }
    let order
    try {
      order = await razorpay.orders.create({
        amount,
        currency: 'INR',
        receipt: `apt_${appointmentId}`.slice(0, 40),
        notes: { appointmentId: String(appointmentId), patientId: String(req.user._id) },
      })
    } catch (gatewayError) {
      const gatewayMessage = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Razorpay could not create the payment order.'
      return res.status(502).json({ message: `Razorpay order creation failed: ${gatewayMessage}` })
    }
    await Payment.findOneAndUpdate(
      { appointmentId },
      {
        appointmentId, patientId: req.user._id, amount: amount / 100, currency: 'INR',
        planId: appointment.planId || 'basic', planName: appointment.planName || 'Basic Consultation',
        status: 'pending', orderId: order.id, paymentId: undefined, signature: '', paymentDate: null, failureReason: '',
      },
      { upsert: true, new: true, runValidators: true },
    )
    res.status(201).json({
      orderId: order.id,
      amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID,
      name: 'TeleWellness',
      description: 'Consultation payment',
    })
  } catch (error) { next(error) }
})

router.post('/qr', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can create UPI payment QR codes.' })
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const appointment = await Appointment.findById(appointmentId)
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    if (!appointment.patientId.equals(req.user._id)) return res.status(403).json({ message: 'You cannot pay for this appointment.' })
    if (['cancelled', 'rejected'].includes(appointment.status)) return res.status(400).json({ message: 'Payment QR codes are not available for this appointment.' })

    const existing = await Payment.findOne({ appointmentId, patientId: req.user._id })
    if (existing?.status === 'paid') return res.status(409).json({ message: 'This appointment has already been paid.' })
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ message: 'Razorpay test credentials are not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to server/.env, then restart the backend.' })
    }

    const plan = consultationPlans[appointment.planId || 'basic'] || consultationPlans.basic
    if (plan.id !== 'basic') return res.status(400).json({ message: 'UPI QR payment is currently available for Basic Consultation only.' })
    appointment.planId = plan.id
    appointment.planName = plan.name
    appointment.planPrice = 99
    appointment.planDuration = plan.duration
    await appointment.save()

    if (existing?.qrCodeId && existing?.qrImageUrl && existing.status === 'pending') {
      try {
        const existingQr = await razorpayClient().qrCode.fetch(existing.qrCodeId)
        if (existingQr.status === 'active' && existingQr.close_reason == null) {
          return res.json({
            qrCodeId: existing.qrCodeId,
            qrImageUrl: existing.qrImageUrl,
            amount: 9900,
            currency: 'INR',
            closeBy: existingQr.close_by || null,
          })
        }
      } catch (gatewayError) {
        const statusCode = gatewayError?.statusCode || gatewayError?.response?.status || null
        const sanitizedError = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Unable to fetch the existing QR code.'
        console.error('Razorpay QR reuse check failed:', { status: statusCode, error: String(sanitizedError).slice(0, 300) })
      }
    }

    const razorpay = razorpayClient()
    let qr
    try {
      qr = await razorpay.qrCode.create({
        type: 'upi_qr',
        name: 'TeleWellness Basic Consultation',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: 9900,
        description: `Appointment ${appointmentId}`,
        close_by: Math.floor(Date.now() / 1000) + 30 * 60,
        notes: { appointmentId: String(appointmentId), patientId: String(req.user._id), planId: 'basic' },
      })
    } catch (gatewayError) {
      const gatewayMessage = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Razorpay could not create the payment QR.'
      const statusCode = gatewayError?.statusCode || gatewayError?.response?.status || null
      console.error('Razorpay QR creation failed:', {
        status: statusCode,
        error: String(gatewayMessage).slice(0, 300),
      })
      return res.status(502).json({ message: `Razorpay QR creation failed: ${gatewayMessage}` })
    }

    await Payment.findOneAndUpdate(
      { appointmentId },
      {
        appointmentId,
        patientId: req.user._id,
        amount: 99,
        currency: 'INR',
        planId: 'basic',
        planName: 'Basic Consultation',
        status: 'pending',
        qrCodeId: qr.id,
        qrImageUrl: qr.image_url || qr.image_url || '',
        paymentId: undefined,
        signature: '',
        paymentDate: null,
        failureReason: '',
      },
      { upsert: true, new: true, runValidators: true },
    )
    res.status(201).json({
      qrCodeId: qr.id,
      qrImageUrl: qr.image_url,
      amount: 9900,
      currency: 'INR',
      closeBy: qr.close_by || null,
    })
  } catch (error) { next(error) }
})

router.post('/payment-link/basic', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can create payment links.' })
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(503).json({
        message: 'Payment rollout is stopped: configure RAZORPAY_WEBHOOK_SECRET in server/.env and verify the Razorpay webhook before creating payment links.',
      })
    }
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const appointment = await Appointment.findById(appointmentId).populate('patientId', 'name email phone')
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    if (!appointment.patientId._id.equals(req.user._id)) return res.status(403).json({ message: 'You cannot pay for this appointment.' })
    if (['cancelled', 'rejected'].includes(appointment.status)) return res.status(400).json({ message: 'Payment is not available for this appointment.' })
    const plan = consultationPlans[appointment.planId || 'basic'] || consultationPlans.basic
    if (plan.id !== 'basic' || plan.price !== 99) return res.status(400).json({ message: 'Secure payment links are only available for Basic Consultation.' })

    const existing = await Payment.findOne({ appointmentId, patientId: req.user._id })
    if (existing?.status === 'paid') return res.status(409).json({ message: 'This appointment has already been paid.' })
    if (existing?.paymentLinkId && existing?.paymentLinkUrl && existing.status === 'pending') {
      return res.json({
        paymentLinkId: existing.paymentLinkId,
        shortUrl: existing.paymentLinkUrl,
        amount: 9900,
        currency: 'INR',
        appointmentId: String(appointmentId),
      })
    }

    const patient = appointment.patientId
    const callbackOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5174').split(',')[0].trim()
    const client = razorpayClient()
    let paymentLink
    try {
      const customer = { name: patient.name }
      if (patient.email) customer.email = patient.email
      if (patient.phone) customer.contact = patient.phone
      paymentLink = await client.paymentLink.create({
        upi_link: true,
        amount: 9900,
        currency: 'INR',
        accept_partial: false,
        expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
        reference_id: `apt_${appointmentId}`.slice(0, 40),
        description: 'TeleWellness Basic Consultation - Dr. Maya Chen',
        customer,
        notify: { email: false, sms: false, whatsapp: false },
        reminder_enable: false,
        notes: {
          appointmentId: String(appointmentId),
          patientId: String(req.user._id),
          planId: 'basic',
          planName: 'Basic Consultation',
        },
        callback_url: `${callbackOrigin}/payment/${appointmentId}?payment=return`,
        callback_method: 'get',
      })
    } catch (gatewayError) {
      const statusCode = gatewayError?.statusCode || gatewayError?.response?.status || null
      const gatewayMessage = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Razorpay could not create the payment link.'
      console.error('Razorpay payment link creation failed:', { status: statusCode, error: String(gatewayMessage).slice(0, 300) })
      return res.status(502).json({ message: `Razorpay payment link creation failed: ${gatewayMessage}` })
    }

    await Payment.findOneAndUpdate(
      { appointmentId },
      {
        appointmentId,
        patientId: req.user._id,
        amount: 99,
        currency: 'INR',
        planId: 'basic',
        planName: 'Basic Consultation',
        status: 'pending',
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.short_url,
        paymentId: undefined,
        signature: '',
        paymentDate: null,
        failureReason: '',
      },
      { upsert: true, new: true, runValidators: true },
    )
    res.status(201).json({
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      amount: 9900,
      currency: 'INR',
      appointmentId: String(appointmentId),
    })
  } catch (error) { next(error) }
})

router.post('/payment-link/meditation', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can create meditation payment links.' })
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(503).json({ message: 'Payment verification is stopped until RAZORPAY_WEBHOOK_SECRET is configured.' })
    }
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const appointment = await Appointment.findById(appointmentId).populate('patientId', 'name email phone')
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' })
    if (!appointment.patientId._id.equals(req.user._id)) return res.status(403).json({ message: 'You cannot pay for this appointment.' })
    if (['cancelled', 'rejected'].includes(appointment.status)) return res.status(400).json({ message: 'Payment is not available for this appointment.' })
    const plan = consultationPlans[appointment.planId || 'meditation'] || consultationPlans.meditation
    if (plan.id !== 'meditation') return res.status(400).json({ message: 'This payment link is only for Meditation Sessions.' })

    const existing = await Payment.findOne({ appointmentId, patientId: req.user._id })
    if (existing?.status === 'paid') return res.status(409).json({ message: 'This Meditation Session has already been paid.' })
    if (existing?.paymentLinkId && existing?.paymentLinkUrl && existing.status === 'pending') {
      return res.json({ paymentLinkId: existing.paymentLinkId, shortUrl: existing.paymentLinkUrl, amount: 4900, currency: 'INR', appointmentId: String(appointmentId) })
    }

    const customer = { name: appointment.patientId.name }
    if (appointment.patientId.email) customer.email = appointment.patientId.email
    if (appointment.patientId.phone) customer.contact = appointment.patientId.phone
    const callbackOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5174').split(',')[0].trim()
    let paymentLink
    try {
      paymentLink = await razorpayClient().paymentLink.create({
        upi_link: true,
        amount: 4900,
        currency: 'INR',
        accept_partial: false,
        expire_by: Math.floor(Date.now() / 1000) + 30 * 60,
        reference_id: `med_${appointmentId}`.slice(0, 40),
        description: 'TeleWellness Meditation Session',
        customer,
        notify: { email: false, sms: false, whatsapp: false },
        reminder_enable: false,
        notes: {
          appointmentId: String(appointmentId),
          patientId: String(req.user._id),
          planId: 'meditation',
          planName: 'Meditation Session',
        },
        callback_url: `${callbackOrigin}/meditation?payment=return`,
        callback_method: 'get',
      })
    } catch (gatewayError) {
      const statusCode = gatewayError?.statusCode || gatewayError?.response?.status || null
      const message = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Razorpay could not create the Meditation payment link.'
      console.error('Razorpay meditation payment link creation failed:', { status: statusCode, error: String(message).slice(0, 300) })
      return res.status(502).json({ message: `Razorpay payment link creation failed: ${message}` })
    }
    await Payment.findOneAndUpdate(
      { appointmentId },
      {
        appointmentId,
        patientId: req.user._id,
        amount: 49,
        currency: 'INR',
        planId: 'meditation',
        planName: 'Meditation Session',
        status: 'pending',
        paymentLinkId: paymentLink.id,
        paymentLinkUrl: paymentLink.short_url,
        paymentId: undefined,
        signature: '',
        paymentDate: null,
        failureReason: '',
      },
      { upsert: true, new: true, runValidators: true },
    )
    res.status(201).json({ paymentLinkId: paymentLink.id, shortUrl: paymentLink.short_url, amount: 4900, currency: 'INR', appointmentId: String(appointmentId) })
  } catch (error) { next(error) }
})

router.post('/payment-link/basic/status', authenticate, async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return res.status(503).json({
        message: 'Payment verification is stopped until the Razorpay webhook secret is configured and signature verification is confirmed.',
        status: 'unpaid',
      })
    }
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const payment = await Payment.findOne({ appointmentId, patientId: req.user._id })
    if (!payment?.paymentLinkId) return res.json({ status: payment?.status === 'paid' ? 'paid' : 'unpaid', amount: 99 })
    if (payment.status === 'paid') return res.json({ status: 'paid', amount: payment.amount, paymentId: payment.paymentId, paymentDate: payment.paymentDate })

    const paymentLink = await razorpayClient().paymentLink.fetch(payment.paymentLinkId)
    if (paymentLink.status !== 'paid') return res.json({ status: payment.status, amount: payment.amount })
    const gatewayPayment = paymentLink.payments?.[0]
    if (!gatewayPayment) return res.json({ status: 'unpaid', amount: payment.amount })
    let captured
    try {
      captured = await razorpayClient().payments.fetch(gatewayPayment.id || gatewayPayment.payment_id || '')
    } catch (gatewayError) {
      const gatewayMessage = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Unable to verify payment.'
      console.error('Razorpay payment-link payment verification failed:', { status: gatewayError?.statusCode || null, error: String(gatewayMessage).slice(0, 300) })
      return res.status(502).json({ status: 'unpaid', message: 'Payment verification could not be completed.' })
    }
    if (
      captured.status !== 'captured' ||
      captured.amount !== 9900 ||
      captured.currency !== 'INR' ||
      captured.notes?.appointmentId !== String(appointmentId)
    ) {
      return res.json({ status: 'unpaid', amount: payment.amount })
    }
    payment.status = 'paid'
    payment.paymentId = captured.id
    payment.paymentDate = new Date((captured.created_at || Math.floor(Date.now() / 1000)) * 1000)
    payment.failureReason = ''
    await payment.save()
    res.json({ status: 'paid', amount: payment.amount, paymentId: payment.paymentId, paymentDate: payment.paymentDate })
  } catch (error) { next(error) }
})

router.post('/qr/status', authenticate, async (req, res, next) => {
  try {
    const { appointmentId } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    const payment = await Payment.findOne({ appointmentId, patientId: req.user._id })
    if (!payment) return res.json({ status: 'unpaid', amount: 99 })
    if (payment.status === 'paid') return res.json({ status: 'paid', amount: payment.amount, paymentId: payment.paymentId, paymentDate: payment.paymentDate })
    if (payment.status !== 'pending' || !payment.qrCodeId) return res.json({ status: payment.status })

    const razorpay = razorpayClient()
    const result = await razorpay.qrCode.fetchAllPayments(payment.qrCodeId, { count: 20 })
    const gatewayPayment = result.items?.find((item) =>
      item.status === 'captured' &&
      item.amount === Math.round(payment.amount * 100) &&
      item.currency === payment.currency &&
      item.qr_code_id === payment.qrCodeId
    )
    if (!gatewayPayment) return res.json({ status: 'unpaid', amount: payment.amount })
    let captured
    try {
      captured = await razorpay.payments.fetch(gatewayPayment.id)
    } catch (gatewayError) {
      const statusCode = gatewayError?.statusCode || gatewayError?.response?.status || null
      const sanitizedError = gatewayError?.error?.description || gatewayError?.description || gatewayError?.message || 'Unable to verify captured payment.'
      console.error('Razorpay payment verification failed:', { status: statusCode, error: String(sanitizedError).slice(0, 300) })
      return res.status(502).json({ status: 'unpaid', message: 'Payment verification could not be completed.' })
    }
    if (
      captured.status !== 'captured' ||
      captured.amount !== 9900 ||
      captured.currency !== 'INR' ||
      captured.qr_code_id !== payment.qrCodeId
    ) {
      return res.json({ status: 'unpaid', amount: payment.amount })
    }
    payment.status = 'paid'
    payment.paymentId = captured.id
    payment.paymentDate = new Date(captured.created_at * 1000 || Date.now())
    payment.failureReason = ''
    await payment.save()
    res.json({ status: 'paid', amount: payment.amount, paymentId: payment.paymentId, paymentDate: payment.paymentDate })
  } catch (error) { next(error) }
})

router.post('/verify', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can verify payments.' })
    const { appointmentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body
    if (!mongoose.isValidObjectId(appointmentId) || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Incomplete payment verification data.' })
    }
    const payment = await Payment.findOne({ appointmentId, patientId: req.user._id, orderId: razorpay_order_id })
    if (!payment) return res.status(404).json({ message: 'Payment order not found.' })
    if (payment.status === 'paid') {
      return res.json({ status: 'paid', paymentId: payment.paymentId, paymentDate: payment.paymentDate })
    }

    const razorpay = razorpayClient()
    const valid = razorpay.utility.verifyPaymentSignature({
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      signature: razorpay_signature,
    })
    if (!valid) {
      payment.status = 'failed'
      payment.failureReason = 'Signature verification failed'
      await payment.save()
      return res.status(400).json({ message: 'Payment verification failed.' })
    }

    const gatewayPayment = await razorpay.payments.fetch(razorpay_payment_id)
    const expectedAmount = Math.round(payment.amount * 100)
    if (
      gatewayPayment.order_id !== razorpay_order_id ||
      gatewayPayment.amount !== expectedAmount ||
      gatewayPayment.currency !== payment.currency ||
      gatewayPayment.status !== 'captured'
    ) {
      payment.status = gatewayPayment.status === 'failed' ? 'failed' : 'pending'
      if (gatewayPayment.status === 'failed') payment.failureReason = gatewayPayment.error_description || 'Payment failed'
      await payment.save()
      return res.status(402).json({ message: 'Payment was not successfully captured.' })
    }

    payment.status = 'paid'
    payment.paymentId = razorpay_payment_id
    payment.signature = razorpay_signature
    payment.paymentDate = new Date()
    payment.failureReason = ''
    await payment.save()
    res.json({ status: 'paid', paymentId: payment.paymentId, paymentDate: payment.paymentDate })
  } catch (error) { next(error) }
})

router.post('/failure', authenticate, async (req, res, next) => {
  try {
    const { appointmentId, reason = 'Payment cancelled or failed', status = 'cancelled' } = req.body
    if (!mongoose.isValidObjectId(appointmentId)) return res.status(400).json({ message: 'Invalid appointment.' })
    if (!['failed', 'cancelled'].includes(status)) return res.status(400).json({ message: 'Invalid payment outcome.' })
    const payment = await Payment.findOneAndUpdate(
      { appointmentId, patientId: req.user._id, status: { $ne: 'paid' } },
      { status, failureReason: String(reason).slice(0, 500) },
      { new: true },
    )
    res.json({ status: payment?.status || 'unpaid' })
  } catch (error) { next(error) }
})

router.get('/:appointmentId', authenticate, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.appointmentId)) return res.status(404).json({ message: 'Payment not found.' })
    const payment = await Payment.findOne({ appointmentId: req.params.appointmentId })
    if (!payment) return res.json({ status: 'unpaid', amount: null, paymentId: null, paymentDate: null })
    if (req.user.role !== 'admin' && !payment.patientId.equals(req.user._id)) return res.status(403).json({ message: 'Payment not accessible.' })
    res.json({
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      paymentId: payment.paymentId,
      paymentDate: payment.paymentDate,
      transactionId: payment.paymentId,
      planId: payment.planId,
      planName: payment.planName,
    })
  } catch (error) { next(error) }
})

export async function webhookHandler(req, res) {
  const signature = req.get('x-razorpay-signature') || ''
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) return res.status(503).json({ message: 'Webhook secret is not configured.' })
  const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex')
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(400).json({ message: 'Invalid webhook signature.' })
  }
  try {
    const event = JSON.parse(req.body.toString())
    const entity = event.payload?.payment?.entity || event.payload?.refund?.entity
    if (!entity) return res.json({ received: true })
    if (event.event?.startsWith('refund.')) {
      if (!entity.payment_id) return res.json({ received: true })
      const payment = await Payment.findOne({ paymentId: entity.payment_id })
      if (!payment || payment.status === 'refunded') return res.json({ received: true })
      payment.status = 'refunded'
      payment.failureReason = 'Payment refunded by Razorpay'
      await payment.save()
      return res.json({ received: true })
    }
    const noteAppointmentId = entity.notes?.appointmentId
    const paymentLinkId = entity.payment_link_id || null
    if (noteAppointmentId && !mongoose.isValidObjectId(noteAppointmentId)) return res.json({ received: true })
    const qrFilter = entity.qr_code_id ? { qrCodeId: entity.qr_code_id } : null
    const payment = qrFilter
      ? await Payment.findOne(qrFilter)
      : paymentLinkId
        ? await Payment.findOne({ paymentLinkId })
        : noteAppointmentId
        ? await Payment.findOne({ appointmentId: noteAppointmentId, orderId: entity.order_id || '' })
        : await Payment.findOne({ orderId: entity.order_id || '' })
    if (!payment || payment.status === 'paid') return res.json({ received: true })
    if (noteAppointmentId && String(payment.appointmentId) !== String(noteAppointmentId)) return res.json({ received: true })
    if (entity.amount !== Math.round(payment.amount * 100) || entity.currency !== payment.currency) {
      payment.status = 'failed'
      payment.failureReason = 'Webhook payment amount or currency did not match the server payment record.'
      await payment.save()
      return res.json({ received: true })
    }
    if (event.event === 'payment.captured') {
      payment.status = 'paid'
      payment.paymentId = entity.id
      payment.paymentDate = new Date()
      payment.failureReason = ''
    } else if (event.event === 'payment.failed') {
      payment.status = 'failed'
      payment.failureReason = entity.error_description || 'Payment failed'
    }
    await payment.save()
    return res.json({ received: true })
  } catch (error) {
    console.error('Razorpay webhook error:', error)
    return res.status(500).json({ message: 'Webhook processing failed.' })
  }
}

export default router
