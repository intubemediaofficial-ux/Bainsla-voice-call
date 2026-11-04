import type { Role } from "@prisma/client";

export const PERMS = [
  "contacts.read",
  "contacts.write",
  "contacts.export",
  "suppression.write",
  "callerids.read",
  "callerids.request",
  "callerids.manage",
  "audio.read",
  "audio.upload",
  "audio.approve",
  "campaigns.read",
  "campaigns.write",
  "campaigns.approve",
  "campaigns.control",
  "calls.single",
  "calls.read",
  "ivr.read",
  "ivr.write",
  "reports.read",
  "reports.export",
  "billing.read",
  "billing.manage",
  "staff.manage",
  "settings.manage",
  "audit.read",
  "emergency.stop",
] as const;

export type Perm = (typeof PERMS)[number];

const READ: Perm[] = ["contacts.read", "callerids.read", "audio.read", "campaigns.read", "calls.read", "ivr.read", "reports.read"];

const MATRIX: Record<Role, Perm[]> = {
  ADMIN: [...PERMS],
  MANAGER: [
    ...READ,
    "contacts.write",
    "suppression.write",
    "callerids.request",
    "audio.upload",
    "audio.approve",
    "campaigns.write",
    "campaigns.approve",
    "campaigns.control",
    "calls.single",
    "ivr.write",
    "reports.export",
    "billing.read",
    "emergency.stop",
  ],
  OPERATOR: [...READ, "contacts.write", "suppression.write", "audio.upload", "campaigns.write", "campaigns.control", "calls.single", "emergency.stop"],
  AUDITOR: [...READ, "reports.export", "billing.read", "audit.read"],
};

export function can(role: Role, perm: Perm): boolean {
  return MATRIX[role].includes(perm);
}

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  AUDITOR: "Auditor",
};

export const ROLE_INFO: Record<Role, string> = {
  ADMIN: "Full access: staff, settings, billing, provider, audit",
  MANAGER: "Approve audio & campaigns, run calls, reports",
  OPERATOR: "Import contacts, draft campaigns, single calls",
  AUDITOR: "Read-only access to everything plus audit logs",
};
