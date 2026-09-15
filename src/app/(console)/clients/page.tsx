import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";

import { OrganizationFields } from "@/components/clients/organization-fields";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { LocalTime } from "@/components/ui/local-time";
import { PageHeader } from "@/components/ui/page-header";
import { TBody, TD, TH, THead, TR, Table } from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { escapeLike, searchParam } from "@/lib/search";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";

import { createOrganization } from "./actions";

export const metadata: Metadata = { title: "Clients" };

/** Client organisations (spec §11.6). */
export default async function ClientsPage({ searchParams }: PageProps<"/clients">) {
  const admin = await requireAdmin();
  const query = searchParam((await searchParams).q).slice(0, 100);
  const db = createUserClient(admin.id);

  let request = db
    .from("organizations")
    .select("id, name, type, city, state, is_active, assessments(count), interviews(scheduled_at)")
    .order("is_active", { ascending: false })
    .order("name")
    .order("scheduled_at", { referencedTable: "interviews", ascending: false, nullsFirst: false })
    .limit(1, { referencedTable: "interviews" });
  if (query) request = request.ilike("name", `%${escapeLike(query)}%`);
  const organizations = must(await request, "Clients");

  return (
    <>
      <PageHeader
        title="Clients"
        description="Senior living organisations and the people NuAIg interviews there."
        actions={
          <FormDialog
            triggerLabel="Add client"
            title="Add client"
            action={createOrganization}
            submitLabel="Add client"
          >
            <OrganizationFields />
          </FormDialog>
        }
      />

      <Form action="/clients" role="search" className="mb-4 flex max-w-md gap-2">
        <Input name="q" defaultValue={query} placeholder="Search clients" aria-label="Search clients" />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <ButtonLink href="/clients" variant="ghost">
            Clear
          </ButtonLink>
        )}
      </Form>

      {organizations.length === 0 ? (
        <EmptyState
          message={
            query
              ? `No clients match “${query}”.`
              : "Add your first client organisation to start scheduling interviews."
          }
        />
      ) : (
        <Table>
          <caption className="sr-only">Clients</caption>
          <THead>
            <tr>
              <TH>Name</TH>
              <TH>Type</TH>
              <TH>Location</TH>
              <TH align="right">Assessments</TH>
              <TH align="right">Last interview</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {organizations.map((organization) => {
              const lastInterview = organization.interviews[0]?.scheduled_at;
              return (
                <TR key={organization.id}>
                  <TD>
                    <Link
                      href={`/clients/${organization.id}`}
                      className="rounded-sm font-medium text-fg hover:text-brand-700 hover:underline"
                    >
                      {organization.name}
                    </Link>
                  </TD>
                  <TD className="text-fg-muted">{organization.type ?? "—"}</TD>
                  <TD className="text-fg-muted">
                    {[organization.city, organization.state].filter(Boolean).join(", ") || "—"}
                  </TD>
                  <TD align="right" className="text-fg-muted">
                    {organization.assessments[0]?.count ?? 0}
                  </TD>
                  <TD align="right" className="text-fg-muted">
                    {lastInterview ? <LocalTime iso={lastInterview} format="date" /> : "—"}
                  </TD>
                  <TD>
                    <Badge tone={organization.is_active ? "ok" : "muted"}>
                      {organization.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </>
  );
}
