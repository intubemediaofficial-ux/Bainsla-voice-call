import type { PurposeCategory } from "@prisma/client";

export const DEFAULT_PURPOSES: { name: string; category: PurposeCategory; description: string }[] = [
  { name: "Event information", category: "SERVICE", description: "Information about events the person registered for" },
  { name: "Payment / account reminder", category: "TRANSACTIONAL", description: "Reminders about the person's own account or dues" },
  { name: "New release updates", category: "PROMOTIONAL", description: "New songs and releases for subscribers who opted in" },
  { name: "Member / supporter update", category: "SERVICE", description: "Updates to registered members who asked to be kept informed" },
  { name: "Election campaign message", category: "POLITICAL", description: "Election outreach to supporters who explicitly consented. Needs DLT, provider approval and MCMC-certified audio." },
];
