import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

/** Placeholder for console routes whose phase (spec §14) hasn't been built yet. */
export function PhaseStub({ title, message }: { title: string; message: string }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState message={message} />
    </>
  );
}
