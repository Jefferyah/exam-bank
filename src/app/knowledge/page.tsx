"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as d3 from "d3";

type SizeMetric = "questionCount" | "wordCount";

interface TagData {
  tag: string;
  questionCount: number;
  wordCount: number;
  accuracy: number | null; // 0-100, null = no data
  hasEntry: boolean;
  updatedAt: string | null;
}

export default function KnowledgePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("questionCount");
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
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const filteredTags = tags.filter((t) =>
    t.tag.toLowerCase().includes(search.toLowerCase())
  );

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

    const nodes = filteredTags.map((d) => ({
      ...d,
      r: radiusScale(Math.max(sizeValue(d), 1)),
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height / 2 + (Math.random() - 0.5) * height * 0.3,
    }));

    // Larger bubbles get stronger pull toward center
    const maxR = d3.max(nodes, (d) => d.r) || 1;

    const simulation = d3
      .forceSimulation(nodes)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("charge", d3.forceManyBody().strength(2))
      .force(
        "collide",
        d3.forceCollide<(typeof nodes)[0]>().radius((d) => d.r + 3).strength(0.8)
      )
      .force("x", d3.forceX<(typeof nodes)[0]>(width / 2).strength((d) => 0.03 + 0.07 * (d.r / maxR)))
      .force("y", d3.forceY<(typeof nodes)[0]>(height / 2).strength((d) => 0.03 + 0.07 * (d.r / maxR)));

    const nodeGroup = svg
      .selectAll("g")
      .data(nodes)
      .join("g")
      .style("cursor", "pointer")
      .on("click", (_event, d) => {
        router.push(`/knowledge/${encodeURIComponent(d.tag)}`);
      });

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
        if (sizeMetric === "wordCount") return d.wordCount > 0 ? `${d.wordCount} 字` : "未撰寫";
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
      nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredTags, router, sizeMetric, getAccuracyColor]);

  useEffect(() => {
    const cleanup = renderBubbles();
    const handleResize = () => renderBubbles();
    window.addEventListener("resize", handleResize);
    return () => {
      cleanup?.();
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          知識庫
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          點擊知識點，開始撰寫你的學習筆記
        </p>
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
        <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "hsla(0, 70%, 55%, 0.4)" }} />
            低掌握
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "hsla(60, 70%, 55%, 0.4)" }} />
            中掌握
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "hsla(120, 70%, 55%, 0.4)" }} />
            高掌握
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "rgba(156, 163, 175, 0.3)" }} />
            無作答
          </span>
        </div>
      </div>

      {/* Bubble Chart */}
      {filteredTags.length > 0 ? (
        <div
          ref={containerRef}
          className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm overflow-hidden"
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
            {filteredTags.map((t) => (
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
                  {t.questionCount}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
