"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/next-path";
import { OIDC_COOKIE, startSignIn } from "@/lib/auth/oidc";

export async function signInWithMicrosoft(formData: FormData) {
  const next = safeNextPath(formData.get("next"));

  let signIn: Awaited<ReturnType<typeof startSignIn>>;
  try {
    signIn = await startSignIn(next);
  } catch (error) {
    console.error("Starting Microsoft sign-in failed", error);
    redirect("/login?error=sso_failed");
  }

  (await cookies()).set(OIDC_COOKIE, signIn.transaction, signIn.cookieOptions);
  redirect(signIn.url);
}
