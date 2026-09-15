import type { Metadata } from "next";
import Form from "next/form";

import { InterviewTable, type InterviewSummary } from "@/components/interviews/interview-table";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { requireUser } from "@/lib/auth/session";
import { INTERVIEW_STATUS_LABELS, INTERVIEW_STATUSES } from "@/lib/constants";
import { isUuid } from "@/lib/ids";
import { escapeLike, searchParam } from "@/lib/search";
import { must } from "@/lib/supabase/must";
import { createUserClient } from "@/lib/supabase/server";
import type { InterviewStatus } from "@/lib/supabase/types";

export const metadata: Metadata = { title: "Interviews" };

const PAGE_LIMIT = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

type Filters = {
  q: string;
  status: InterviewStatus | "";
  client: string;
  from: string;
  to: string;
  mine: boolean;
};

function readFilters(params: Record<string, string | string[] | undefined>): Filters {
  const status = searchParam(params.status);
  const client = searchParam(params.client);
  const from = searchParam(params.from);
  const to = searchParam(params.to);
  return {
    q: searchParam(params.q).slice(0, 100),
    status: INTERVIEW_STATUSES.includes(status as InterviewStatus) ? (status as InterviewStatus) : "",
    client: isUuid(client) ? client : "",
    from: DATE.test(from) ? from : "",
    to: DATE.test(to) ? to : "",
    mine: searchParam(params.mine) === "1",
  };
}

// Date filters use UTC day boundaries; close enough for finding an interview.
function startOfDay(date: string) {
  return `${date}T00:00:00Z`;
}
function startOfNextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 24 * 60 * 60 * 1000).toISOString();
}

const labelClasses = "mb-1.5 block text-xs font-medium text-fg";

/** The interviews workhorse table (spec §11.3). Admins see all; members see their assignments (RLS). */
export default async function InterviewsPage({ searchParams }: PageProps<"/interviews">) {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const filters = readFilters(await searchParams);
  const hasFilters = Boolean(filters.q || filters.status || filters.client || filters.from || filters.to || filters.mine);
  const db = createUserClient(user.id);

  const clientsPromise = db.from("organizations").select("id, name").order("name");

  // "Mine only" narrows admins to their assignments; members are already scoped by RLS.
  let onlyIds: string[] | null = null;
  if (isAdmin && filters.mine) {
    const assignments = must(
      await db.from("interview_participants").select("interview_id").eq("user_id", user.id),
      "Assignments",
    );
    onlyIds = assignments.map((row) => row.interview_id);
  }

  // Search matches the client name or the interviewee name.
  let searchClause: string | null = null;
  let searchMissed = false;
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    const [organizations, contacts] = await Promise.all([
      db.from("organizations").select("id").ilike("name", pattern),
      db.from("contacts").select("id").ilike("full_name", pattern),
    ]);
    const organizationIds = must(organizations, "Client search").map((row) => row.id);
    const contactIds = must(contacts, "Interviewee search").map((row) => row.id);
    const clauses = [
      organizationIds.length > 0 ? `organization_id.in.(${organizationIds.join(",")})` : null,
      contactIds.length > 0 ? `contact_id.in.(${contactIds.join(",")})` : null,
    ].filter(Boolean);
    if (clauses.length === 0) searchMissed = true;
    else searchClause = clauses.join(",");
  }

  let interviews: InterviewSummary[] = [];
  if (!searchMissed && !(onlyIds && onlyIds.length === 0)) {
    let request = db
      .from("interviews")
      .select(
        "id, title, department, status, scheduled_at, started_at, duration_seconds, organizations(name), contacts(full_name), interview_participants(role, users(full_name, email))",
      )
      .order("scheduled_at", { ascending: false, nullsFirst: false })
      .limit(PAGE_LIMIT + 1);
    if (filters.status) request = request.eq("status", filters.status);
    if (filters.client) request = request.eq("organization_id", filters.client);
    if (filters.from) request = request.gte("scheduled_at", startOfDay(filters.from));
    if (filters.to) request = request.lt("scheduled_at", startOfNextDay(filters.to));
    if (onlyIds) request = request.in("id", onlyIds);
    if (searchClause) request = request.or(searchClause);
    interviews = must(await request, "Interviews");
  }

  const clients = must(await clientsPromise, "Clients");
  const truncated = interviews.length > PAGE_LIMIT;
  const shown = interviews.slice(0, PAGE_LIMIT);

  return (
    <>
      <PageHeader
        title="Interviews"
        description={isAdmin ? "Every interview across all clients." : "Interviews you’re assigned to."}
        actions={isAdmin && <ButtonLink href="/interviews/new">Schedule interview</ButtonLink>}
      />

      <Form action="/interviews" role="search" className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-60">
          <label htmlFor="filter-q" className={labelClasses}>
            Search
          </label>
          <Input id="filter-q" name="q" defaultValue={filters.q} placeholder="Client or interviewee" />
        </div>
        <div className="w-40">
          <label htmlFor="filter-status" className={labelClasses}>
            Status
          </label>
          <Select id="filter-status" name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {INTERVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INTERVIEW_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <label htmlFor="filter-client" className={labelClasses}>
            Client
          </label>
          <Select id="filter-client" name="client" defaultValue={filters.client}>
            <option value="">All clients</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <label htmlFor="filter-from" className={labelClasses}>
            From
          </label>
          <Input id="filter-from" name="from" type="date" defaultValue={filters.from} />
        </div>
        <div className="w-40">
          <label htmlFor="filter-to" className={labelClasses}>
            To
          </label>
          <Input id="filter-to" name="to" type="date" defaultValue={filters.to} />
        </div>
        {isAdmin && (
          <label className="flex h-9 items-center gap-2 text-sm text-fg">
            <input
              type="checkbox"
              name="mine"
              value="1"
              defaultChecked={filters.mine}
              className="size-4 accent-brand-700"
            />
            Mine only
          </label>
        )}
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {hasFilters && (
          <ButtonLink href="/interviews" variant="ghost">
            Clear
          </ButtonLink>
        )}
      </Form>

      {shown.length === 0 ? (
        <EmptyState
          message={
            hasFilters
              ? "No interviews match these filters."
              : isAdmin
                ? "No interviews yet. Schedule the first one."
                : "No interviews are assigned to you yet."
          }
        />
      ) : (
        <>
          <InterviewTable interviews={shown} caption="Interviews" showJoin showParticipants />
          {truncated && (
            <p className="mt-3 text-[13px] text-fg-muted">
              Showing the {PAGE_LIMIT} most recent. Narrow the filters to find older interviews.
            </p>
          )}
        </>
      )}
    </>
  );
}
