import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToR2, validateImage, validateFile, isImageMimeType, MAX_FILES_PER_TAG } from "@/lib/r2";
import { randomUUID } from "crypto";

// GET /api/upload?countTag=xxx — Get file count for a tag
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const countTag = req.nextUrl.searchParams.get("countTag");
    if (!countTag) {
      return NextResponse.json({ error: "Missing countTag" }, { status: 400 });
    }

    const count = await prisma.uploadedImage.count({
      where: {
        userId: session.user.id,
        tag: { equals: countTag, mode: "insensitive" },
        isImage: false,
      },
    });

    return NextResponse.json({ count });
  } catch (err) {
    console.error("File count error:", err);
    return NextResponse.json({ error: "查詢失敗" }, { status: 500 });
  }
}

// POST /api/upload — Upload an image or file
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "缺少檔案" }, { status: 400 });
    }

    const tag = req.nextUrl.searchParams.get("tag") || undefined;
    const isImage = isImageMimeType(file.type);

    // Validate based on type
    if (isImage) {
      const validationError = validateImage(file.size, file.type);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    } else {
      const validationError = validateFile(file.size, file.type);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      // Check per-tag file count limit for non-image files
      if (tag) {
        const fileCount = await prisma.uploadedImage.count({
          where: {
            userId: session.user.id,
            tag: { equals: tag, mode: "insensitive" },
            isImage: false,
          },
        });
        if (fileCount >= MAX_FILES_PER_TAG) {
          return NextResponse.json(
            { error: `每個知識頁面最多只能上傳 ${MAX_FILES_PER_TAG} 個檔案` },
            { status: 400 }
          );
        }
      }
    }

    // Determine extension and R2 key
    let ext: string;
    let r2Key: string;

    if (isImage) {
      const extMap: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
      };
      ext = extMap[file.type] || "png";
      r2Key = `images/${session.user.id}/${randomUUID()}.${ext}`;
    } else {
      // Extract extension from original filename
      const nameParts = (file.name || "file").split(".");
      ext = nameParts.length > 1 ? nameParts.pop()! : "bin";
      r2Key = `files/${session.user.id}/${randomUUID()}.${ext}`;
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadToR2(r2Key, buffer, file.type);

    // Save to DB
    const record = await prisma.uploadedImage.create({
      data: {
        filename: file.name || (isImage ? `image.${ext}` : `file.${ext}`),
        r2Key,
        size: file.size,
        mimeType: file.type,
        userId: session.user.id,
        tag: tag || null,
        isImage,
      },
    });

    return NextResponse.json(
      {
        id: record.id,
        url: `/api/upload/${record.id}`,
        type: isImage ? "image" : "file",
        filename: record.filename,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "檔案上傳失敗，請稍後再試" },
      { status: 500 }
    );
  }
}
