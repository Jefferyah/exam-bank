"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";
import { setKnowledgeNavList } from "@/lib/knowledge-nav";

type SizeMetric = "questionCount" | "wordCount";

interface TagData {
  tag: string;
  questionCount: number;
  wordCount: number;
  accuracy: number | null; // 0-100, null = no data
  hasEntry: boolean;
  updatedAt: string | null;
}

interface TagLink {
  source: string;
  target: string;
  weight?: number;
}

interface CustomEntry {
  tag: string;
  wordCount: number;
  updatedAt: string;
}

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<TagData[]>([]);
  const [links, setLinks] = useState<TagLink[]>([]);
  const [customEntries, setCustomEntries] = useState<CustomEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [newTag, setNewTag] = useState("");
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("wordCount");
  const [masteryFilter, setMasteryFilter] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/knowledge")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.tags) setTags(data.tags);
        if (data?.links) setLinks(data.links);
        if (data?.customEntries) setCustomEntries(data.customEntries);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const getMasteryLevel = (accuracy: number | null): string => {
    if (accuracy === null) return "none";
    if (accuracy < 60) return "low";
    if (accuracy < 85) return "mid";
    return "high";
  };

  // Merge custom entries into tags for unified display
  const allTagData: TagData[] = [
    ...tags,
    ...customEntries.map((e) => ({
      tag: e.tag,
      questionCount: 0,
      wordCount: e.wordCount,
      accuracy: null,
      hasEntry: true,
      updatedAt: e.updatedAt,
    })),
  ];

  const filteredTags = allTagData.filter((t) => {
    if (!t.tag.toLowerCase().includes(search.toLowerCase())) return false;
    if (masteryFilter && getMasteryLevel(t.accuracy) !== masteryFilter) return false;
    return true;
  });

  const filteredCustom = customEntries.filter((e) =>
    e.tag.toLowerCase().includes(search.toLowerCase())
  );

  // Store nav list whenever filtered tags change
  useEffect(() => {
    const sorted = [...filteredTags]
      .filter((t) => t.wordCount > 0)
      .sort((a, b) =>
        sizeMetric === "wordCount" ? b.wordCount - a.wordCount : b.questionCount - a.questionCount
      );
    setKnowledgeNavList(sorted.map((t) => t.tag));
  }, [filteredTags, sizeMetric]);

  const handleCreateEntry = async () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    // Check for duplicates — navigate to existing tag (preserving original casing)
    const existingTag = tags.find((t) => t.tag.toLowerCase() === trimmed.toLowerCase());
    const existingCustom = customEntries.find((e) => e.tag.toLowerCase() === trimmed.toLowerCase());
    const existingName = existingTag?.tag ?? existingCustom?.tag;
    if (existingName) {
      setNewTag("");
      router.push(`/knowledge/${encodeURIComponent(existingName)}`);
      return;
    }
    // Create empty entry in DB so it appears in custom entries list
    await fetch(`/api/knowledge/${encodeURIComponent(trimmed)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });
    setNewTag("");
    router.push(`/knowledge/${encodeURIComponent(trimmed)}`);
  };

  // Accuracy → color mapping (grey=no data, red→yellow→green)
  const getAccuracyColor = useCallback((accuracy: number | null, alpha: number) => {
    if (accuracy === null) return `rgba(156, 163, 175, ${alpha})`;
    // Red (0%) → Orange (50%) → Green (100%)
    const h = (accuracy / 100) * 120; // 0=red, 60=yellow, 120=green
    const s = 70;
    const l = alpha < 0.3 ? 55 : 45; // fill lighter, stroke darker
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }, []);

  // Bubble chart
  const renderBubbles = useCallback(() => {
    if (!svgRef.current || !containerRef.current || filteredTags.length === 0) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = Math.max(400, Math.min(600, width * 0.6));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const sizeValue = (d: TagData) =>
      sizeMetric === "wordCount" ? d.wordCount : d.questionCount;

    const maxVal = d3.max(filteredTags, sizeValue) || 1;
    const radiusScale = d3
      .scaleSqrt()
      .domain([0, maxVal])
      .range([20, Math.min(80, width / 8)]);

    // Sort by size descending so largest initializes closest to center
    const sortedTags = [...filteredTags].sort((a, b) => sizeValue(b) - sizeValue(a));

    const nodes = sortedTags.map((d, i) => {
      const r = radiusScale(Math.max(sizeValue(d), 1));
      const angle = (i / sortedTags.length) * Math.PI * 2;
      const dist = (i / sortedTags.length) * Math.min(width, height) * 0.35;
      return {
        ...d,
        index: i,
        r,
        x: width / 2 + Math.cos(angle) * dist,
        y: height / 2 + Math.sin(angle) * dist,
        fx: null as number | null,
        fy: null as number | null,
      };
    });

    // Larger bubbles get much stronger pull toward center
    const maxR = d3.max(nodes, (d) => d.r) || 1;

    // Build link data — map tag names to node indices
    const nodeIndex = new Map(nodes.map((n, i) => [n.tag, i]));
    const filteredTagSet = new Set(filteredTags.map((t) => t.tag));
    const graphLinks = links
      .filter((l) => filteredTagSet.has(l.source) && filteredTagSet.has(l.target))
      .map((l) => ({ source: nodeIndex.get(l.source)!, target: nodeIndex.get(l.target)!, weight: l.weight ?? 1 }))
      .filter((l) => l.source !== undefined && l.target !== undefined);

    // Track which nodes have links so we can weaken radial force on them
    const linkedNodeIndices = new Set<number>();
    for (const l of graphLinks) {
      linkedNodeIndices.add(l.source);
      linkedNodeIndices.add(l.target);
    }

    const simulation = d3
      .forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-2)) // slight repulsion to prevent overlap
      .force(
        "collide",
        d3.forceCollide<(typeof nodes)[0]>().radius((d) => d.r + 3).strength(0.8)
      )
      // Radial force: large bubbles target center (dist=0), small ones pushed outward
      .force(
        "radial",
        d3.forceRadial<(typeof nodes)[0]>(
          (d) => {
            const ratio = d.r / maxR;
            const maxDist = Math.min(width, height) * 0.35;
            // Top 30% of sizes → near center; small ones → pushed to edge
            return maxDist * Math.pow(1 - ratio, 2);
          },
          width / 2,
          height / 2
        ).strength((d) => {
          if (linkedNodeIndices.has(d.index ?? -1)) return 0.03;
          const ratio = d.r / maxR;
          // Very strong for large bubbles (up to 1.0), weak for small ones
          return 0.05 + ratio * ratio * 0.95;
        })
      )
      // Center pull: largest bubbles get very strong centering
      .force("x", d3.forceX<(typeof nodes)[0]>(width / 2).strength((d) => {
        const ratio = d.r / maxR;
        return 0.005 + Math.pow(ratio, 3) * 0.8;
      }))
      .force("y", d3.forceY<(typeof nodes)[0]>(height / 2).strength((d) => {
        const ratio = d.r / maxR;
        return 0.005 + Math.pow(ratio, 3) * 0.8;
      }));

    // Add link force if there are connections
    // Note: d3.forceLink mutates source/target from indices to node objects
    if (graphLinks.length > 0) {
      simulation.force(
        "link",
        d3.forceLink(graphLinks)
          .distance((l) => {
            const s = (l as any).source;
            const t = (l as any).target;
            return ((s?.r ?? 30) + (t?.r ?? 30) + 2);
          })
          .strength(2)
          .iterations(4)
      );
    }

    // Drag behavior
    let dragStartX = 0, dragStartY = 0;
    const drag = d3.drag<SVGGElement, (typeof nodes)[0]>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
        dragStartX = event.x;
        dragStartY = event.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        // Only navigate if it was a click (not a drag)
        const dx = event.x - dragStartX;
        const dy = event.y - dragStartY;
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
          router.push(`/knowledge/${encodeURIComponent(d.tag)}`);
        }
      });

    // Draw link lines (behind nodes)
    const linkGroup = svg
      .selectAll<SVGLineElement, (typeof graphLinks)[0]>("line.wiki-edge")
      .data(graphLinks)
      .join("line")
      .attr("class", "wiki-edge")
      .attr("stroke", (d) => {
        const w = (d as any).weight ?? 1;
        const opacity = Math.min(0.15 + w * 0.08, 0.45);
        return `rgba(139, 92, 246, ${opacity})`;
      })
      .attr("stroke-width", (d) => {
        const w = (d as any).weight ?? 1;
        return Math.min(1.5 + w * 1, 6);
      });

    type NodeType = (typeof nodes)[0];
    const nodeGroup = svg
      .selectAll<SVGGElement, NodeType>("g")
      .data(nodes)
      .join("g")
      .style("cursor", "grab")
      .call(drag);

    // Opaque backing circle to occlude lines passing behind bubbles
    nodeGroup
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", "var(--bubble-bg, white)")
      .attr("stroke", "none");

    // Circles — color by accuracy
    nodeGroup
      .append("circle")
      .attr("r", (d) => d.r)
      .attr("fill", (d) => getAccuracyColor(d.accuracy, 0.15))
      .attr("stroke", (d) => getAccuracyColor(d.accuracy, 0.5))
      .attr("stroke-width", 1.5)
      .on("mouseenter", function (_event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", getAccuracyColor(d.accuracy, 0.3))
          .attr("stroke", getAccuracyColor(d.accuracy, 0.7));
      })
      .on("mouseleave", function (_event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr("fill", getAccuracyColor(d.accuracy, 0.15))
          .attr("stroke", getAccuracyColor(d.accuracy, 0.5));
      });

    // Tag name
    nodeGroup
      .append("text")
      .text((d) => (d.tag.length > Math.floor(d.r / 6) ? d.tag.slice(0, Math.floor(d.r / 6)) + "…" : d.tag))
      .attr("text-anchor", "middle")
      .attr("dy", "-0.2em")
      .attr("fill", "currentColor")
      .attr("class", "text-gray-700 dark:text-gray-300")
      .style("font-size", (d) => `${Math.max(10, Math.min(14, d.r / 3))}px`)
      .style("font-weight", "500")
      .style("pointer-events", "none");

    // Sub label
    nodeGroup
      .append("text")
      .text((d) => {
        if (sizeMetric === "wordCount") return d.wordCount > 0 ? `${d.wordCount} 字` : "";
        return `${d.questionCount} 題`;
      })
      .attr("text-anchor", "middle")
      .attr("dy", "1.1em")
      .attr("fill", "currentColor")
      .attr("class", "text-gray-400 dark:text-gray-500")
      .style("font-size", (d) => `${Math.max(9, Math.min(11, d.r / 4))}px`)
      .style("pointer-events", "none");

    // Accuracy badge (if has data)
    nodeGroup
      .filter((d) => d.accuracy !== null)
      .append("text")
      .text((d) => `${d.accuracy}%`)
      .attr("text-anchor", "middle")
      .attr("dy", "2.4em")
      .attr("fill", (d) => getAccuracyColor(d.accuracy, 0.8))
      .style("font-size", (d) => `${Math.max(8, Math.min(10, d.r / 4.5))}px`)
      .style("font-weight", "600")
      .style("pointer-events", "none");

    // Has entry indicator
    nodeGroup
      .filter((d) => d.hasEntry)
      .append("circle")
      .attr("cx", (d) => d.r * 0.6)
      .attr("cy", (d) => -d.r * 0.6)
      .attr("r", 4)
      .attr("fill", "#3b82f6");

    simulation.on("tick", () => {
      // Draw lines from circle edge (not center) by offsetting by radius along the line direction
      linkGroup
        .attr("x1", (d) => {
          const s = (d as any).source, t = (d as any).target;
          const dx = t.x - s.x, dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return s.x + (dx / dist) * (s.r ?? 0);
        })
        .attr("y1", (d) => {
          const s = (d as any).source, t = (d as any).target;
          const dx = t.x - s.x, dy = t.y - s.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return s.y + (dy / dist) * (s.r ?? 0);
        })
        .attr("x2", (d) => {
          const s = (d as any).source, t = (d as any).target;
          const dx = s.x - t.x, dy = s.y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return t.x + (dx / dist) * (t.r ?? 0);
        })
        .attr("y2", (d) => {
          const s = (d as any).source, t = (d as any).target;
          const dx = s.x - t.x, dy = s.y - t.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          return t.y + (dy / dist) * (t.r ?? 0);
        });
      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredTags, links, router, sizeMetric, getAccuracyColor]);

  useEffect(() => {
    let currentCleanup = renderBubbles();
    const handleResize = () => {
      currentCleanup?.();
      currentCleanup = renderBubbles();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      currentCleanup?.();
      window.removeEventListener("resize", handleResize);
    };
  }, [renderBubbles]);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-10 w-full bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-[400px] bg-gray-50 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header + Create */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            知識庫
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            點擊知識點，開始撰寫你的學習筆記
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateEntry()}
            placeholder="新增知識主題..."
            className="w-48 sm:w-56 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-300"
          />
          <button
            onClick={handleCreateEntry}
            disabled={!newTag.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold tracking-wide transition-all bg-gradient-to-r from-purple-500 to-violet-500 dark:from-purple-500 dark:to-violet-500 text-white hover:from-purple-600 hover:to-violet-600 dark:hover:from-purple-400 dark:hover:to-violet-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
          >
            建立
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋知識點..."
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
        />
      </div>

      {/* Controls: size metric toggle + legend */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setSizeMetric("questionCount")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              sizeMetric === "questionCount"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            依題數
          </button>
          <button
            onClick={() => setSizeMetric("wordCount")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              sizeMetric === "wordCount"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            依筆記字數
          </button>
        </div>
        <div className="flex items-center gap-1 text-xs">
          {([
            { key: "low", color: "hsla(0, 70%, 55%, 0.4)", label: "低掌握" },
            { key: "mid", color: "hsla(60, 70%, 55%, 0.4)", label: "中掌握" },
            { key: "high", color: "hsla(120, 70%, 55%, 0.4)", label: "高掌握" },
            { key: "none", color: "rgba(156, 163, 175, 0.3)", label: "無作答" },
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setMasteryFilter(masteryFilter === item.key ? null : item.key)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all ${
                masteryFilter === item.key
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  : masteryFilter === null
                    ? "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    : "text-gray-300 dark:text-gray-600 hover:text-gray-500"
              }`}
            >
              <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom knowledge entries */}
      {filteredCustom.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-purple-500 dark:text-purple-400 uppercase tracking-wider">
            自訂知識點
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filteredCustom.map((e) => (
              <button
                key={e.tag}
                onClick={() => router.push(`/knowledge/${encodeURIComponent(e.tag)}`)}
                className="relative flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all hover:shadow-sm bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 overflow-hidden"
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-400 to-violet-500" />
                <span className="text-sm font-medium truncate text-purple-700 dark:text-purple-300 pl-1">
                  {e.tag}
                </span>
                <span className="text-xs text-purple-400 dark:text-purple-500 ml-2 flex-shrink-0">
                  {e.wordCount} 字
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bubble Chart */}
      {filteredTags.length > 0 ? (
        <div
          ref={containerRef}
          className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm overflow-hidden [--bubble-bg:white] dark:[--bubble-bg:#1f2937]"
        >
          <svg ref={svgRef} className="w-full" />
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-12 shadow-sm text-center">
          <p className="text-gray-400 dark:text-gray-500">
            {search ? "找不到符合的知識點" : "尚無知識點，請先到題庫新增題目並設定標籤"}
          </p>
        </div>
      )}

      {/* Tag List (fallback / mobile-friendly) */}
      {filteredTags.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            所有知識點
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {[...filteredTags].sort((a, b) =>
              sizeMetric === "wordCount"
                ? b.wordCount - a.wordCount
                : b.questionCount - a.questionCount
            ).map((t) => (
              <button
                key={t.tag}
                onClick={() =>
                  router.push(`/knowledge/${encodeURIComponent(t.tag)}`)
                }
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-all hover:shadow-sm ${
                  t.hasEntry
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200"
                }`}
              >
                <span
                  className={`text-sm font-medium truncate ${
                    t.hasEntry
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {t.tag}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">
                  {sizeMetric === "wordCount"
                    ? (t.wordCount > 0 ? `${t.wordCount} 字` : "")
                    : t.questionCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
