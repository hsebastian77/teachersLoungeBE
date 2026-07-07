import express from 'express';
import cors from 'cors';
import router from './routes.js';
import twoFactorRoutes from './twoFactor.js';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();

const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const defaultAllowedOrigins = [
    'http://localhost:19006',
    'http://localhost:3000',
    'http://localhost:8081',
    'exp://127.0.0.1:8081',
];

const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins;
const corsOptions = {
    origin(origin, callback) {
        // Allow non-browser clients and same-origin requests with no Origin header.
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Origin not allowed by CORS policy'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(router);
app.use('/2fa', twoFactorRoutes);
app.use('/api/auth', twoFactorRoutes);

// Global error handler to prevent server crashes
app.use((err, req, res, next) => {
    console.error('Global error handler caught:', err);
    if (!res.headersSent) {
        res.status(500).json({ 
            message: 'Internal server error', 
            error: err.message 
        });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    // Don't exit the process, just log the error
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit the process, just log the error
});

export default app;
