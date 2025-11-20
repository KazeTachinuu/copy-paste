import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { createPaste, getPaste, listPastes } from './store.js';
import { rateLimiter } from './middleware/rateLimiter.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Configure CORS to expose Retry-After header
app.use(cors({
    exposedHeaders: ['Retry-After']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(rateLimiter);

/**
 * POST /api/paste
 * Create a new paste with text and/or image
 */
app.post('/api/paste', (req, res) => {
    try {
        const { text, image } = req.body;

        if (!text && !image) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const result = createPaste(req.body);
        res.json(result);
    } catch (error) {
        console.error('Error creating paste:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/paste/:code
 * Retrieve a paste by its code
 */
app.get('/api/paste/:code', (req, res) => {
    try {
        const { code } = req.params;
        const paste = getPaste(code);

        if (!paste) {
            return res.status(404).json({ error: 'Paste not found or expired' });
        }

        res.json({
            text: paste.text,
            image: paste.image
        });
    } catch (error) {
        console.error('Error retrieving paste:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /list & /api/list
 * List all active paste codes (JSON format)
 */
const listHandler = (req, res) => {
    try {
        const pastes = listPastes();
        res.json({
            count: pastes.length,
            pastes
        });
    } catch (error) {
        console.error('Error listing pastes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

app.get('/list', listHandler);
app.get('/api/list', listHandler);

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
