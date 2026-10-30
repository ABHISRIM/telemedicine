import { Router } from 'express'
import WellnessContent from '../models/WellnessContent.js'

const router = Router()
const validCategories = ['Nutrition', 'Yoga', 'Meditation', 'Exercise']

router.get('/', async (_req, res, next) => {
  try { res.json(await WellnessContent.find({ active: true }).sort({ createdAt: -1 })) } catch (error) { next(error) }
})

router.get('/:category', async (req, res, next) => {
  try {
    const category = validCategories.find((item) => item.toLowerCase() === req.params.category.toLowerCase())
    if (!category) return res.status(400).json({ message: 'Choose Nutrition, Yoga, Meditation, or Exercise.' })
    res.json(await WellnessContent.find({ category, active: true }).sort({ createdAt: -1 }))
  } catch (error) { next(error) }
})

export default router