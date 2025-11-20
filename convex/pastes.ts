import { v } from "convex/values";
import { mutation, query, internalMutation, MutationCtx, QueryCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

// Constants
const QUICK_PASTE_EXPIRY = 15 * 60 * 1000; // 15 minutes
const SESSION_PASTE_EXPIRY = 60 * 60 * 1000; // 1 hour
const CODE_LENGTH = 4;
const SESSION_CODE_LENGTH = 5;
const MAX_TEXT_LENGTH = 100000; // 100KB

// Helper: Generate random numeric code
function generateCode(length: number): string {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join("");
}

// Helper: Find paste by code
async function findPasteByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<"pastes"> | null> {
  return await ctx.db
    .query("pastes")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
}

// Mutation: Create or update a paste
export const createPaste = mutation({
  args: {
    text: v.string(),
    customCode: v.optional(v.string()),
  },
  handler: async (ctx, { text, customCode }) => {
    // Validate text
    if (!text.trim()) {
      throw new Error("Text is required");
    }

    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error(`Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
    }

    const now = Date.now();
    let code: string;
    let expiresAt: number;
    let type: "quick" | "session";

    // Handle custom code (session mode)
    if (customCode !== undefined) {
      if (!/^\d{5}$/.test(customCode)) {
        throw new Error("Custom code must be 5 digits");
      }

      code = customCode;
      type = "session";
      expiresAt = now + SESSION_PASTE_EXPIRY;

      // Update existing or create new
      const existing = await findPasteByCode(ctx, code);
      if (existing) {
        await ctx.db.patch(existing._id, {
          text,
          expiresAt,
        });
        return { code, text, expiresAt, type };
      }
    } else {
      // Generate unique code for quick paste
      let attempts = 0;
      do {
        code = generateCode(CODE_LENGTH);
        attempts++;
        if (attempts > 10) {
          throw new Error("Failed to generate unique code");
        }
      } while (await findPasteByCode(ctx, code));

      type = "quick";
      expiresAt = now + QUICK_PASTE_EXPIRY;
    }

    // Create new paste
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

// Query: Get a paste by code
export const getPaste = query({
  args: {
    code: v.string(),
  },
  handler: async (ctx, { code }) => {
    // Validate code format
    const isValidLength = code.length === CODE_LENGTH || code.length === SESSION_CODE_LENGTH;
    if (!isValidLength) {
      throw new Error(`Code must be ${CODE_LENGTH} or ${SESSION_CODE_LENGTH} digits`);
    }

    const paste = await findPasteByCode(ctx, code);

    if (!paste) {
      throw new Error("Paste not found or expired");
    }

    // Check if expired
    if (paste.expiresAt < Date.now()) {
      throw new Error("Paste not found or expired");
    }

    return {
      text: paste.text,
      type: paste.type,
      expiresAt: paste.expiresAt,
    };
  },
});

// Internal Mutation: Clean up expired pastes (called by cron job)
export const cleanupExpired = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("pastes")
      .withIndex("by_expiration", (q) => q.lt("expiresAt", now))
      .collect();

    let deleted = 0;
    for (const paste of expired) {
      await ctx.db.delete(paste._id);
      deleted++;
    }

    return { deleted };
  },
});
