import { AppShell } from "@/components/AppShell";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ZapiConfigureButton } from "@/app/settings/integrations/ZapiConfigureButton";

export default async function IntegrationsPage() {
  const profile = await requireProfile();
  if (profile.role !== "ADMIN") redirect("/dashboard");
  const vars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "OPENAI_API_KEY",
    "OPENAI_MODEL",
    "ZAPI_INSTANCE_ID",
    "ZAPI_TOKEN",
    "ZAPI_CLIENT_TOKEN",
    "ZAPI_BASE_URL",
    "WEBHOOK_SECRET",
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
  ];

  return (
    <AppShell profile={profile}>
      <h1 className="text-2xl font-semibold text-navy">Integracoes</h1>
      <p className="mt-1 text-sm text-steel">Configure estes valores no ambiente da Vercel. Segredos nunca sao expostos no frontend.</p>
      <div className="panel mt-4 divide-y divide-line">
        {vars.map((name) => (
          <div key={name} className="flex items-center justify-between px-4 py-3">
            <code className="text-sm">{name}</code>
            <span className="text-xs text-steel">{process.env[name] ? "Configurado" : "Pendente"}</span>
          </div>
        ))}
      </div>
      <ZapiConfigureButton />
    </AppShell>
  );
}
