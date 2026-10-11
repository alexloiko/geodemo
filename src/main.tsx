import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initPersistence } from './persist/persist'
import { useStore } from './store/store'

initPersistence()

// Handy for debugging and browser checks during development.
if (import.meta.env.DEV) (window as unknown as { geodemo: unknown }).geodemo = { useStore }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
