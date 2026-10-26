import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ShellProvider } from "@/components/shell";
import { Sidebar } from "@/components/sidebar";
import { SPLASH_SCRIPT, Splash } from "@/components/splash";
import { Topbar } from "@/components/topbar";
import { ViewFrame } from "@/components/view-frame";
import { isAuthed } from "@/lib/auth";

export const runtime = "nodejs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthed())) redirect("/login");
  return (
    <ShellProvider>
      <script dangerouslySetInnerHTML={{ __html: SPLASH_SCRIPT }} />
      <Splash />
      <div className="flex min-h-screen flex-col bg-canvas text-stone-900 md:flex-row">
        <Suspense fallback={<div className="rail skeleton-shimmer hidden h-screen shrink-0 md:block" />}>
          <Sidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <ViewFrame>{children}</ViewFrame>
          <footer className="no-print mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-stone-200/80 px-6 py-4 text-xs text-stone-500 lg:px-10">
            <span>Orders are read from NetSuite and are never written back. Truck positions come from Fleetio.</span>
            <span className="hidden items-center gap-1.5 md:ml-auto md:flex">
              Press <kbd>?</kbd> for keyboard shortcuts
            </span>
          </footer>
        </div>
      </div>
    </ShellProvider>
  );
}
