import mongoose from 'mongoose'

const professionalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialty: { type: String, required: true, trim: true, maxlength: 100 },
  bio: { type: String, trim: true, maxlength: 2000, default: '' },
  experience: { type: String, trim: true, maxlength: 50, default: '' },
  languages: { type: [String], default: ['English'] },
  consultationFee: { type: Number, default: 500, min: 1 },
  acceptingAppointments: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('Professional', professionalSchema)