"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ExamItem {
  id: string;
  title: string;
  note: string | null;
  mode: string;
  score: number | null;
  startedAt: string;
  finishedAt: string | null;
  timeLimit: number | null;
  totalQuestions: number;
  answered: number;
  correct: number;
  questionBankNames: string[];
}

export default function ExamHistoryPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<ExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [modeFilter, setModeFilter] = useState<string>("");

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (modeFilter) params.set("mode", modeFilter);

    fetch(`/api/exams/history?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setItems(data.items);
          setTotalPages(data.totalPages);
          setTotal(data.total);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, page, modeFilter]);

  // Reset page when filter changes
  useEffect(() => { setPage(1); }, [modeFilter]);

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入</p>
        <Link href="/login" className="text-blue-500 hover:text-blue-600 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "< 1 分鐘";
    if (mins < 60) return `${mins} 分鐘`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            測驗歷史
          </h1>
          <p className="text-sm text-gray-500 mt-1">共 {total} 筆已完成的測驗</p>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          ← 返回首頁
        </Link>
      </div>

      {/* Mode filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">篩選：</span>
        {[
          { value: "", label: "全部" },
          { value: "PRACTICE", label: "練習" },
          { value: "MOCK", label: "模擬考" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => setModeFilter(opt.value)}
            className={cn(
              "px-3 py-1 text-xs rounded-full transition-colors",
              modeFilter === opt.value
                ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p>尚無測驗記錄</p>
          <Link href="/exam" className="text-blue-500 hover:text-blue-600 text-sm mt-2 inline-block">
            開始第一次測驗
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((exam) => {
            const pct = exam.score ?? 0;
            const scoreColor =
              pct >= 80 ? "text-emerald-600 dark:text-emerald-400"
              : pct >= 60 ? "text-amber-600 dark:text-amber-400"
              : "text-red-500 dark:text-red-400";
            const barColor =
              pct >= 80 ? "from-emerald-300 to-emerald-400 dark:from-emerald-400/40 dark:to-emerald-500/40"
              : pct >= 60 ? "from-amber-200 to-amber-300 dark:from-amber-400/40 dark:to-amber-500/40"
              : "from-red-200 to-red-300 dark:from-red-400/40 dark:to-red-500/40";

            return (
              <Link
                key={exam.id}
                href={`/exam/${exam.id}/result`}
                className="block bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-medium rounded-full flex-shrink-0",
                        exam.mode === "MOCK"
                          ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                      )}>
                        {exam.mode === "MOCK" ? "模擬考" : "練習"}
                      </span>
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {exam.title}
                      </p>
                      {exam.note && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-0.5 rounded-full truncate max-w-[200px] flex-shrink-0">
                          {exam.note}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-400 flex-wrap">
                      <span>
                        {exam.finishedAt
                          ? new Date(exam.finishedAt).toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })
                          : "進行中"}
                      </span>
                      <span>{exam.answered}/{exam.totalQuestions} 題</span>
                      <span>答對 {exam.correct}</span>
                      <span>耗時 {formatDuration(exam.startedAt, exam.finishedAt)}</span>
                      {exam.questionBankNames.length > 0 && (
                        <span className="truncate max-w-[200px]">{exam.questionBankNames.join(", ")}</span>
                      )}
                    </div>
                  </div>
                  <span className={cn("text-lg font-bold tabular-nums flex-shrink-0", scoreColor)}>
                    {exam.score != null ? `${Math.round(exam.score)} 分` : "--"}
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2 mt-3 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full bg-gradient-to-r transition-all group-hover:opacity-80", barColor)}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 transition-colors"
          >
            ← 上一頁
          </button>
          <span className="text-sm text-gray-500 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 disabled:opacity-40 hover:bg-gray-200 transition-colors"
          >
            下一頁 →
          </button>
        </div>
      )}
    </div>
  );
}
