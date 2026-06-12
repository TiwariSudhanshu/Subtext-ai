import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

/**
 * Serve a file with HTTP Range support — the <video> element needs 206
 * responses to seek without downloading the whole file.
 */
export async function serveVideoFile(
  req: Request,
  filePath: string,
  options: { downloadName?: string } = {},
): Promise<Response> {
  let size: number;
  try {
    size = (await stat(filePath)).size;
  } catch {
    return Response.json({ error: "File not found" }, { status: 404 });
  }

  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
  };
  if (options.downloadName) {
    headers["Content-Disposition"] =
      `attachment; filename="${options.downloadName.replace(/[^\w.\- ]/g, "_")}"`;
  }

  const range = req.headers.get("range");
  const match = range?.match(/bytes=(\d*)-(\d*)/);

  if (match && (match[1] || match[2])) {
    const start = match[1] ? parseInt(match[1], 10) : Math.max(0, size - parseInt(match[2], 10));
    const end = match[1] && match[2] ? Math.min(parseInt(match[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      });
    }
    const stream = createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
      status: 206,
      headers: {
        ...headers,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(end - start + 1),
      },
    });
  }

  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as unknown as BodyInit, {
    status: 200,
    headers: { ...headers, "Content-Length": String(size) },
  });
}
