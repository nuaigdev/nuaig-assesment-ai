import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";

import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { AUDIT_ACTIONS, auditActionLabel, auditEntityHref, describeAuditEntry } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth/session";
import { searchParam } from "@/lib/search";
import { createUserClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;

function pageHref(action: string, page: number) {
  const params = new URLSearchParams();
  if (action) params.set("action", action);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/audit?${query}` : "/audit";
}

/** Audit log (spec §7.6). Entries are written by database triggers, so they can't be skipped. */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const actionParam = searchParam(params.action);
  const action = AUDIT_ACTIONS.includes(actionParam) ? actionParam : "";
  const page = Math.max(1, Number.parseInt(searchParam(params.page), 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let request = createUserClient(admin.id)
    .from("audit_log")
    .select("id, action, entity_type, entity_id, metadata, created_at, users(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);
  if (action) request = request.eq("action", action);
  const { data, count, error } = await request;
  // PGRST103: the requested page is past the end.
  if (error && error.code !== "PGRST103") throw new Error(`Audit log: ${error.message}`);

  const entries = data ?? [];
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Audit log" description="Who changed what: access, clients, scheduling and join links." />

      <Form action="/audit" className="mb-4 flex items-end gap-3">
        <div className="w-72">
          <label htmlFor="audit-action" className="mb-1.5 block text-xs font-medium text-fg">
            Action
          </label>
          <Select id="audit-action" name="action" defaultValue={action}>
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((option) => (
              <option key={option} value={option}>
                {auditActionLabel(option)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {action && (
          <ButtonLink href="/audit" variant="ghost">
            Clear
          </ButtonLink>
        )}
      </Form>

      {entries.length === 0 ? (
        <EmptyState message={action ? "No entries for this action." : "Nothing has been recorded yet."} />
      ) : (
        <>
          <Table>
            <caption className="sr-only">Audit log entries</caption>
            <THead>
              <tr>
                <TH>When</TH>
                <TH>Who</TH>
                <TH>Action</TH>
                <TH>Details</TH>
              </tr>
            </THead>
            <TBody>
              {entries.map((entry) => {
                const href = auditEntityHref(entry.entity_type, entry.entity_id);
                const detail = describeAuditEntry(entry.action, entry.metadata);
                return (
                  <TR key={entry.id}>
                    <TD className="whitespace-nowrap text-fg-muted">
                      <LocalTime iso={entry.created_at} />
                    </TD>
                    <TD className="text-fg">{entry.users?.full_name ?? entry.users?.email ?? "System"}</TD>
                    <TD className="font-medium text-fg">{auditActionLabel(entry.action)}</TD>
                    <TD className="text-fg-muted">
                      {href ? (
                        <Link href={href} className="text-brand-700 hover:underline">
                          {detail || "View"}
                        </Link>
                      ) : (
                        detail || "—"
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>

          <nav aria-label="Audit log pages" className="mt-4 flex items-center justify-between gap-4">
            <p className="text-[13px] text-fg-muted">
              Page {Math.min(page, totalPages)} of {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <ButtonLink href={pageHref(action, page - 1)} variant="secondary" size="sm">
                  Newer
                </ButtonLink>
              )}
              {page < totalPages && (
                <ButtonLink href={pageHref(action, page + 1)} variant="secondary" size="sm">
                  Older
                </ButtonLink>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}
