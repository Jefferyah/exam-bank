import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFromR2 } from "@/lib/r2";

// GET /api/upload/[id] — Serve an uploaded image
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const image = await prisma.uploadedImage.findUnique({ where: { id } });
    if (!image) {
      return NextResponse.json({ error: "圖片不存在" }, { status: 404 });
    }

    const { body, contentType } = await getFromR2(image.r2Key);

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Image fetch error:", err);
    return NextResponse.json(
      { error: "無法取得圖片" },
      { status: 500 }
    );
  }
}
