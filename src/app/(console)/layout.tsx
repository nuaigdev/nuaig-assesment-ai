import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/lib/auth/session";

export default async function ConsoleLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <ToastProvider placement="bottom-right">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-2 focus:shadow-panel"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <Sidebar role={user.role} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar user={user} />
          <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
