import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import { safeNextPath } from "@/lib/auth/next-path";
import { getCurrentUser } from "@/lib/auth/session";

import { signInWithMicrosoft } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  not_staff:
    "Your Microsoft account isn’t on the NuAIg staff list. Ask a NuAIg admin to add your email, then try again.",
  deactivated: "Your NuAIg access has been deactivated. Contact a NuAIg admin.",
  account_mismatch:
    "This email is already linked to a different Microsoft account. Contact a NuAIg admin.",
  sso_failed: "Microsoft sign-in didn’t complete. Please try again.",
  server_error: "Something went wrong signing you in. Please try again.",
};

function MicrosoftMark() {
  return (
    <svg aria-hidden viewBox="0 0 21 21" className="size-4">
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  const { user } = await getCurrentUser();
  if (user?.is_active) {
    redirect(next);
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-surface p-8 shadow-panel">
        <Logo height={40} />
        <h1 className="mt-8 text-base font-semibold text-fg">Sign in to continue</h1>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-sm bg-live-050 px-3 py-2 text-[13px] text-live-600"
          >
            {error}
          </p>
        )}

        <form action={signInWithMicrosoft} className="mt-6">
          <input type="hidden" name="next" value={next} />
          <Button type="submit" className="w-full">
            <MicrosoftMark />
            Sign in with Microsoft
          </Button>
        </form>
      </div>
    </main>
  );
}
