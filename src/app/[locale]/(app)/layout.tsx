import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { NavRail } from "@/components/shell/nav-rail";
import { TopBar } from "@/components/shell/top-bar";
import { BottomTabs } from "@/components/shell/bottom-tabs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen">
      {/* Fixe et non cliquable : la nappe suit le défilement sans jamais
          s'interposer entre l'utilisateur et l'écran. */}
      <div aria-hidden className="app-aurora pointer-events-none fixed inset-0 -z-10" />
      <NavRail role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar profile={profile} />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-24 md:px-6 md:pb-8">
          {children}
        </main>
      </div>
      <BottomTabs role={profile.role} />
    </div>
  );
}
