import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { PostHogProvider } from './contexts/PostHogContext'
import { UserProvider } from './contexts/UserContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PostHogProvider>
        <UserProvider>
          <App />
        </UserProvider>
      </PostHogProvider>
    </BrowserRouter>
  </StrictMode>
)
