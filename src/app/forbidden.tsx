import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">
          You don’t have access to this page
        </h1>
        <p className="mt-2 text-fg-muted">This area is for NuAIg admins.</p>
        <ButtonLink href="/" className="mt-6">
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
