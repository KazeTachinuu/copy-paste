import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired pastes",
  { minutes: 30 },
  internal.pastes.cleanupExpired
);

crons.interval(
  "monitor rate limit",
  { minutes: 5 },
  internal.pastes.monitorRateLimit
);

export default crons;
