import 'dotenv/config'
import http from 'node:http'
import bcrypt from 'bcryptjs'
import cors from 'cors'
import express from 'express'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { connectDatabase } from './config/database.js'
import Appointment from './models/Appointment.js'
import Professional from './models/Professional.js'
import User from './models/User.js'
import Payment from './models/Payment.js'
import authRoutes from './routes/auth.js'
import professionalRoutes from './routes/professionals.js'
import appointmentRoutes from './routes/appointments.js'
import consultationRoutes from './routes/consultations.js'
import wellnessRoutes from './routes/wellness.js'
import adminRoutes from './routes/admin.js'
import paymentRoutes, { webhookHandler } from './routes/payments.js'
import feeRoutes from './routes/fees.js'

const app = express()
const server = http.createServer(app)
const allowedOrigins = new Set(
  (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.has(origin)) return callback(null, true)
  return callback(new Error('Origin not allowed by CORS'))
}
const io = new Server(server, { cors: { origin: corsOrigin, methods: ['GET', 'POST'] } })

app.use(cors({ origin: corsOrigin }))
app.post('/api/payments/webhook', express.raw({ type: 'application/json', limit: '100kb' }), webhookHandler)
app.use(express.json({ limit: '100kb' }))
app.get('/api/health', (_req, res) => res.json({ ok: true, database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || mongoose.connection.readyState === 1) return next()
  return res.status(503).json({ message: 'The database is unavailable. Configure MONGODB_URI and start MongoDB.' })
})
app.use('/api/auth', authRoutes)
app.use('/api/professionals', professionalRoutes)
app.use('/api/appointments', appointmentRoutes)
app.use('/api/consultations', consultationRoutes)
app.use('/api/wellness', wellnessRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/fees', feeRoutes)
app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` }))
app.use((error, _req, res, _next) => {
  console.error(error)
  const status = error.name === 'ValidationError' ? 400 : error.name === 'CastError' ? 400 : 500
  res.status(status).json({ message: status === 500 ? 'An unexpected server error occurred.' : error.message })
})

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token
    if (!token || !process.env.JWT_SECRET) return next(new Error('Authentication required'))
    socket.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch { next(new Error('Invalid session')) }
})

io.on('connection', (socket) => {
  socket.on('consultation:join', async ({ appointmentId } = {}) => {
    try {
      if (!mongoose.isValidObjectId(appointmentId)) return socket.emit('consultation:error', { message: 'Invalid appointment.' })
      const appointment = await Appointment.findById(appointmentId)
      if (!appointment) return socket.emit('consultation:error', { message: 'Appointment not found.' })
      const user = await User.findById(socket.user.id)
      const profile = user?.role === 'professional' ? await Professional.findOne({ userId: user._id }) : null
      const authorized = appointment.patientId.equals(user?._id) || (profile && appointment.professionalId.equals(profile._id))
      if (!authorized || appointment.status !== 'accepted') return socket.emit('consultation:error', { message: 'You are not an active participant in this consultation.' })
      const payment = await Payment.findOne({ appointmentId: appointment._id, status: 'paid' })
      if (!payment) return socket.emit('consultation:error', { message: 'Payment verification is required before joining this consultation.' })
      const start = new Date(appointment.date)
      const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(appointment.time)
      if (timeMatch) start.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0)
      const windowStart = new Date(start.getTime() - 15 * 60 * 1000)
      const windowEnd = new Date(start.getTime() + (appointment.planDuration || 15) * 60 * 1000 + 15 * 60 * 1000)
      const now = new Date()
      if (now < windowStart || now > windowEnd) return socket.emit('consultation:error', { message: 'The consultation room is not open at this time.' })
      const room = `consultation:${appointmentId}`
      const existingCount = io.sockets.adapter.rooms.get(room)?.size || 0
      await socket.join(room)
      if (existingCount > 0) {
        socket.emit('consultation:peer', { initiator: false })
        socket.to(room).emit('consultation:peer', { initiator: true })
      }
    } catch (error) { console.error(error); socket.emit('consultation:error', { message: 'Unable to join this consultation.' }) }
  })
  socket.on('webrtc:signal', ({ appointmentId, signal } = {}) => {
    if (!mongoose.isValidObjectId(appointmentId) || !socket.rooms.has(`consultation:${appointmentId}`) || !signal || !['description', 'candidate'].some((key) => key in signal)) return
    socket.to(`consultation:${appointmentId}`).emit('webrtc:signal', { signal })
  })
  socket.on('consultation:end', ({ appointmentId } = {}) => {
    if (!mongoose.isValidObjectId(appointmentId) || !socket.rooms.has(`consultation:${appointmentId}`)) return
    socket.to(`consultation:${appointmentId}`).emit('consultation:ended', { appointmentId })
    socket.leave(`consultation:${appointmentId}`)
  })
  socket.on('consultation:leave', ({ appointmentId } = {}) => {
    if (!mongoose.isValidObjectId(appointmentId) || !socket.rooms.has(`consultation:${appointmentId}`)) return
    socket.leave(`consultation:${appointmentId}`)
  })
})

async function createConfiguredAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) return
  const email = ADMIN_EMAIL.toLowerCase().trim()
  const existing = await User.findOne({ email })
  if (existing) {
    if (existing.role !== 'admin') console.warn('ADMIN_EMAIL is already registered to a non-admin account; no role was changed.')
    return
  }
  await User.create({ name: 'TeleWellness Admin', email, password: ADMIN_PASSWORD, role: 'admin' })
  console.log(`Created configured administrator: ${email}`)
}

const port = Number(process.env.PORT) || 5001
try {
  const connected = await connectDatabase()
  if (connected) await createConfiguredAdmin()
} catch (error) {
  console.error('MongoDB connection failed:', error.message)
}
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Stop the existing process or change PORT in server/.env.`)
    process.exitCode = 1
    return
  }
  console.error('TeleWellness server startup failed:', error.message)
  process.exitCode = 1
})
server.listen(port, () => console.log(`TeleWellness API listening on port ${port}`))