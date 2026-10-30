import mongoose from 'mongoose'

const appointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true, trim: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'], default: 'pending' },
  consultationType: { type: String, enum: ['video', 'audio'], default: 'video' },
  planId: { type: String, trim: true, default: '' },
  planName: { type: String, trim: true, default: '' },
  planPrice: { type: Number, min: 1, default: null },
  planDuration: { type: Number, min: 1, default: null },
}, { timestamps: true })

export default mongoose.model('Appointment', appointmentSchema)