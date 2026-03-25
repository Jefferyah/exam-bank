"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface WrongQuestion {
  questionId: string;
  stem: string;
  questionBankName: string;
  difficulty: number;
  wrongCount: number;
  lastWrongAt: string;
}

interface AnalyticsResponse {
  mostWrongQuestions?: WrongQuestion[];
  allWrongQuestions?: WrongQuestion[];
}

interface FavoriteQuestion {
  id: string;
  questionId: string;
  createdAt: string;
  question: {
    id: string;
    stem: string;
    difficulty: number;
    type: string;
    questionBank?: {
      name: string;
    };
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
          const data: AnalyticsResponse = await analyticsRes.json();
          setWrongQuestions(data.allWrongQuestions || data.mostWrongQuestions || []);
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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入以查看複習內容</p>
        <Link href="/login" className="text-gray-900 hover:text-gray-800 mt-2 inline-block font-medium">登入</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">複習中心</h1>
        <Link
          href="/review/weak"
          className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-full text-sm font-medium transition-colors"
        >
          弱點分析
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("wrong")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "wrong" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900"
          )}
        >
          錯題本 ({wrongQuestions.length})
        </button>
        <button
          onClick={() => setTab("favorites")}
          className={cn(
            "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
            tab === "favorites" ? "border-gray-900 text-gray-900" : "border-transparent text-gray-600 hover:text-gray-900"
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
        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : tab === "wrong" ? (
        <>
          {wrongQuestions.length > 0 && (
            <button
              onClick={handleReviewWrong}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-full font-medium transition-colors"
            >
              重做所有錯題
            </button>
          )}

          {filteredWrong.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p>{search ? "找不到符合的錯題" : "目前沒有錯題記錄"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWrong.map((q) => (
                <Link
                  key={q.questionId}
                  href={`/questions/${q.questionId}`}
                  className="block bg-white border border-gray-100 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <p className="text-sm text-gray-900 line-clamp-2">{q.stem}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">錯 {q.wrongCount} 次</span>
                    <span>{q.questionBankName}</span>
                    <span className="text-amber-500">{"★".repeat(q.difficulty)}</span>
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
            <div className="text-center py-12 text-gray-400">
              <p>{search ? "找不到符合的收藏題" : "目前沒有收藏題目"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFav.map((f) => (
                <div
                  key={f.id}
                  className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-center gap-4"
                >
                  <Link
                    href={`/questions/${f.questionId}`}
                    className="flex-1 min-w-0 hover:text-gray-900 transition-colors"
                  >
                    <p className="text-sm text-gray-900 line-clamp-2">{f.question.stem}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                      <span>{f.question.questionBank?.name || "未分類"}</span>
                      <span className="text-amber-500">{"★".repeat(f.question.difficulty)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleRemoveFavorite(f.questionId)}
                    className="px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 rounded-full text-xs transition-colors flex-shrink-0"
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
