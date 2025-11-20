# CopyPaste - Simple Cross-Device Copying

A lightweight web application for temporarily sharing text and images across devices using simple numeric codes.

## Features

- 📝 Share text content across devices
- 🖼️ Share images (up to 10MB)
- 🔢 Simple 4-digit numeric codes
- ⏱️ Automatic expiration (10 minutes)
- 🌓 Dark/Light theme support
- 📱 Responsive design
- 🔒 Secure with input validation and sanitization

## Tech Stack

- **Frontend**: Vanilla JavaScript, Vite
- **Backend**: Vercel Serverless Functions
- **Storage**: Vercel KV (Redis)
- **Validation**: Joi
- **Security**: Helmet, CORS, DOMPurify

## Local Development

### Prerequisites

- Node.js 18+ or Bun
- Vercel account (for KV storage)

### Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd copy-paste
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or with npm
   npm install
   ```

3. **Set up Vercel KV (Required)**

   The application requires Vercel KV for storage. Follow these steps:

   a. Create a KV store:
   - Go to https://vercel.com/dashboard/stores
   - Click "Create Database"
   - Select "KV" (Redis)
   - Name your store (e.g., "copy-paste-kv")
   - Choose a region close to your users

   b. Link to your project:
   ```bash
   # Install Vercel CLI if you haven't (use bun or npm)
   bun add -g vercel
   # or: npm i -g vercel

   # Link your project
   vercel link

   # Pull environment variables (includes KV credentials)
   vercel env pull .env.local
   ```

   This will create `.env.local` with the required KV credentials:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

4. **Configure environment variables**

   Copy `.env.example` to `.env` and update if needed:
   ```bash
   cp .env.example .env
   ```

5. **Run development server**
   ```bash
   bun run dev
   # or with npm
   npm run dev
   ```

   This starts:
   - Frontend dev server on http://localhost:5173
   - Backend Express server on http://localhost:3000

## Deployment to Vercel

### Prerequisites

- Vercel account
- Vercel CLI installed (`bun add -g vercel` or `npm i -g vercel`)

### Deployment Steps

1. **Create a Vercel KV store** (if not already done)
   - Go to https://vercel.com/dashboard/stores
   - Create a new KV store

2. **Deploy to Vercel**
   ```bash
   vercel
   ```

3. **Connect KV store to your project**
   - Go to your project settings in Vercel dashboard
   - Navigate to "Storage" tab
   - Connect your KV store to the project

4. **Set environment variables**
   - Go to Project Settings → Environment Variables
   - Add `ALLOWED_ORIGINS` with your production domain:
     ```
     https://your-domain.vercel.app
     ```

5. **Deploy to production**
   ```bash
   vercel --prod
   ```

### Automatic Deployments

Once connected to a Git repository, Vercel will automatically:
- Deploy on every push to main branch
- Create preview deployments for pull requests

## Architecture

### Storage

The application uses **Vercel KV (Redis)** for ephemeral data storage:

- **Why Redis?** Built-in TTL (Time To Live) support, perfect for temporary data
- **Auto-expiration**: Pastes automatically expire after 10 minutes
- **Serverless-compatible**: Works seamlessly with Vercel's serverless architecture
- **No manual cleanup**: Redis handles expiration automatically

### API Routes

All API routes are serverless functions in the `/api` directory:

- `POST /api/paste` - Create a new paste
- `GET /api/paste/:code` - Retrieve a paste by code
- `GET /api/health` - Health check endpoint

### Frontend

- Built with Vite for fast development and optimized production builds
- Client-side storage uses localStorage to track user's active codes
- No backend API needed for the `/list` page - purely client-side

## Project Structure

```
copy-paste/
├── api/                    # Vercel serverless functions
│   ├── health.js          # Health check endpoint
│   └── paste/
│       └── index.js       # Paste CRUD operations
├── config/
│   └── constants.js       # Shared constants
├── server/                # Local development server (not used in production)
│   ├── index.js
│   ├── store.js          # KV storage abstraction
│   └── middleware/
│       └── rateLimiter.js
├── src/                   # Frontend source
│   ├── main.js
│   ├── api.js
│   ├── ui.js
│   ├── storage.js        # Client-side localStorage
│   ├── theme.js
│   └── list.js
├── index.html
├── list.html
├── vercel.json           # Vercel configuration
└── package.json
```

## Configuration

### Constants (`config/constants.js`)

```javascript
export const PASTE = {
  CODE_LENGTH: 4,              // 4-digit codes
  MAX_IMAGE_SIZE: 10 * 1024 * 1024,  // 10MB
  EXPIRATION_MS: 10 * 60 * 1000,     // 10 minutes
};
```

### Environment Variables

See `.env.example` for all available configuration options.

## Security

- ✅ Input validation with Joi
- ✅ XSS prevention with DOMPurify
- ✅ CORS protection
- ✅ Security headers (Helmet)
- ✅ Content Security Policy
- ✅ Rate limiting (via Vercel)
- ✅ Image size limits
- ✅ Automatic expiration

## API Usage

### Create Paste

```bash
curl -X POST https://your-domain.vercel.app/api/paste \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello World",
    "image": null
  }'
```

Response:
```json
{
  "code": "1234",
  "expiresAt": 1234567890000
}
```

### Get Paste

```bash
curl https://your-domain.vercel.app/api/paste/1234
```

Response:
```json
{
  "text": "Hello World",
  "image": null,
  "expiresAt": 1234567890000
}
```

## Troubleshooting

### "Failed to generate unique code"
- This happens when the KV store has many active codes
- Codes expire after 10 minutes automatically

### "Internal server error" on paste creation
- Check if Vercel KV is properly connected
- Verify environment variables are set
- Check Vercel function logs

### CORS errors
- Verify `ALLOWED_ORIGINS` environment variable is set correctly
- Ensure it matches your frontend domain exactly

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with Vercel KV
5. Submit a pull request

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
