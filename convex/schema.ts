import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { rateLimitTables } from "convex-helpers/server/rateLimit";

export default defineSchema({
  ...rateLimitTables,
  pastes: defineTable({
    code: v.string(),
    text: v.string(),
    type: v.union(v.literal("quick"), v.literal("session")),
    expiresAt: v.number(),
    createdAt: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_expiration", ["expiresAt"])
    .index("by_type", ["type"]),
});
