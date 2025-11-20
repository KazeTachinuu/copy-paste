import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import Joi from 'joi';
import { createPaste, getPaste } from '../lib/store.js';
import { PASTE } from '../config/constants.js';

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    // In development, allow all localhost origins
    if (IS_DEVELOPMENT && /^http:\/\/localhost(:\d+)?$/.test(origin)) return callback(null, true);

    // In production or if configured, check allowed origins
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS.includes(origin)) return callback(null, true);

    // If in development and no specific origins configured, allow all
    if (IS_DEVELOPMENT && ALLOWED_ORIGINS.length === 0) return callback(null, true);

    callback(new Error('Not allowed by CORS'));
  },
  exposedHeaders: ['Retry-After']
}));

app.use(express.json({ limit: '10mb' }));

const pasteSchema = Joi.object({
  text: Joi.string().max(100000).required(),
  customCode: Joi.string().pattern(/^\d{5}$/).allow(null),
}).messages({
  'string.empty': 'Text is required'
});

app.post('/api/paste', async (req, res) => {
  try {
    const { error, value } = pasteSchema.validate(req.body);

    if (error) {
      return res.status(400).json({
        error: 'Invalid input',
        details: error.details[0].message
      });
    }

    const { text, customCode } = value;

    const result = await createPaste({ text, customCode });
    res.json(result);
  } catch (error) {
    console.error('Error creating paste:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/paste/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const paste = await getPaste(code);

    if (!paste) {
      return res.status(404).json({ error: 'Paste not found or expired' });
    }

    res.json({
      text: paste.text,
      expiresAt: paste.expiresAt
    });
  } catch (error) {
    console.error('Error retrieving paste:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
