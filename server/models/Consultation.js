import mongoose from 'mongoose'

const consultationSchema = new mongoose.Schema({
  appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, unique: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  professionalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Professional', required: true },
  notes: { type: String, trim: true, maxlength: 5000, default: '' },
  guidance: { type: String, trim: true, maxlength: 5000, default: '' },
  recommendedCategories: [{ type: String, enum: ['Nutrition', 'Yoga', 'Meditation', 'Exercise'] }],
}, { timestamps: true })

export default mongoose.model('Consultation', consultationSchema)