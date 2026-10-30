import { Router } from 'express'
import { consultationPlans } from './appointments.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(Object.values(consultationPlans))
})

export default router
