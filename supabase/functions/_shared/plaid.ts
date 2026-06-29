// Thin Plaid REST wrapper. No SDK — two endpoints, two fields injected. Base URL
// follows PLAID_ENV: sandbox | production (development is retired).
const ENV = Deno.env.get("PLAID_ENV") ?? "sandbox";
const BASE = `https://${ENV}.plaid.com`;

export async function plaidFetch(
  path: string,
  body: Record<string, unknown>,
): Promise<Record<string, any>> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: Deno.env.get("PLAID_CLIENT_ID"),
      secret: Deno.env.get("PLAID_SECRET"),
      ...body,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      `Plaid ${path} failed: ${data.error_code ?? res.status} ${data.error_message ?? ""}`,
    );
  }
  return data;
}
