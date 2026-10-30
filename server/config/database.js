import mongoose from 'mongoose'

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    console.warn('MONGODB_URI is not set. API persistence is disabled; frontend demo mode remains available.')
    return false
  }
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to MongoDB')
  return true
}