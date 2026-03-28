import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

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
