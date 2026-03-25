"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DOMAINS, cn, DomainKey } from "@/lib/utils";

interface WrongQuestion {
  questionId: string;
  stem: string;
  domain: string;
  difficulty: number;
  wrongCount: number;
  lastWrongAt: string;
}

interface FavoriteQuestion {
  id: string;
  questionId: string;
  createdAt: string;
  question: {
    id: string;
    stem: string;
    domain: string;
    difficulty: number;
    type: string;
  };
}

export default function ReviewPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<"wrong" | "favorites">("wrong");
  const [wrongQuestions, setWrongQuestions] = useState<WrongQuestion[]>([]);
  const [favorites, setFavorites] = useState<FavoriteQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const [analyticsRes, favRes] = await Promise.all([
          fetch("/api/analytics"),
          fetch("/api/favorites?limit=100"),
        ]);

        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setWrongQuestions(data.mostWrongQuestions || []);
        }
        if (favRes.ok) {
          const data = await favRes.json();
          setFavorites(data.favorites || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  async function handleRemoveFavorite(questionId: string) {
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.ok) {
        setFavorites((prev) => prev.filter((f) => f.questionId !== questionId));
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleReviewWrong() {
    if (wrongQuestions.length === 0) return;
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `錯題重做 - ${new Date().toLocaleDateString("zh-TW")}`,
          count: Math.min(wrongQuestions.length, 50),
          mode: "PRACTICE",
          wrongOnly: true,
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

  const filteredWrong = wrongQuestions.filter((q) =>
    !search || q.stem.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFav = favorites.filter((f) =>
    !search || f.question.stem.toLowerCase().includes(search.toLowerCase())
  );

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p>請先登入以查看複習內容</p>
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">複習中心</h1>
        <Link
          href="/review/weak"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors"
        >
          弱點分析
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setTab("wrong")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "wrong" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          錯題本 ({wrongQuestions.length})
        </button>
        <button
          onClick={() => setTab("favorites")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "favorites" ? "border-indigo-500 text-white" : "border-transparent text-slate-400 hover:text-white"
          )}
        >
          收藏題 ({favorites.length})
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋..."
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : tab === "wrong" ? (
        <>
          {wrongQuestions.length > 0 && (
            <button
              onClick={handleReviewWrong}
              className="w-full py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium transition-colors"
            >
              重做所有錯題
            </button>
          )}

          {filteredWrong.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>{search ? "找不到符合的錯題" : "目前沒有錯題記錄"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWrong.map((q) => (
                <Link
                  key={q.questionId}
                  href={`/questions/${q.questionId}`}
                  className="block bg-slate-800 rounded-lg p-4 hover:bg-slate-750 hover:ring-1 hover:ring-indigo-500/50 transition-all"
                >
                  <p className="text-sm line-clamp-2">{q.stem}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="text-red-400 font-semibold">錯 {q.wrongCount} 次</span>
                    <span>{DOMAINS[q.domain as DomainKey] || q.domain}</span>
                    <span className="text-amber-400">{"★".repeat(q.difficulty)}</span>
                    <span>最後錯誤：{new Date(q.lastWrongAt).toLocaleDateString("zh-TW")}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {filteredFav.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>{search ? "找不到符合的收藏題" : "目前沒有收藏題目"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFav.map((f) => (
                <div
                  key={f.id}
                  className="bg-slate-800 rounded-lg p-4 flex items-center gap-4"
                >
                  <Link
                    href={`/questions/${f.questionId}`}
                    className="flex-1 min-w-0 hover:text-indigo-300 transition-colors"
                  >
                    <p className="text-sm line-clamp-2">{f.question.stem}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{DOMAINS[f.question.domain as DomainKey] || f.question.domain}</span>
                      <span className="text-amber-400">{"★".repeat(f.question.difficulty)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemoveFavorite(f.questionId)}
                    className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-400 rounded text-xs transition-colors flex-shrink-0"
                  >
                    移除
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
