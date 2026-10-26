/**
 * Small JSON store. On Netlify it uses Netlify Blobs (store "tss-delivery").
 * On a laptop it writes files under ./.data so `npm run dev` works with no setup.
 */
import { promises as fs } from "fs";
import path from "path";

const STORE = "tss-delivery";
const LOCAL_DIR = path.join(process.cwd(), ".data");

function onNetlify(): boolean {
  return process.env.NETLIFY === "true" || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE, consistency: "strong" });
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    if (onNetlify()) {
      const value = (await (await blobStore()).get(key, { type: "json" })) as T | null;
      return value ?? fallback;
    }
    const raw = await fs.readFile(path.join(LOCAL_DIR, key), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  if (onNetlify()) {
    await (await blobStore()).setJSON(key, value);
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(`${file}.tmp`, JSON.stringify(value, null, 2));
  await fs.rename(`${file}.tmp`, file);
}

/** Read, change and save one key. Last write wins; fine for a handful of dispatchers. */
export async function updateJSON<T>(key: string, fallback: T, change: (current: T) => T): Promise<T> {
  const next = change(await readJSON(key, fallback));
  await writeJSON(key, next);
  return next;
}

export async function writeFile(key: string, data: ArrayBuffer, contentType: string): Promise<void> {
  if (onNetlify()) {
    await (await blobStore()).set(key, data, { metadata: { contentType } });
    return;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, Buffer.from(data));
  await fs.writeFile(`${file}.type`, contentType);
}

export async function readFile(key: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  try {
    if (onNetlify()) {
      const store = await blobStore();
      const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (!result) return null;
      return { data: result.data, contentType: String(result.metadata?.contentType ?? "image/jpeg") };
    }
    const file = path.join(LOCAL_DIR, key);
    const data = await fs.readFile(file);
    const contentType = await fs.readFile(`${file}.type`, "utf8").catch(() => "image/jpeg");
    return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, contentType };
  } catch {
    return null;
  }
}
