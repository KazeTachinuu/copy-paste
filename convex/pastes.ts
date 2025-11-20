import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { rateLimit } from "convex-helpers/server/rateLimit";

const QUICK_PASTE_EXPIRY = 15 * 60 * 1000;
const SESSION_PASTE_EXPIRY = 60 * 60 * 1000;
const CODE_LENGTH = 4;
const SESSION_CODE_LENGTH = 5;
const MAX_TEXT_LENGTH = 100000;

const RATE_LIMIT_CONFIG = {
  kind: "token bucket" as const,
  rate: 10,
  period: 60000,
  capacity: 15,
  maxReserved: 5,
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
  },
  handler: async (ctx, { text, customCode }) => {
    if (!text.trim()) throw new Error("Text is required");
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
    }

    await rateLimit(ctx, {
      name: "createPaste",
      throws: true,
      config: RATE_LIMIT_CONFIG,
    });

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
        return { code, text, expiresAt, type };
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

    return { code, text, expiresAt, type };
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
