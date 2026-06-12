import Link from "next/link";
import type { Profile } from "@/lib/types";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-navy/95 text-white shadow-lg shadow-navy/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Severo, Lima & Conceicao" className="h-11 w-auto object-contain" />
            <p className="text-xs text-white/75">{profile.name} · {profile.role}</p>
          </div>
          <nav className="flex flex-wrap gap-2 text-sm">
            <Link className="rounded px-3 py-2 text-white/90 transition hover:bg-white/10 hover:text-white" href="/conversations">Conversas</Link>
            <Link className="rounded px-3 py-2 text-white/90 transition hover:bg-white/10 hover:text-white" href="/dashboard">Dashboard</Link>
            {profile.role === "ADMIN" && (
              <>
                <Link className="rounded px-3 py-2 text-white/90 transition hover:bg-white/10 hover:text-white" href="/settings/users">Usuarios</Link>
                <Link className="rounded px-3 py-2 text-white/90 transition hover:bg-white/10 hover:text-white" href="/settings/integrations">Integracoes</Link>
              </>
            )}
            <form action="/api/logout" method="post">
              <button className="rounded border border-white/20 px-3 py-2 text-white/90 transition hover:bg-white/10 hover:text-white">
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6">{children}</div>
    </main>
  );
}
