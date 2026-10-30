import mongoose from 'mongoose'

const paymentSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true, index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1 },
  currency: { type: String, default: 'INR', enum: ['INR'] },
  planId: { type: String, default: '' },
  planName: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'refunded'], default: 'pending', index: true },
  orderId: { type: String, unique: true, sparse: true, index: true },
  paymentLinkId: { type: String, unique: true, sparse: true, index: true },
  paymentLinkUrl: { type: String, default: '' },
  qrCodeId: { type: String, unique: true, sparse: true, index: true },
  qrImageUrl: { type: String, default: '' },
  paymentId: { type: String, sparse: true, index: true },
  signature: { type: String, default: '' },
  paymentDate: { type: Date, default: null },
  failureReason: { type: String, default: '' },
}, { timestamps: true })

export default mongoose.model('Payment', paymentSchema)
