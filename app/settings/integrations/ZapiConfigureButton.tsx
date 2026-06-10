"use client";

import { useState } from "react";

export function ZapiConfigureButton() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function configure() {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/integrations/zapi/configure", { method: "POST" });
    const data = await response.json().catch(() => null);
    setBusy(false);
    setStatus(response.ok ? `Webhooks configurados: ${data?.webhookUrl}` : data?.error || "Falha ao configurar webhooks.");
  }

  return (
    <div className="panel mt-4 p-4">
      <p className="font-medium text-navy">Webhooks da Z-API</p>
      <p className="mt-1 text-sm text-steel">
        Configura recebimento, envio, status de mensagem e notificacao de mensagens enviadas pelo proprio numero.
      </p>
      <button disabled={busy} onClick={configure} className="mt-3 rounded bg-navy px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
        Configurar webhooks
      </button>
      {status && <p className="mt-3 text-sm text-steel">{status}</p>}
    </div>
  );
}
