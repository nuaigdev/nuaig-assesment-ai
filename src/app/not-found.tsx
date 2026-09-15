import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Page not found</h1>
        <p className="mt-2 text-fg-muted">The page you’re looking for doesn’t exist.</p>
        <ButtonLink href="/" className="mt-6">
          Back to dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
