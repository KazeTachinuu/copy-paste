import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const kvStatus = await kv.ping();

    return res.status(200).json({
      status: 'ok',
      kv: kvStatus === 'PONG' ? 'connected' : 'disconnected',
      env: {
        hasKvUrl: !!process.env.KV_REST_API_URL,
        hasKvToken: !!process.env.KV_REST_API_TOKEN,
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      kv: 'disconnected',
      env: {
        hasKvUrl: !!process.env.KV_REST_API_URL,
        hasKvToken: !!process.env.KV_REST_API_TOKEN,
      }
    });
  }
}
