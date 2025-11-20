import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up expired pastes every 6 hours
// Since queries filter expired pastes, there's no urgency to delete immediately
// This reduces DB load and execution costs while keeping the database tidy
crons.interval(
  "cleanup expired pastes",
  { hours: 6 },
  internal.pastes.cleanupExpired
);

export default crons;
