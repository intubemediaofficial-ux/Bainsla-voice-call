import { PhoneCall, RefreshCw } from "lucide-react";
import { prisma } from "@/lib/db";
import { ctxCan, requirePage } from "@/lib/auth";
import { getProvider } from "@/lib/provider";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { ActionButton } from "@/components/client";
import { fmtDate } from "@/lib/time";
import { CategoryEditor, RequestCallerId } from "./form";

export const metadata = { title: "Caller IDs" };

export default async function CallerIdsPage() {
  const ctx = await requirePage("callerids.read");
  const provider = getProvider(ctx.tenant.providerKey);
  const rows = await prisma.callerId.findMany({ where: { tenantId: ctx.tenant.id }, orderBy: { createdAt: "desc" } });
  const manage = ctxCan(ctx, "callerids.manage");
  return (
    <>
      <PageHeader
        title="Caller IDs"
        subtitle={`Calls can only show a number that ${provider.label.split(" (")[0]} has verified for your account. No other number can be typed in.`}
        actions={manage && <ActionButton url="/api/caller-ids/sync" className="btn-primary" success="Synced"><RefreshCw className="h-4 w-4" /> Sync from provider</ActionButton>}
      />
      {provider.key === "mock" && <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900">Test mode: the mock provider is active, so no real phone calls are made. Add your Exotel account in Settings to go live.</div>}
      {ctxCan(ctx, "callerids.request") && <Card title="Request a number" className="mb-6"><RequestCallerId /></Card>}
      <Card pad={false} title="Numbers">
        {rows.length === 0 ? <Empty icon={PhoneCall} title="No caller IDs" text="Press “Sync from provider” to load the numbers on your telephony account." /> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Number</th><th>Label</th><th>Status</th><th>Allowed call types</th><th>Verified</th><th /></tr></thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{c.phoneE164}</td>
                    <td>{c.label}<div className="text-xs text-slate-400">{c.providerKey}</div></td>
                    <td><StatusBadge s={c.verificationStatus} /></td>
                    <td>{manage && c.verificationStatus === "VERIFIED" ? <CategoryEditor id={c.id} value={c.approvedCategories} political={ctx.tenant.politicalEnabled && ctx.tenant.politicalProviderOk} /> : <span className="text-xs">{c.approvedCategories.join(", ").toLowerCase()}</span>}</td>
                    <td className="text-xs text-slate-500">{c.verifiedAt ? fmtDate(c.verifiedAt) : "—"}</td>
                    <td>{manage && c.verificationStatus === "VERIFIED" && <ActionButton url={`/api/caller-ids/${c.id}`} method="PATCH" body={{ action: "revoke" }} className="text-xs font-semibold text-rose-600" confirm="Stop using this number?">Revoke</ActionButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
