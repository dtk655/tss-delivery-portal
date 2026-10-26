/**
 * Delivery photos. Keys are random (photos/<uuid>-n), so a link works in the customer's email
 * without a sign-in but cannot be guessed.
 */
import { readFile } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }): Promise<Response> {
  const { key } = await params;
  const path = key.map(decodeURIComponent).join("/");
  if (!/^photos\/[0-9a-f-]{36}-\d{1,2}$/.test(path)) return new Response("Not found", { status: 404 });
  const file = await readFile(path);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(file.data, {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=86400" },
  });
}
