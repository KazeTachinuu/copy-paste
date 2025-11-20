import 'dotenv/config';
import Joi from 'joi';
import { createPaste, getPaste } from '../../server/store.js';
import { PASTE, IMAGE_DATA_URL_REGEX } from '../../config/constants.js';

const pasteSchema = Joi.object({
  text: Joi.string().max(100000).allow(null),
  image: Joi.string().pattern(IMAGE_DATA_URL_REGEX).allow(null),
}).or('text', 'image').messages({
  'object.missing': 'At least one of "text" or "image" must be provided and non-empty'
});

function validateImageSize(base64String) {
  if (!base64String) return true;
  const base64Data = base64String.split(',')[1];
  if (!base64Data) return false;
  const padding = (base64Data.match(/=/g) || []).length;
  const sizeInBytes = ((base64Data.length - padding) * 3) / 4;
  return sizeInBytes <= PASTE.MAX_IMAGE_SIZE;
}

// CORS helper
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

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST /api/paste - Create paste
  if (req.method === 'POST') {
    try {
      const { error, value } = pasteSchema.validate(req.body);

      if (error) {
        return res.status(400).json({
          error: 'Invalid input',
          details: error.details[0].message
        });
      }

      const { text, image } = value;

      if (image && !validateImageSize(image)) {
        return res.status(413).json({
          error: `Image too large. Maximum size is ${PASTE.MAX_IMAGE_SIZE / 1024 / 1024}MB`
        });
      }

      const result = createPaste({ text, image });
      return res.status(200).json(result);
    } catch (error) {
      console.error('Error creating paste:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // GET /api/paste?code=XXXX or /api/paste/XXXX - Get paste
  if (req.method === 'GET') {
    try {
      // Support both query param and path param
      const code = req.query.code || req.url.split('/').pop();

      if (!code || code === 'paste') {
        return res.status(400).json({ error: 'Code is required' });
      }

      const paste = getPaste(code);

      if (!paste) {
        return res.status(404).json({ error: 'Paste not found or expired' });
      }

      return res.status(200).json({
        text: paste.text,
        image: paste.image,
        expiresAt: paste.expiresAt
      });
    } catch (error) {
      console.error('Error retrieving paste:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
