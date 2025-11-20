import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "cleanup expired pastes",
  { minutes: 30 },
  internal.pastes.cleanupExpired
);

export default crons;
