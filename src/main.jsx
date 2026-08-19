import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { SessionProvider } from './session.jsx'
import { DataProvider } from './data/store.jsx'
import './index.css'

// SessionProvider (auth) wraps DataProvider (which hydrates from Supabase once the
// user is authenticated), which wraps the routed App.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </SessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
