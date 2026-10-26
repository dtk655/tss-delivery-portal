"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { clearSession, passwordMatches, setSession } from "@/lib/auth";

export async function login(formData: FormData): Promise<void> {
  if (process.env.NETLIFY === "true" && (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET)) {
    redirect("/login?error=config");
  }
  const password = String(formData.get("password") ?? "");
  if (!passwordMatches(password)) redirect("/login?error=1");
  await setSession();
  // One-time flag: the loading screen plays after every sign-in and clears it.
  (await cookies()).set("tss_splash", "1", { path: "/", maxAge: 120, sameSite: "lax", httpOnly: false });
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
