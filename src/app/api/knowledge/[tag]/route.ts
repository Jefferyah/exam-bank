import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { deleteFromR2 } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    // Fetch entry + backlinks in parallel
    const [entry, allEntries] = await Promise.all([
      prisma.knowledgeEntry.findUnique({
        where: {
          userId_tag: {
            userId: session.user.id,
            tag: decodedTag,
          },
        },
      }),
      // Phase 3: find all entries that might contain [[decodedTag]] (with possible whitespace)
      prisma.knowledgeEntry.findMany({
        where: {
          userId: session.user.id,
          content: { contains: decodedTag },
          NOT: { tag: decodedTag }, // exclude self
        },
        select: { tag: true, content: true },
      }),
    ]);

    // Parse wiki-links and trim to match consistently with the graph API
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const backlinks = allEntries
      .filter((e) => {
        wikiLinkRegex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = wikiLinkRegex.exec(e.content)) !== null) {
          if (match[1].trim() === decodedTag) return true;
        }
        return false;
      })
      .map((e) => e.tag);

    return NextResponse.json({
      tag: decodedTag,
      content: entry?.content || "",
      updatedAt: entry?.updatedAt?.toISOString() || null,
      backlinks,
    });
  } catch (error) {
    console.error("GET /api/knowledge/[tag] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch knowledge entry" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);
    const body = await req.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    const entry = await prisma.knowledgeEntry.upsert({
      where: {
        userId_tag: {
          userId: session.user.id,
          tag: decodedTag,
        },
      },
      create: {
        userId: session.user.id,
        tag: decodedTag,
        content,
      },
      update: { content },
    });

    return NextResponse.json({
      tag: entry.tag,
      content: entry.content,
      updatedAt: entry.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("PUT /api/knowledge/[tag] error:", error);
    return NextResponse.json(
      { error: "Failed to save knowledge entry" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);

    // Find orphan attachments before deleting
    const attachments = await prisma.uploadedImage.findMany({
      where: { userId: session.user.id, tag: decodedTag },
      select: { id: true, r2Key: true },
    });

    // Delete entry + attachment records in transaction
    await prisma.$transaction([
      prisma.knowledgeEntry.deleteMany({
        where: { userId: session.user.id, tag: decodedTag },
      }),
      prisma.uploadedImage.deleteMany({
        where: { userId: session.user.id, tag: decodedTag },
      }),
    ]);

    // Clean up R2 files (best-effort, don't block response)
    if (attachments.length > 0) {
      Promise.allSettled(attachments.map((a) => deleteFromR2(a.r2Key))).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/knowledge/[tag] error:", error);
    return NextResponse.json(
      { error: "Failed to delete knowledge entry" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tag: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { tag } = await params;
    const decodedTag = decodeURIComponent(tag);
    const body = await req.json();
    const { newTag } = body;

    if (!newTag || typeof newTag !== "string" || !newTag.trim()) {
      return NextResponse.json({ error: "newTag is required" }, { status: 400 });
    }

    const trimmedNew = newTag.trim();

    // Check if target tag already exists
    const existing = await prisma.knowledgeEntry.findUnique({
      where: { userId_tag: { userId: session.user.id, tag: trimmedNew } },
    });
    if (existing) {
      return NextResponse.json({ error: "該知識點名稱已存在" }, { status: 409 });
    }

    // Update entry + migrate attachments in a transaction
    await prisma.$transaction([
      prisma.knowledgeEntry.update({
        where: { userId_tag: { userId: session.user.id, tag: decodedTag } },
        data: { tag: trimmedNew },
      }),
      prisma.uploadedImage.updateMany({
        where: { userId: session.user.id, tag: decodedTag },
        data: { tag: trimmedNew },
      }),
    ]);

    return NextResponse.json({ ok: true, newTag: trimmedNew });
  } catch (error) {
    console.error("PATCH /api/knowledge/[tag] error:", error);
    return NextResponse.json(
      { error: "Failed to rename knowledge entry" },
      { status: 500 }
    );
  }
}
