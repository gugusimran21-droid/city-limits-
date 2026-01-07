import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme-ryb.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { CartProvider } from './CartContext/CartContext'

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <CartProvider>
            <App />
        </CartProvider>
    </BrowserRouter>
)
