const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PAYMENT_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Serve the main product gallery page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'product-gallery.html'));
});

// Serve the original payment page
app.get('/checkout', (req, res) => {
    res.sendFile(path.join(__dirname, 'paypal_sandbox_checkout.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Payment server is running',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Cart management endpoints
app.get('/api/cart', (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Cart data is managed client-side with localStorage'
        }
    });
});

// Product catalog endpoint
app.get('/api/products', (req, res) => {
    const products = [
        {
            id: 1,
            name: "Wireless Headphones",
            description: "Premium quality wireless headphones with noise cancellation and 30-hour battery life.",
            price: 199.99,
            emoji: "🎧"
        },
        {
            id: 2,
            name: "Smart Watch",
            description: "Advanced fitness tracking, heart rate monitoring, and smartphone connectivity.",
            price: 299.99,
            emoji: "⌚"
        },
        {
            id: 3,
            name: "Bluetooth Speaker",
            description: "Portable speaker with 360-degree sound and waterproof design.",
            price: 89.99,
            emoji: "🔊"
        },
        {
            id: 4,
            name: "Phone Case",
            description: "Protective case with wireless charging compatibility and drop protection.",
            price: 39.99,
            emoji: "📱"
        },
        {
            id: 5,
            name: "Laptop Stand",
            description: "Adjustable aluminum laptop stand for better ergonomics and cooling.",
            price: 79.99,
            emoji: "💻"
        },
        {
            id: 6,
            name: "USB-C Hub",
            description: "Multi-port hub with HDMI, USB-A, and SD card reader for laptops.",
            price: 59.99,
            emoji: "🔌"
        }
    ];
    
    res.json({
        success: true,
        data: products
    });
});

// API proxy to main server (optional - for development)
app.use('/api', (req, res) => {
    const fetch = require('node-fetch');
    const mainServerUrl = 'http://localhost:5000';
    
    fetch(`${mainServerUrl}${req.originalUrl}`, {
        method: req.method,
        headers: {
            'Content-Type': 'application/json',
            ...req.headers
        },
        body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    })
    .then(response => response.json())
    .then(data => res.json(data))
    .catch(error => {
        console.error('Proxy error:', error);
        res.status(500).json({
            success: false,
            message: 'Main server is not available'
        });
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Payment server error:', error);
    res.status(500).json({
        success: false,
        message: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint not found'
    });
});

app.listen(PORT, () => {
    console.log(`💳 Payment server running on port ${PORT}`);
    console.log(`🛍️ Product Gallery: http://localhost:${PORT}`);
    console.log(`💳 Direct Checkout: http://localhost:${PORT}/checkout`);
    console.log(`📱 Make sure your main server is running on port 5000`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
    console.log(`📦 Products API: http://localhost:${PORT}/api/products`);
});

module.exports = app;
