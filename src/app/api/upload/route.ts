import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToR2, validateImage } from "@/lib/r2";
import { randomUUID } from "crypto";

// POST /api/upload — Upload an image
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "缺少圖片檔案" }, { status: 400 });
    }

    // Validate image
    const validationError = validateImage(file.size, file.type);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Determine extension from MIME type
    const extMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "image/webp": "webp",
      "image/svg+xml": "svg",
    };
    const ext = extMap[file.type] || "png";
    const r2Key = `images/${session.user.id}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    await uploadToR2(r2Key, buffer, file.type);

    // Save to DB
    const image = await prisma.uploadedImage.create({
      data: {
        filename: file.name || `image.${ext}`,
        r2Key,
        size: file.size,
        mimeType: file.type,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      { id: image.id, url: `/api/upload/${image.id}` },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "圖片上傳失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
