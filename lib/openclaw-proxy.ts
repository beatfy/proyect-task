const OPENCLAW_GATEWAY = "https://clawd.taskProject.net";

export async function sendToLedy(
  message: string,
  userId: string,
  projectId?: string,
  organizationId?: string
): Promise<string> {
  const token = process.env.OPENCLAW_AUTH_TOKEN || "";
  const authToken = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

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
      sessionKey: `taskProject-${userId}-${projectId || "none"}`,
    }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  return text;
}
