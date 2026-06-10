"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");

    if (email.trim().toLowerCase() === "advogado@teste.com") {
      const demoResponse = await fetch("/api/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      setBusy(false);
      if (!demoResponse.ok) {
        setError("Use a senha teste123 para o usuario demo.");
        return;
      }
      router.push("/conversations");
      router.refresh();
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError("E-mail ou senha invalidos.");
      return;
    }
    router.push("/conversations");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="panel w-full max-w-md overflow-hidden">
      <div className="bg-navy px-6 py-6 text-white">
        <p className="text-xs uppercase tracking-[0.18em] text-white/70">Atendimento juridico</p>
        <h1 className="mt-2 text-2xl font-semibold">Severo, Lima & Conceicao</h1>
        <p className="mt-2 text-sm text-white/75">Acesse as conversas direcionadas para voce.</p>
      </div>
      <div className="p-6">
      <div className="rounded border border-[#c8d0e6] bg-navySoft p-3 text-sm text-navy">
        <p className="font-semibold">Usuario de teste</p>
        <p>E-mail: advogado@teste.com</p>
        <p>Senha: teste123</p>
      </div>
      <label className="mt-6 block text-sm font-medium text-ink">
        E-mail
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-1 w-full rounded border border-line px-3 py-2" required />
      </label>
      <label className="mt-4 block text-sm font-medium text-ink">
        Senha
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-1 w-full rounded border border-line px-3 py-2" required />
      </label>
      {error && <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-6 w-full rounded bg-navy px-4 py-3 font-medium text-white transition hover:bg-navyDark disabled:opacity-60">
        Entrar
      </button>
      </div>
    </form>
  );
}
