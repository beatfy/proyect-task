import { put, del } from "@vercel/blob";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import path from "path";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

export interface StoredFileResult {
  url: string;
  storageType: "vercel-blob" | "local";
  size: number;
}

function shouldUseVercelBlob(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Unified storage service that uses @vercel/blob when BLOB_READ_WRITE_TOKEN
 * is configured, and falls back to local disk (`uploads/`) for self-hosted/Docker deployments.
 */
export async function storeFile(
  scope: "tasks" | "documents" | "contracts",
  entityId: string,
  filename: string,
  content: Buffer | Uint8Array,
  publicUrlPrefix: string
): Promise<StoredFileResult> {
  const safeEntityId = path.basename(entityId);
  const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

  if (shouldUseVercelBlob()) {
    const key = `${scope}/${safeEntityId}/${safeFilename}`;
    const blob = await put(key, buffer, { access: "private" });
    return {
      url: blob.url,
      storageType: "vercel-blob",
      size: buffer.byteLength,
    };
  }

  const targetDir = path.join(UPLOAD_ROOT, scope, safeEntityId);
  await mkdir(targetDir, { recursive: true });
  const filePath = path.join(targetDir, safeFilename);
  await writeFile(filePath, buffer);

  const normalizedPrefix = publicUrlPrefix.replace(/\/$/, "");
  return {
    url: `${normalizedPrefix}/${safeEntityId}/${safeFilename}`,
    storageType: "local",
    size: buffer.byteLength,
  };
}

export async function deleteStoredFile(
  fileUrl: string,
  localFallbackPath?: { scope: "tasks" | "documents" | "contracts"; entityId: string; filename: string }
): Promise<void> {
  if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://")) {
    if (shouldUseVercelBlob()) {
      await del(fileUrl).catch(() => {});
      return;
    }
  }

  if (localFallbackPath) {
    const safeEntityId = path.basename(localFallbackPath.entityId);
    const safeFilename = path.basename(localFallbackPath.filename);
    const fullPath = path.join(UPLOAD_ROOT, localFallbackPath.scope, safeEntityId, safeFilename);
    await unlink(fullPath).catch(() => {});
  }
}

export async function readLocalStoredFile(
  scope: "tasks" | "documents" | "contracts",
  entityId: string,
  filename: string
): Promise<Buffer> {
  const safeEntityId = path.basename(entityId);
  const safeFilename = path.basename(filename);
  const fullPath = path.join(UPLOAD_ROOT, scope, safeEntityId, safeFilename);
  return readFile(fullPath);
}
