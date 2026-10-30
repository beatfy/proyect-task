import { ImapFlow } from "imapflow";

export interface ImapEmail {
  id: string;
  from: string;
  subject: string;
  date: string;
  read: boolean;
  snippet: string;
}

export interface ImapEmailDetail extends ImapEmail {
  to: string;
  body: string;
  html?: string;
}

interface ImapConfig {
  host: string;
  port: number;
  email: string;
  password: string;
  ssl: boolean;
}

/**
 * Decode Quoted-Printable encoded string preserving multi-byte UTF-8 sequences.
 */
export function decodeQuotedPrintableUtf8(input: string): string {
  const cleaned = input.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(cleaned.slice(i + 1, i + 3))) {
      bytes.push(parseInt(cleaned.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      const charBytes = Buffer.from(cleaned[i], "utf-8");
      for (const b of charBytes) {
        bytes.push(b);
      }
    }
  }
  return Buffer.from(bytes).toString("utf-8").trim();
}

/**
 * Prevent SSRF against loopback, link-local, or private network addresses.
 */
export function isUnsafeMailHost(rawHost: string): boolean {
  if (!rawHost || typeof rawHost !== "string") return true;
  const host = rawHost.trim().toLowerCase();
  if (!host || host.includes("/") || host.includes("\\") || host.includes("@") || host.includes(" ")) {
    return true;
  }
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return true;
  }
  // Check IPv4 private / loopback / link-local ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return true;
    }
  }
  // Check IPv6 private/loopback prefixes
  if (host.includes(":") || host.startsWith("[")) {
    const cleanV6 = host.replace(/^\[|\]$/g, "");
    if (
      cleanV6 === "::1" ||
      cleanV6 === "::" ||
      cleanV6.startsWith("fc") ||
      cleanV6.startsWith("fd") ||
      cleanV6.startsWith("fe80")
    ) {
      return true;
    }
  }
  return false;
}

function createClient(config: ImapConfig): ImapFlow {
  if (isUnsafeMailHost(config.host)) {
    throw new Error("Servidor de correo no permitido");
  }
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.ssl,
    auth: {
      user: config.email,
      pass: config.password,
    },
    logger: false as any,
  });
}

export async function testConnection(config: ImapConfig): Promise<{ success: boolean; error?: string }> {
  if (isUnsafeMailHost(config.host)) {
    return { success: false, error: "Servidor de correo no permitido" };
  }
  const client = createClient(config);
  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Connection failed" };
  }
}

export async function fetchInbox(
  config: ImapConfig,
  folder: string = "INBOX",
  limit: number = 50
): Promise<ImapEmail[]> {
  const client = createClient(config);
  const emails: ImapEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const total =
        client.mailbox && typeof client.mailbox === "object" && "exists" in client.mailbox
          ? Number(client.mailbox.exists)
          : -1;

      if (total === 0) {
        return [];
      }

      const startSeq = total > 0 ? Math.max(1, total - limit + 1) : 1;
      const messages = client.fetch(
        { seq: `${startSeq}:*` },
        { envelope: true, flags: true },
        { uid: true }
      );

      const allEmails: ImapEmail[] = [];

      for await (const msg of messages) {
        const env = msg.envelope;
        const fromAddr = env?.from?.[0]
          ? `${env.from[0].name ? env.from[0].name + " " : ""}<${env.from[0].address}>`
          : "Unknown";
        allEmails.push({
          id: String(msg.uid),
          from: fromAddr,
          subject: env?.subject || "(Sin asunto)",
          date: env?.date?.toISOString() || new Date().toISOString(),
          read: Boolean(msg.flags?.has("\\Seen")),
          snippet: "",
        });
      }

      // Take the last `limit` (most recent)
      const recent = allEmails.slice(-limit).reverse();

      // Fetch snippet for each
      for (const email of recent) {
        try {
          const { content } = await client.download(String(email.id), "1", {
            uid: true,
          });
          if (content) {
            const chunks: Buffer[] = [];
            for await (const chunk of content) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            const text = Buffer.concat(chunks).toString("utf-8");
            const cleanText = text
              .replace(/<[^>]*>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            email.snippet = cleanText.slice(0, 150);
          }
        } catch {
          email.snippet = "";
        }
      }

      emails.push(...recent);
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err: any) {
    if (!err.message?.includes("Not connected")) {
      throw err;
    }
  }

  return emails;
}

export async function fetchEmail(
  config: ImapConfig,
  uid: string,
  folder: string = "INBOX"
): Promise<ImapEmailDetail | null> {
  const client = createClient(config);

  try {
    await client.connect();
    const lock = await client.getMailboxLock(folder);

    try {
      const msg = await client.fetchOne(
        String(uid),
        { envelope: true, flags: true, source: true },
        { uid: true }
      );

      if (!msg) return null;

      const env = msg.envelope;
      const fromAddr = env?.from?.[0]
        ? `${env.from[0].name ? env.from[0].name + " " : ""}<${env.from[0].address}>`
        : "Unknown";
      const toAddr = env?.to?.[0]
        ? `${env.to[0].name ? env.to[0].name + " " : ""}<${env.to[0].address}>`
        : "";

      const source = msg.source?.toString("utf-8") || "";

      let body = source;
      let html = "";

      const htmlMatch = source.match(/Content-Type:\s*text\/html[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|$)/i);
      if (htmlMatch) {
        html = htmlMatch[1];
      }

      const textMatch = source.match(/Content-Type:\s*text\/plain[\s\S]*?\r\n\r\n([\s\S]*?)(?=\r\n--|$)/i);
      if (textMatch) {
        body = textMatch[1];
      }

      body = decodeQuotedPrintableUtf8(body);
      html = decodeQuotedPrintableUtf8(html);

      return {
        id: String(uid),
        from: fromAddr,
        subject: env?.subject || "(Sin asunto)",
        date: env?.date?.toISOString() || new Date().toISOString(),
        read: Boolean(msg.flags?.has("\\Seen")),
        snippet: body.slice(0, 150),
        to: toAddr,
        body: html || body,
        html: html || undefined,
      };
    } finally {
      lock.release();
    }
  } catch (err: any) {
    if (!err.message?.includes("Not connected")) {
      throw err;
    }
  }

  return null;
}
