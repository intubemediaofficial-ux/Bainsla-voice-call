import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __bvPrisma?: PrismaClient };

export const prisma = g.__bvPrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__bvPrisma = prisma;
