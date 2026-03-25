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

interface WrongQuestion {
  questionId: string;
  stem: string;
  domain: string;
  difficulty: number;
  wrongCount: number;
}

export default function WeakPointsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [domainAccuracy, setDomainAccuracy] = useState<DomainAccuracy[]>([]);
  const [mostWrong, setMostWrong] = useState<WrongQuestion[]>([]);
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
          setDomainAccuracy(
            (data.domainAccuracy || []).sort((a: DomainAccuracy, b: DomainAccuracy) => a.accuracy - b.accuracy)
          );
          setMostWrong(data.mostWrongQuestions || []);
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
          title: `加強練習 - ${DOMAINS[domainKey as DomainKey] || domainKey}`,
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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p>請先登入</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-slate-800 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/review" className="text-slate-400 hover:text-white">&larr; 返回複習</Link>
        <h1 className="text-2xl font-bold">弱點分析</h1>
      </div>

      {/* Domain weakness ranking */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">各 Domain 弱點排名</h2>
        {domainAccuracy.length === 0 ? (
          <p className="text-slate-500 text-center py-8">尚無作答記錄，無法分析弱點</p>
        ) : (
          <div className="space-y-4">
            {domainAccuracy.map((d, i) => (
              <div
                key={d.domain}
                className={cn(
                  "p-4 rounded-lg",
                  i === 0 ? "bg-red-500/10 border border-red-500/30" : "bg-slate-700/50"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full font-medium">
                          最弱
                        </span>
                      )}
                      <span className="font-medium">
                        {DOMAINS[d.domain as DomainKey] || d.domain}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1 bg-slate-700 rounded-full h-2.5">
                        <div
                          className={cn(
                            "h-2.5 rounded-full",
                            d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${d.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm text-slate-400 flex-shrink-0 w-24 text-right">
                        {d.accuracy}% ({d.correct}/{d.total})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePracticeDomain(d.domain)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
                  >
                    加強練習
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Most frequently wrong */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">最常錯的題目</h2>
        {mostWrong.length === 0 ? (
          <p className="text-slate-500 text-center py-8">尚無錯題記錄</p>
        ) : (
          <div className="space-y-3">
            {mostWrong.map((q) => (
              <Link
                key={q.questionId}
                href={`/questions/${q.questionId}`}
                className="block p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <p className="text-sm line-clamp-2">{q.stem}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  <span className="text-red-400 font-semibold">錯 {q.wrongCount} 次</span>
                  <span>{DOMAINS[q.domain as DomainKey] || q.domain}</span>
                  <span className="text-amber-400">{"★".repeat(q.difficulty)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
