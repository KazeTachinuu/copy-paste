import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { rateLimit } from "convex-helpers/server/rateLimit";

const QUICK_PASTE_EXPIRY = 15 * 60 * 1000; // 15 minutes
const SESSION_PASTE_EXPIRY = 60 * 60 * 1000; // 1 hour
const CODE_LENGTH = 4;
const SESSION_CODE_LENGTH = 5;
const MAX_TEXT_LENGTH = 100000;
const MINUTE = 60 * 1000;

// Per-client rate limit: 10 pastes/min sustained, can burst up to 15
// Session mode averages ~1 paste/min (debounced), so this is generous for normal use
const PER_CLIENT_RATE_LIMIT = {
  kind: "token bucket" as const,
  rate: 10,
  period: MINUTE,
  capacity: 15,
};

// Global rate limit: 500 pastes/min sustained, can burst up to 750
// This is very generous for normal usage - hitting this limit indicates a DDoS attack
// NOTE: Monitor the rateLimits table for "createPaste:global" - set up alerts if sustained >100/min
const GLOBAL_RATE_LIMIT = {
  kind: "token bucket" as const,
  rate: 500,
  period: MINUTE,
  capacity: 750,
};

function generateCode(length: number): string {
  const chars = '23456789ACDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomValue = crypto.getRandomValues(new Uint32Array(1))[0];
    code += chars[randomValue % chars.length];
  }
  return code;
}

async function findPasteByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<"pastes"> | null> {
  return await ctx.db
    .query("pastes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
}

export const createPaste = mutation({
  args: {
    text: v.string(),
    customCode: v.optional(v.string()),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, { text, customCode, clientId }) => {
    if (!text.trim()) throw new Error("Text is required");
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
    }

    console.log("createPaste called with clientId:", clientId);

    // Apply global rate limit first (protects against distributed attacks)
    await rateLimit(ctx, {
      name: "createPaste:global",
      throws: true,
      config: GLOBAL_RATE_LIMIT,
    });

    // Apply per-client rate limit (if clientId provided)
    if (clientId) {
      console.log("Applying per-client rate limit for:", clientId);
      await rateLimit(ctx, {
        name: "createPaste:client",
        key: clientId,
        throws: true,
        config: PER_CLIENT_RATE_LIMIT,
      });
    } else {
      console.warn("No clientId provided - skipping per-client rate limit");
    }

    const now = Date.now();
    let code: string;
    let expiresAt: number;
    let type: "quick" | "session";

    if (customCode !== undefined) {
      if (!/^[23456789ACDEFGHJKLMNPQRSTUVWXYZ]{5}$/i.test(customCode)) {
        throw new Error("Custom code must be 5 alphanumeric characters");
      }
      code = customCode.toUpperCase();
      type = "session";
      expiresAt = now + SESSION_PASTE_EXPIRY;

      const existing = await findPasteByCode(ctx, code);
      if (existing) {
        await ctx.db.patch(existing._id, { text, expiresAt });
        return { code, text, expiresAt, type, createdAt: existing.createdAt };
      }
    } else {
      let attempts = 0;
      do {
        code = generateCode(CODE_LENGTH);
        if (++attempts > 10) throw new Error("Failed to generate unique code");
      } while (await findPasteByCode(ctx, code));

      type = "quick";
      expiresAt = now + QUICK_PASTE_EXPIRY;
    }

    await ctx.db.insert("pastes", {
      code,
      text,
      type,
      expiresAt,
      createdAt: now,
    });

    return { code, text, expiresAt, type, createdAt: now };
  },
});

export const getPaste = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    code = code.toUpperCase();

    if (code.length !== CODE_LENGTH && code.length !== SESSION_CODE_LENGTH) {
      throw new Error(`Code must be ${CODE_LENGTH} or ${SESSION_CODE_LENGTH} characters`);
    }
    if (!/^[23456789ACDEFGHJKLMNPQRSTUVWXYZ]+$/.test(code)) {
      throw new Error("Code contains invalid characters");
    }

    const paste = await findPasteByCode(ctx, code);
    if (!paste || paste.expiresAt < Date.now()) {
      throw new Error("Paste not found or expired");
    }

    return {
      text: paste.text,
      type: paste.type,
      expiresAt: paste.expiresAt,
      createdAt: paste.createdAt,
    };
  },
});

export const watchPaste = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const paste = await findPasteByCode(ctx, code.toUpperCase());

    if (!paste || paste.expiresAt < Date.now()) {
      return null;
    }

    return {
      text: paste.text,
      type: paste.type,
      expiresAt: paste.expiresAt,
    };
  },
});

export const cleanupExpired = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("pastes")
      .withIndex("by_expiration", (q) => q.lt("expiresAt", now))
      .take(1000);

    for (const paste of expired) {
      await ctx.db.delete(paste._id);
    }

    return { deleted: expired.length, hasMore: expired.length === 1000 };
  },
});

// Monitoring query: Check current global rate limit status
// Use this to set up alerts if tokens drop below a threshold
export const getRateLimitStatus = query({
  handler: async (ctx) => {
    const globalLimit = await ctx.db
      .query("rateLimits")
      .withIndex("name", (q) => q.eq("name", "createPaste:global"))
      .first();

    if (!globalLimit) {
      return {
        tokens: GLOBAL_RATE_LIMIT.capacity,
        capacity: GLOBAL_RATE_LIMIT.capacity,
        percentage: 100,
        status: "healthy",
      };
    }

    const percentage = (globalLimit.value / GLOBAL_RATE_LIMIT.capacity) * 100;
    const status = percentage > 50 ? "healthy" : percentage > 20 ? "warning" : "critical";

    return {
      tokens: Math.round(globalLimit.value),
      capacity: GLOBAL_RATE_LIMIT.capacity,
      percentage: Math.round(percentage),
      status,
      lastUpdate: globalLimit.ts,
    };
  },
});

// Cron job: Monitor rate limit and log warnings
export const monitorRateLimit = internalMutation({
  handler: async (ctx) => {
    const globalLimit = await ctx.db
      .query("rateLimits")
      .withIndex("name", (q) => q.eq("name", "createPaste:global"))
      .first();

    if (!globalLimit) return;

    const percentage = (globalLimit.value / GLOBAL_RATE_LIMIT.capacity) * 100;
    const tokens = Math.round(globalLimit.value);

    if (percentage < 20) {
      console.warn(`CRITICAL: Rate limit at ${Math.round(percentage)}% (${tokens}/${GLOBAL_RATE_LIMIT.capacity}) - Possible DDoS`);
    } else if (percentage < 50) {
      console.warn(`WARNING: Rate limit at ${Math.round(percentage)}% (${tokens}/${GLOBAL_RATE_LIMIT.capacity})`);
    }
  },
});
