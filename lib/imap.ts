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

function createClient(config: ImapConfig): ImapFlow {
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
      const messages = client.fetch(
        { seq: "*" },
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
          read: !msg.flags?.has("\\Seen"),
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

      body = body
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .trim();

      html = html
        .replace(/=\r?\n/g, "")
        .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .trim();

      return {
        id: String(uid),
        from: fromAddr,
        subject: env?.subject || "(Sin asunto)",
        date: env?.date?.toISOString() || new Date().toISOString(),
        read: !msg.flags?.has("\\Seen"),
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
