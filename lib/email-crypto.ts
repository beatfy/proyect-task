import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";

// In-memory fallback key for when EMAIL_ENCRYPTION_KEY is not set.
// Derives deterministically from NEXTAUTH_SECRET if available, otherwise generates once per process.
let _fallbackKey: string | null = null;

function getFallbackKey(): string {
  if (!_fallbackKey) {
    const authSecret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (authSecret) {
      _fallbackKey = crypto.createHash("sha256").update(authSecret).digest("hex").slice(0, 32);
    } else {
      _fallbackKey = crypto.randomBytes(32).toString("hex").slice(0, 32);
    }
    console.warn(
      "[email-crypto] EMAIL_ENCRYPTION_KEY not set. Using fallback key. " +
      "Set EMAIL_ENCRYPTION_KEY in your environment for dedicated encryption key management."
    );
  }
  return _fallbackKey;
}

function getKey(): Buffer {
  const key = process.env.EMAIL_ENCRYPTION_KEY || getFallbackKey();
  // Ensure the key is exactly 32 bytes for AES-256
  const buf = Buffer.from(key.padEnd(32, " "), "utf-8");
  if (buf.length === 32) {
    return buf;
  }
  const fixed = Buffer.alloc(32);
  buf.copy(fixed, 0, 0, 32);
  return fixed;
}

export function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf-8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(encryptedText: string): string {
  const key = getKey();
  const parts = encryptedText.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf-8");
  decrypted += decipher.final("utf-8");
  return decrypted;
}
