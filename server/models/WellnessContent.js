import mongoose from 'mongoose'

const wellnessContentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, required: true, trim: true, maxlength: 2500 },
  category: { type: String, required: true, enum: ['Nutrition', 'Yoga', 'Meditation', 'Exercise'] },
  videoUrl: { type: String, trim: true, default: '' },
  imageUrl: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.model('WellnessContent', wellnessContentSchema)