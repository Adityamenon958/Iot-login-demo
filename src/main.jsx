import 'bootstrap/dist/css/bootstrap.min.css';
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap-icons/font/bootstrap-icons.css';

createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId="952065190542-oc6u0e06du5u5iombq8pj3tk0lco5nmv.apps.googleusercontent.com">
  <StrictMode>
  <BrowserRouter>
        <App />
      </BrowserRouter>
  </StrictMode>
  </GoogleOAuthProvider>
)
