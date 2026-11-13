import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/app.css'
import './styles/desktop.css'
import App from './App'
import './ui/install'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
