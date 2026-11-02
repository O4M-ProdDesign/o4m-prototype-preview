import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import '@fontsource-variable/inter'
import '@material-symbols/font-400/rounded.css'

window.React = React
window.ReactDOM = { createRoot: ReactDOM.createRoot }
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
