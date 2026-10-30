import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './telewellness.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
