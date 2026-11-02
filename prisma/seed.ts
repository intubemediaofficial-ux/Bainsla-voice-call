import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_PURPOSES } from "../src/lib/defaults";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL || "intubemediaofficial@gmail.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  await prisma.platformSetting.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    if (!password || password.length < 10) throw new Error("Set SEED_ADMIN_PASSWORD (min 10 chars) for the first admin");
    const tenant = await prisma.tenant.create({ data: { name: process.env.SEED_TENANT_NAME || "Bainsla Music", ratePerMinutePaise: 30 } });
    user = await prisma.user.create({
      data: { tenantId: tenant.id, email, name: "Intube Media Admin", role: "ADMIN", isPlatformAdmin: true, passwordHash: await bcrypt.hash(password, 12) },
    });
    console.log("Created organisation + platform admin", email);
  }
  const tenantId = user.tenantId;
  for (const p of DEFAULT_PURPOSES) {
    await prisma.purpose.upsert({ where: { tenantId_name: { tenantId, name: p.name } }, create: { tenantId, ...p }, update: {} });
  }
  if (!(await prisma.ivrFlow.findFirst({ where: { tenantId } }))) {
    await prisma.ivrFlow.create({
      data: {
        tenantId,
        name: "Standard (1 interested, 2 repeat, 9 opt out)",
        definition: {
          prompt: "Press 1 if you are interested, 2 to hear this again, or 9 to stop receiving these calls.",
          timeoutSec: 8,
          options: [
            { digit: "1", action: "interested", label: "Interested" },
            { digit: "2", action: "repeat", label: "Repeat" },
            { digit: "9", action: "opt_out", label: "Stop calls" },
          ],
        },
        history: [],
      },
    });
  }
  console.log("Seed done");
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
