import "server-only";
import { readFile } from "node:fs/promises";

export type StorageFile = { name: string };
export type UploadRequest = { name: string; size: number; mimeType: string };
export type UploadGrant = {
  uploadId: string;
  name: string;
  objectKey: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  expiresIn: number;
};
export type DownloadGrant = {
  name: string;
  downloadUrl: string;
  expiresIn: number;
};
export type DeleteResult = { name: string; deleted: true };

/** Route Handlers can return the error with its status; platform internals are never leaked. */
export class StorageError extends Error {
  constructor(public readonly status: number) {
    super(
      status === 409
        ? "File already exists. Please choose a different file name."
        : status === 404
          ? "File not found."
          : status === 400
            ? "Invalid file parameters."
            : `File operation failed (HTTP ${status}).`,
    );
    this.name = "StorageError";
  }
}
type WorkloadToken = { token: string; expiresAt: string };
let cached: WorkloadToken | undefined;
let refresh: Promise<WorkloadToken> | undefined;

function apiUrl() {
  const value = process.env.STORAGE_API_URL;
  if (!value) throw new Error("Platform storage is not configured");
  return value.replace(/\/$/, "");
}

async function identity(): Promise<WorkloadToken> {
  if (cached && Date.parse(cached.expiresAt) > Date.now() + 30_000)
    return cached;
  if (refresh) return refresh;
  refresh = (async () => {
    const path = process.env.STORAGE_IDENTITY_TOKEN_FILE;
    if (!path) throw new Error("Storage identity file is not configured");
    // Read at refresh time: kubelet replaces the token file automatically.
    const podToken = (await readFile(path, "utf8")).trim();
    const response = await fetch(`${apiUrl()}/storage/workload-token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${podToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok)
      throw new Error(`Storage identity exchange failed (${response.status})`);
    const result = (await response.json()) as WorkloadToken;
    if (
      !result.token ||
      !Number.isFinite(Date.parse(result.expiresAt)) ||
      Date.parse(result.expiresAt) <= Date.now()
    )
      throw new Error("Invalid storage identity response");
    cached = result;
    return result;
  })();
  try {
    return await refresh;
  } finally {
    refresh = undefined;
  }
}

async function request<T>(
  path: string,
  body?: unknown,
  method: "POST" | "DELETE" = "POST",
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const grant = await identity();
    const response = await fetch(`${apiUrl()}/storage/runtime/${path}`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${grant.token}`,
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 401 && attempt === 0) {
      cached = undefined;
      continue;
    }
    if (!response.ok) throw new StorageError(response.status);
    return (await response.json()) as T;
  }
  throw new Error("Storage authentication failed");
}

/** Requests an upload URL per the project's business rules; public upload is anonymous, no login needed. */
export function createUploadUrl(file: UploadRequest): Promise<UploadGrant> {
  return request("uploads", {
    name: file.name,
    size: file.size,
    mimeType: file.mimeType,
  });
}

// Read only the file object's name; reject bare strings or accidentally passed full object paths.
function storageEntryPath(file: StorageFile): string {
  if (
    !file ||
    typeof file.name !== "string" ||
    !file.name.trim() ||
    /[/\\]/.test(file.name)
  ) {
    throw new StorageError(400);
  }
  return `entries/${encodeURIComponent(file.name)}`;
}

/** Requests a URL only for files the current visitor may read; public files are anonymous and no content is returned. */
export function createDownloadUrl(file: StorageFile): Promise<DownloadGrant> {
  return request(`${storageEntryPath(file)}/download-url`);
}

/** Confirms deletion permission per the project's business rules first; remove the file from pages or data only after success. */
export function deleteFile(file: StorageFile): Promise<DeleteResult> {
  return request(storageEntryPath(file), undefined, "DELETE");
}

/** Confirm the completed PUT before saving the file reference in application data. */
export function confirmUpload(uploadId: string): Promise<StorageFile> {
  return request(`uploads/${encodeURIComponent(uploadId)}/confirm`);
}
