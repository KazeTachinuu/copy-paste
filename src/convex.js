import { ConvexClient } from "convex/browser";

// Initialize Convex client with deployment URL from environment
const convexUrl = import.meta.env.VITE_CONVEX_URL;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL environment variable is not set");
}

export const convex = new ConvexClient(convexUrl);
