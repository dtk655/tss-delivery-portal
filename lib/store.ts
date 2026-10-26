/**
 * Small JSON store. On Netlify it uses Netlify Blobs (store "tss-delivery").
 * On a laptop it writes files under ./.data so `npm run dev` works with no setup.
 *
 * Reads and writes must open the same site-wide store. getStore() with no region
 * uses us-east-2; passing a region would look at a different, empty copy.
 */
import { promises as fs } from "fs";
import path from "path";
import { runtimeFetch } from "@/lib/runtime-fetch";

const STORE = "tss-delivery";
const LOCAL_DIR = path.join(process.cwd(), ".data");

function hosted(): boolean {
  // NETLIFY=true is a build-time variable and is often absent in the function.
  // Bracket access keeps Next from inlining these at build.
  const env = process.env;
  return env["NETLIFY"] === "true" || Boolean(env["NETLIFY_BLOBS_CONTEXT"]) || Boolean(env["SITE_ID"]);
}

async function blobStore(consistency: "strong" | "eventual" = "strong") {
  const { getStore } = await import("@netlify/blobs");
  return getStore({
    name: STORE,
    consistency,
    fetch: runtimeFetch,
  });
}

async function readBlobJSON<T>(key: string): Promise<T | null> {
  try {
    return (await (await blobStore("strong")).get(key, { type: "json" })) as T | null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Strong reads need uncachedEdgeURL. If this runtime only has the cached edge URL,
    // read the same site store with eventual consistency instead of pretending it is empty.
    if (!/uncachedEdgeURL|strong consistency/i.test(message)) throw error;
    console.error(`readJSON(${key}) strong read unavailable, retrying eventual:`, message);
    return (await (await blobStore("eventual")).get(key, { type: "json" })) as T | null;
  }
}

export async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    if (hosted()) {
      const value = await readBlobJSON<T>(key);
      return value ?? fallback;
    }
    const raw = await fs.readFile(path.join(LOCAL_DIR, key), "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`readJSON(${key}) failed:`, error instanceof Error ? error.message : error);
    return fallback;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  if (hosted()) {
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
  if (hosted()) {
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
    if (hosted()) {
      const store = await blobStore();
      const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
      if (!result) return null;
      return { data: result.data, contentType: String(result.metadata?.contentType ?? "image/jpeg") };
    }
    const file = path.join(LOCAL_DIR, key);
    const data = await fs.readFile(file);
    const contentType = await fs.readFile(`${file}.type`, "utf8").catch(() => "image/jpeg");
    return { data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer, contentType };
  } catch (error) {
    console.error(`readFile(${key}) failed:`, error instanceof Error ? error.message : error);
    return null;
  }
}
