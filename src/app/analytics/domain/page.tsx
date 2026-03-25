"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DOMAINS, cn, DomainKey } from "@/lib/utils";

interface DomainAccuracy {
  domain: string;
  total: number;
  correct: number;
  accuracy: number;
}

export default function DomainAnalysisPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [domainAccuracy, setDomainAccuracy] = useState<DomainAccuracy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          setDomainAccuracy(data.domainAccuracy || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  async function handlePracticeDomain(domainKey: string) {
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Domain 練習 - ${DOMAINS[domainKey as DomainKey] || domainKey}`,
          domains: [domainKey],
          count: 20,
          mode: "PRACTICE",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/exam/${data.id}`);
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-slate-400">
        <p>請先登入</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          <div className="h-64 bg-slate-800 rounded-lg" />
        </div>
      </div>
    );
  }

  // Prepare all 8 domains with stats
  const domainKeys = Object.keys(DOMAINS) as DomainKey[];
  const domainMap = new Map(domainAccuracy.map((d) => [d.domain, d]));
  const allDomains = domainKeys.map((key) => ({
    key,
    label: DOMAINS[key],
    ...(domainMap.get(key) || { total: 0, correct: 0, accuracy: 0 }),
  }));

  const weakest = allDomains
    .filter((d) => d.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="text-slate-400 hover:text-white">&larr; 返回分析</Link>
        <h1 className="text-2xl font-bold">Domain 分析</h1>
      </div>

      {/* Radar-like visual using concentric rings */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Domain 總覽</h2>
        <div className="relative mx-auto" style={{ maxWidth: 400 }}>
          {/* Concentric rings background */}
          <div className="aspect-square relative">
            {[100, 80, 60, 40, 20].map((ring) => (
              <div
                key={ring}
                className="absolute border border-slate-700 rounded-full"
                style={{
                  width: `${ring}%`,
                  height: `${ring}%`,
                  top: `${(100 - ring) / 2}%`,
                  left: `${(100 - ring) / 2}%`,
                }}
              />
            ))}
            {/* Domain labels positioned around */}
            {allDomains.map((d, i) => {
              const angle = (i * 360) / allDomains.length - 90;
              const rad = (angle * Math.PI) / 180;
              const radius = 48;
              const x = 50 + radius * Math.cos(rad);
              const y = 50 + radius * Math.sin(rad);
              // Data point
              const dataRadius = d.total > 0 ? (d.accuracy / 100) * 42 : 0;
              const dx = 50 + dataRadius * Math.cos(rad);
              const dy = 50 + dataRadius * Math.sin(rad);

              return (
                <div key={d.key}>
                  {/* Label */}
                  <div
                    className="absolute text-xs text-slate-400 whitespace-nowrap transform -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${x}%`, top: `${y}%` }}
                  >
                    <span className="hidden sm:inline">D{i + 1}</span>
                    <span className="sm:hidden">D{i + 1}</span>
                  </div>
                  {/* Data point */}
                  {d.total > 0 && (
                    <div
                      className={cn(
                        "absolute w-3 h-3 rounded-full transform -translate-x-1/2 -translate-y-1/2",
                        d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ left: `${dx}%`, top: `${dy}%` }}
                      title={`${d.label}: ${d.accuracy}%`}
                    />
                  )}
                </div>
              );
            })}
            {/* Center label */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm text-slate-500">正確率 %</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-xs text-slate-400">
          {allDomains.map((d, i) => (
            <div key={d.key} className="flex items-center gap-1">
              <span className="font-medium text-indigo-300">D{i + 1}</span>
              <span className="truncate">{d.label.replace(/Domain \d+: /, "")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weakest domain highlight */}
      {weakest && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400 font-medium">最弱 Domain</p>
              <p className="text-lg font-semibold">{weakest.label}</p>
              <p className="text-sm text-slate-400">{weakest.accuracy}% 正確率 ({weakest.correct}/{weakest.total})</p>
            </div>
            <button
              onClick={() => handlePracticeDomain(weakest.key)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
            >
              加強練習
            </button>
          </div>
        </div>
      )}

      {/* Per-domain detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allDomains.map((d) => (
          <div key={d.key} className="bg-slate-800 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">{d.label}</p>
              </div>
              <span className={cn(
                "text-2xl font-bold",
                d.total === 0
                  ? "text-slate-600"
                  : d.accuracy >= 70
                    ? "text-emerald-400"
                    : d.accuracy >= 50
                      ? "text-amber-400"
                      : "text-red-400"
              )}>
                {d.total > 0 ? `${d.accuracy}%` : "--"}
              </span>
            </div>

            <div className="w-full bg-slate-700 rounded-full h-2 mb-3">
              <div
                className={cn(
                  "h-2 rounded-full transition-all",
                  d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                )}
                style={{ width: `${d.accuracy}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>已答 {d.total} 題 | 正確 {d.correct} 題</span>
              <button
                onClick={() => handlePracticeDomain(d.key)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                練習此 Domain
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
