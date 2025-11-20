import 'dotenv/config';
import { createPaste, getPaste } from '../../lib/store.js';
import { PASTE } from '../../config/constants.js';

function setCorsHeaders(res, origin) {
  const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [];
  const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';

  if (IS_DEVELOPMENT && origin && /^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer;
  setCorsHeaders(res, origin);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { text, customCode } = req.body;

      // Basic validation
      if (!text?.trim()) {
        return res.status(400).json({
          error: 'Text required'
        });
      }

      if (customCode && !/^\d{5}$/.test(customCode)) {
        return res.status(400).json({
          error: 'Custom code must be 5 digits'
        });
      }

      const result = await createPaste({ text, customCode });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error creating paste:', error);

      if (error.message?.includes('KV not configured')) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          details: 'Database connection not configured. Please contact support.'
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  if (req.method === 'GET') {
    try {
      const code = req.query.code || req.url.split('/').pop();

      if (!code || code === 'paste') {
        return res.status(400).json({ error: 'Code is required' });
      }

      const paste = await getPaste(code);

      if (!paste) {
        return res.status(404).json({ error: 'Paste not found or expired' });
      }

      return res.status(200).json({
        text: paste.text,
        expiresAt: paste.expiresAt
      });
    } catch (error) {
      console.error('Error retrieving paste:', error);

      if (error.message?.includes('KV not configured')) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          details: 'Database connection not configured. Please contact support.'
        });
      }

      return res.status(500).json({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
