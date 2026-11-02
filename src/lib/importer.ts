import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { encrypt, hashPhone } from "./crypto";
import { normalizePhone } from "./phone";
import { parseLooseDate, type Row } from "./import";

export type ImportOpts = {
  tenant: Tenant;
  actorId: string;
  purposeId: string;
  fileName: string;
  tags: string[];
  channel: string;
  defaultSource?: string;
  defaultEvidence?: string;
  defaultDate?: Date | null;
};

export type ImportError = { row: number; reason: string };

/** Imports rows. Each row needs consent source + evidence (from the row or the form defaults). PII never lands in errors. */
export async function importRows(rows: Row[], o: ImportOpts) {
  const errors: ImportError[] = [];
  type Good = { e164: string; hash: string; masked: string; name: string; source: string; evidence: string; granted: Date; expires: Date | null; tags: string[] };
  const good: Good[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  const now = new Date();
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const p = normalizePhone(r.phone);
    if (!p.ok) return errors.push({ row: rowNo, reason: p.error });
    const hash = hashPhone(p.e164);
    if (seen.has(hash)) {
      duplicates++;
      return;
    }
    seen.add(hash);
    const source = (r.consent_source || o.defaultSource || "").trim();
    const evidence = (r.consent_evidence || o.defaultEvidence || "").trim();
    if (!source) return errors.push({ row: rowNo, reason: "Missing consent source" });
    if (!evidence) return errors.push({ row: rowNo, reason: "Missing consent evidence / reference" });
    const granted = r.consent_date ? parseLooseDate(r.consent_date) : (o.defaultDate ?? null);
    if (!granted) return errors.push({ row: rowNo, reason: r.consent_date ? "Consent date not understood (use DD/MM/YYYY)" : "Missing consent date" });
    if (granted > now) return errors.push({ row: rowNo, reason: "Consent date is in the future" });
    const expires = r.consent_expiry ? parseLooseDate(r.consent_expiry) : null;
    if (r.consent_expiry && !expires) return errors.push({ row: rowNo, reason: "Consent expiry not understood" });
    const rowTags = (r.tags || "").split(/[;,|]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    good.push({ e164: p.e164, hash, masked: p.masked, name: (r.name || "").slice(0, 120), source: source.slice(0, 200), evidence: evidence.slice(0, 200), granted, expires, tags: [...new Set([...o.tags, ...rowTags])].slice(0, 20) });
  });

  const imp = await prisma.contactImport.create({
    data: { tenantId: o.tenant.id, fileName: o.fileName.slice(0, 200), purposeId: o.purposeId, tags: o.tags, total: rows.length, createdById: o.actorId },
  });

  let created = 0;
  let updated = 0;
  let suppressed = 0;
  for (let i = 0; i < good.length; i += 1000) {
    const chunk = good.slice(i, i + 1000);
    const hashes = chunk.map((g) => g.hash);
    const [existing, sup] = await Promise.all([
      prisma.contact.findMany({ where: { tenantId: o.tenant.id, phoneHash: { in: hashes } }, select: { id: true, phoneHash: true, tags: true } }),
      prisma.suppression.findMany({ where: { tenantId: o.tenant.id, phoneHash: { in: hashes } }, select: { phoneHash: true } }),
    ]);
    suppressed += sup.length;
    const byHash = new Map(existing.map((e) => [e.phoneHash, e]));
    const fresh = chunk.filter((g) => !byHash.has(g.hash));
    if (fresh.length) {
      const r = await prisma.contact.createMany({
        data: fresh.map((g) => ({ tenantId: o.tenant.id, phoneEnc: encrypt(g.e164), phoneHash: g.hash, phoneMasked: g.masked, nameEnc: g.name ? encrypt(g.name) : null, tags: g.tags })),
        skipDuplicates: true,
      });
      created += r.count;
    }
    for (const g of chunk) {
      const e = byHash.get(g.hash);
      if (!e) continue;
      const merged = [...new Set([...e.tags, ...g.tags])];
      if (merged.length !== e.tags.length || g.name)
        await prisma.contact.update({ where: { id: e.id }, data: { tags: merged, ...(g.name ? { nameEnc: encrypt(g.name) } : {}) } });
      updated++;
    }
    const all = await prisma.contact.findMany({ where: { tenantId: o.tenant.id, phoneHash: { in: hashes } }, select: { id: true, phoneHash: true } });
    const idByHash = new Map(all.map((c) => [c.phoneHash, c.id]));
    const active = await prisma.consentRecord.findMany({
      where: { tenantId: o.tenant.id, purposeId: o.purposeId, contactId: { in: all.map((a) => a.id) }, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      select: { contactId: true },
    });
    const hasActive = new Set(active.map((a) => a.contactId));
    await prisma.consentRecord.createMany({
      data: chunk
        .filter((g) => idByHash.has(g.hash) && !hasActive.has(idByHash.get(g.hash)!))
        .map((g) => ({
          tenantId: o.tenant.id, contactId: idByHash.get(g.hash)!, purposeId: o.purposeId, channel: o.channel, grantedAt: g.granted,
          source: g.source, evidenceRef: g.evidence, expiresAt: g.expires, importId: imp.id, createdById: o.actorId,
        })),
    });
  }
  const summary = { total: rows.length, created, updated, duplicates, rejected: errors.length, suppressed };
  await prisma.contactImport.update({ where: { id: imp.id }, data: { created, updated, duplicates, rejected: errors.length, errors: errors.slice(0, 500) } });
  return { importId: imp.id, ...summary, errors: errors.slice(0, 200) };
}
