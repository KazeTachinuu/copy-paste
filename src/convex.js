import { ConvexClient } from "convex/browser";

// Initialize Convex client with deployment URL from environment
const convexUrl = import.meta.env.VITE_CONVEX_URL;

// Validate environment variable is set
if (!convexUrl) {
  throw new Error(
    "VITE_CONVEX_URL environment variable is not set. " +
    "Check your .env file or deployment settings."
  );
}

// Validate URL format
if (!/^https:\/\/.+\.convex\.(cloud|site)$/.test(convexUrl)) {
  throw new Error(
    `Invalid VITE_CONVEX_URL format: ${convexUrl}\n` +
    "Expected: https://your-deployment.convex.cloud or https://your-deployment.convex.site"
  );
}

// Warn if using production URL in development
if (import.meta.env.DEV && convexUrl.includes('.convex.cloud')) {
  console.warn(
    '⚠️  Using production Convex URL in development mode!\n' +
    'Consider using a separate development deployment.'
  );
}

export const convex = new ConvexClient(convexUrl);
