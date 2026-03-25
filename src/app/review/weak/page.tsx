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

interface WrongQuestion {
  questionId: string;
  stem: string;
  questionBankName: string;
  difficulty: number;
  wrongCount: number;
}

export default function WeakPointsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [bankAccuracy, setBankAccuracy] = useState<BankAccuracy[]>([]);
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
          setBankAccuracy(
            (data.bankAccuracy || []).sort((a: BankAccuracy, b: BankAccuracy) => a.accuracy - b.accuracy)
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

  async function handlePracticeBank(bankId: string, bankName: string) {
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `加強練習 - ${bankName}`,
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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded-2xl" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/review" className="text-gray-600 hover:text-gray-900">&larr; 返回複習</Link>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">弱點分析</h1>
      </div>

      {/* Bank weakness ranking */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">各題庫弱點排名</h2>
        {bankAccuracy.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無作答記錄，無法分析弱點</p>
        ) : (
          <div className="space-y-4">
            {bankAccuracy.map((d, i) => (
              <div
                key={d.questionBankId}
                className={cn(
                  "p-4 rounded-2xl",
                  i === 0 ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-100"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded-full font-medium">
                          最弱
                        </span>
                      )}
                      <span className="font-medium text-gray-900">
                        {d.questionBankName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                        <div
                          className={cn(
                            "h-2.5 rounded-full",
                            d.accuracy >= 70 ? "bg-emerald-500" : d.accuracy >= 50 ? "bg-amber-500" : "bg-red-500"
                          )}
                          style={{ width: `${d.accuracy}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 flex-shrink-0 w-24 text-right">
                        {d.accuracy}% ({d.correct}/{d.total})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handlePracticeBank(d.questionBankId, d.questionBankName)}
                    className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-medium transition-all flex-shrink-0"
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
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">最常錯的題目</h2>
        {mostWrong.length === 0 ? (
          <p className="text-gray-400 text-center py-8">尚無錯題記錄</p>
        ) : (
          <div className="space-y-3">
            {mostWrong.map((q) => (
              <Link
                key={q.questionId}
                href={`/questions/${q.questionId}`}
                className="block p-3 bg-gray-50 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
              >
                <p className="text-sm text-gray-900 line-clamp-2">{q.stem}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">錯 {q.wrongCount} 次</span>
                  <span>{q.questionBankName}</span>
                  <span className="text-amber-500">{"★".repeat(q.difficulty)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
