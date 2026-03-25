"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BankAccuracy {
  questionBankId: string;
  questionBankName: string;
  total: number;
  correct: number;
  accuracy: number;
}

export default function BankAnalysisPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [bankAccuracy, setBankAccuracy] = useState<BankAccuracy[]>([]);
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
          setBankAccuracy(data.bankAccuracy || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  async function handlePracticeBank(bankId: string, bankName: string) {
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `題庫練習 - ${bankName}`,
          questionBankIds: [bankId],
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

  const weakest = bankAccuracy
    .filter((d) => d.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy)[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/analytics" className="text-slate-400 hover:text-white">&larr; 返回分析</Link>
        <h1 className="text-2xl font-bold">題庫分析</h1>
      </div>

      {/* Bar chart overview */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">題庫總覽</h2>
        {bankAccuracy.length === 0 ? (
          <p className="text-slate-500 text-center py-8">尚無作答記錄</p>
        ) : (
          <div className="space-y-3">
            {bankAccuracy
              .sort((a, b) => b.accuracy - a.accuracy)
              .map((d) => (
                <div key={d.questionBankId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300 truncate mr-2">{d.questionBankName}</span>
                    <span className="text-slate-400 flex-shrink-0">
                      {d.accuracy}% ({d.correct}/{d.total})
                    </span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-3">
                    <div
                      className={cn(
                        "h-3 rounded-full transition-all",
                        d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                      )}
                      style={{ width: `${d.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Weakest bank highlight */}
      {weakest && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-400 font-medium">最弱題庫</p>
              <p className="text-lg font-semibold">{weakest.questionBankName}</p>
              <p className="text-sm text-slate-400">{weakest.accuracy}% 正確率 ({weakest.correct}/{weakest.total})</p>
            </div>
            <button
              onClick={() => handlePracticeBank(weakest.questionBankId, weakest.questionBankName)}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors"
            >
              加強練習
            </button>
          </div>
        </div>
      )}

      {/* Per-bank detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bankAccuracy.map((d) => (
          <div key={d.questionBankId} className="bg-slate-800 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-sm">{d.questionBankName}</p>
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
                onClick={() => handlePracticeBank(d.questionBankId, d.questionBankName)}
                className="text-indigo-400 hover:text-indigo-300"
              >
                練習此題庫
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
