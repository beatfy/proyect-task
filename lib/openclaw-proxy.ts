const OPENCLAW_GATEWAY = "https://clawd.beatfy.net";
const OPENCLAW_TOKEN = process.env.OPENCLAW_AUTH_TOKEN || "";

export async function sendToTasky(
  message: string,
  userId: string,
  projectId?: string,
  organizationId?: string
): Promise<string> {
  const authToken = OPENCLAW_TOKEN.startsWith("Bearer ")
    ? OPENCLAW_TOKEN
    : `Bearer ${OPENCLAW_TOKEN}`;

  const res = await fetch(`${OPENCLAW_GATEWAY}/hooks/wake`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authToken,
    },
    body: JSON.stringify({
      text: `[Contexto: Proyecto ${projectId || "unknown"}, Org ${organizationId || "unknown"}]
${message}`,
      mode: "now",
      sessionKey: `taskx2-${userId}-${projectId || "none"}`,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  return text;
}
