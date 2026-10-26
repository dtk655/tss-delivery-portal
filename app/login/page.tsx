import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { login } from "@/app/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { hostedAuthError, isAuthed } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in · Delivery Operations Portal",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await isAuthed()) redirect("/");
  const { error } = await searchParams;
  const configError = hostedAuthError();
  const year = new Date().getFullYear();
  return (
    <main className="min-h-screen bg-canvas lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className="login-brand relative isolate flex flex-col items-center justify-center overflow-hidden bg-asphalt px-6 py-12 text-white lg:min-h-screen lg:px-16">
        <div className="login-grid absolute inset-0 -z-10" aria-hidden />
        <div className="login-glow absolute -z-10" aria-hidden />

        <div className="login-rise flex w-full max-w-[34rem] flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Traffic Safety Service"
            width={800}
            height={350}
            priority
            className="h-auto w-full max-w-[19rem] drop-shadow-[0_18px_40px_rgb(0_0_0/0.45)] lg:max-w-[31rem]"
          />
          <div className="mt-10 h-px w-24 bg-gradient-to-r from-transparent via-sheeting to-transparent lg:mt-14" aria-hidden />
          <p className="font-display mt-8 text-[1.45rem] leading-snug font-bold tracking-tight text-white lg:mt-10 lg:text-[2.1rem] lg:leading-[1.2]">
            Since 1971, Traffic Safety Service has been at the forefront of the traffic safety industry.
          </p>
        </div>

        <p className="absolute bottom-6 hidden text-xs text-[#7f8992] lg:block">
          © {year} Traffic Safety Service, L.L.C.
        </p>
      </section>

      <div className="flex items-start justify-center px-4 py-12 lg:items-center lg:py-16">
        <div className="login-card w-full max-w-sm">
          <h1 className="font-display text-[2rem] leading-tight font-extrabold tracking-tight text-balance text-stone-950">
            Delivery Operations Portal
          </h1>
          <p className="mt-2 text-sm text-stone-600">Dispatch, fleet tracking and proof of delivery. Sign in to continue.</p>
          <form action={login} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoFocus
                required
                className="h-11 bg-white text-base"
              />
            </div>
            {configError ? (
              <p className="text-sm font-medium text-[#b01820]">{configError}</p>
            ) : error === "config" ? (
              <p className="text-sm font-medium text-[#b01820]">
                Set APP_PASSWORD and AUTH_SECRET in the Netlify site environment.
              </p>
            ) : error === "1" ? (
              <p className="rounded-lg border border-[#f3c1c4] bg-[#fef2f2] px-3 py-2 text-sm font-medium text-[#b01820]">
                Wrong password.
              </p>
            ) : null}
            <Button type="submit" size="lg" className="h-11 w-full text-[0.95rem]" disabled={Boolean(configError)}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
