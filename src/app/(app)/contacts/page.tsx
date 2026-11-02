import Link from "next/link";
import { Download, Search, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { hashPhone } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { num } from "@/lib/format";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { AddContact, ImportForm, RevealButton } from "./forms";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; page?: string }> }) {
  const ctx = await requirePage("contacts.read");
  const sp = await searchParams;
  const t = ctx.tenant.id;
  const page = Math.max(1, Number(sp.page || 1));
  const where: Prisma.ContactWhereInput = { tenantId: t, phoneEnc: { not: "erased" } };
  if (sp.q) {
    const p = normalizePhone(sp.q);
    where.phoneHash = p.ok ? hashPhone(p.e164) : "__none__";
  }
  if (sp.tag) where.tags = { has: sp.tag.toLowerCase() };
  const [purposes, contacts, total, imports, tagRows, supp] = await Promise.all([
    prisma.purpose.findMany({ where: { tenantId: t, active: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, take: 50, skip: (page - 1) * 50, include: { consents: { where: { revokedAt: null }, include: { purpose: { select: { name: true } } } } } }),
    prisma.contact.count({ where }),
    prisma.contactImport.findMany({ where: { tenantId: t }, orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.$queryRaw<{ tag: string; n: bigint }[]>`SELECT unnest(tags) AS tag, count(*) AS n FROM "Contact" WHERE "tenantId" = ${t} GROUP BY 1 ORDER BY 2 DESC LIMIT 30`,
    prisma.suppression.findMany({ where: { tenantId: t }, select: { phoneHash: true } }),
  ]);
  const suppressed = new Set(supp.map((s) => s.phoneHash));
  const canWrite = ctxCan(ctx, "contacts.write");
  const purposeOpts = purposes.map((p) => ({ id: p.id, name: p.name, category: p.category }));
  const templateLink = (
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    <a href="/api/contacts/template" className="btn-ghost"><Download className="h-4 w-4" /> Excel template</a>
  );
  return (
    <>
      <PageHeader
        title="Contacts & import"
        subtitle="Upload your Excel sheet of people who agreed to receive calls. Each number is stored encrypted with its consent record."
        actions={templateLink}
      />
      {canWrite && (
        <div className="grid gap-6 xl:grid-cols-3">
          <Card title="Upload Excel / CSV" className="xl:col-span-2">
            {purposes.length === 0 ? <p className="text-sm text-slate-500">Add a call purpose in Settings first.</p> : <ImportForm purposes={purposeOpts} politicalEnabled={ctx.tenant.politicalEnabled} />}
          </Card>
          <Card title="Add one contact">
            <AddContact purposes={purposeOpts} />
          </Card>
        </div>
      )}
      {imports.length > 0 && (
        <Card title="Recent uploads" className="mt-6" pad={false}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>File</th><th>Rows</th><th>New</th><th>Updated</th><th>Duplicate</th><th>Rejected</th><th>When</th></tr></thead>
              <tbody>
                {imports.map((i) => (
                  <tr key={i.id}>
                    <td className="max-w-[220px] truncate font-medium">{i.fileName}</td>
                    <td>{num(i.total)}</td><td className="text-emerald-700">{num(i.created)}</td><td>{num(i.updated)}</td><td>{num(i.duplicates)}</td>
                    <td className={i.rejected ? "text-rose-600" : ""}>{num(i.rejected)}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(i.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card
        className="mt-6"
        pad={false}
        title={`All contacts (${num(total)})`}
        actions={
          <form className="flex w-full flex-wrap gap-2 sm:w-auto" action="/contacts">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input name="q" defaultValue={sp.q} placeholder="Search full number" className="input w-full py-2 pl-8 sm:w-48" />
            </div>
            <select name="tag" defaultValue={sp.tag} className="input w-36 py-2">
              <option value="">All tags</option>
              {tagRows.map((r) => <option key={r.tag} value={r.tag}>{r.tag} ({Number(r.n)})</option>)}
            </select>
            <button className="btn-ghost py-2">Filter</button>
          </form>
        }
      >
        {contacts.length === 0 ? (
          <Empty icon={Users} title="No contacts yet" text="Download the Excel template, fill your consented contacts and upload it above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Number</th><th>Tags</th><th>Consent</th><th>Status</th><th>Added</th><th /></tr></thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{c.phoneMasked}</td>
                    <td><div className="flex flex-wrap gap-1">{c.tags.map((x) => <Link key={x} href={`/contacts?tag=${encodeURIComponent(x)}`}><Badge tone="violet">{x}</Badge></Link>)}</div></td>
                    <td className="text-xs">{c.consents.length ? c.consents.map((k) => <div key={k.id}>{k.purpose.name} · {fmtDate(k.grantedAt)}{k.expiresAt ? ` → ${fmtDate(k.expiresAt)}` : ""}</div>) : <span className="text-rose-600">No active consent</span>}</td>
                    <td>{suppressed.has(c.phoneHash) ? <Badge tone="rose">Opted out</Badge> : <Badge tone="green">Callable</Badge>}</td>
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(c.createdAt)}</td>
                    <td>{ctxCan(ctx, "contacts.export") && <RevealButton id={c.id} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 50 && (
          <div className="flex items-center justify-between px-5 py-3 text-sm">
            <span className="text-slate-500">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              {page > 1 && <Link className="btn-ghost py-1.5" href={`/contacts?${new URLSearchParams({ ...sp, page: String(page - 1) } as Record<string, string>)}`}>Previous</Link>}
              {page * 50 < total && <Link className="btn-ghost py-1.5" href={`/contacts?${new URLSearchParams({ ...sp, page: String(page + 1) } as Record<string, string>)}`}>Next</Link>}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
