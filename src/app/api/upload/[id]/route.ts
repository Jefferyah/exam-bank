import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFromR2, isImageMimeType } from "@/lib/r2";

// GET /api/upload/[id] — Serve an uploaded image or file
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await prisma.uploadedImage.findUnique({ where: { id } });
    if (!image) {
      return NextResponse.json({ error: "檔案不存在" }, { status: 404 });
    }

    const { body, contentType } = await getFromR2(image.r2Key);

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    };

    // For non-image files, force download with original filename
    if (!isImageMimeType(image.mimeType)) {
      const encodedFilename = encodeURIComponent(image.filename);
      headers["Content-Disposition"] = `attachment; filename="${image.filename}"; filename*=UTF-8''${encodedFilename}`;
    }

    return new NextResponse(Buffer.from(body), { headers });
  } catch (err) {
    console.error("File fetch error:", err);
    return NextResponse.json(
      { error: "無法取得檔案" },
      { status: 500 }
    );
  }
}
