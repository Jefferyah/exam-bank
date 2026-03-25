"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";

interface AiResult {
  success: boolean;
  data?: { answer: string; confidence: number; reasoning: string; explanation: string; keyPoints: string[] };
  error?: string;
}

interface Question {
  id: string;
  stem: string;
  type: string;
  options: { label: string; text: string }[];
  answer: string;
  explanation: string;
  wrongOptionExplanations: Record<string, string> | null;
  extendedKnowledge: string | null;
  questionBankId: string;
  questionBank?: { id: string; name: string };
  category: string | null;
  chapter: string | null;
  difficulty: number;
  tags: string[];
}

export default function QuestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [aiResults, setAiResults] = useState<{ claude: AiResult; openai: AiResult; gemini: AiResult } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    async function fetchQuestion() {
      try {
        const res = await fetch(`/api/questions/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setQuestion(data);
        }
      } catch (err) {
        console.error("Failed to fetch question:", err);
      } finally {
        setLoading(false);
      }
    }

    if (params.id) fetchQuestion();
  }, [params.id]);

  // Check favorite status and note
  useEffect(() => {
    if (!session || !params.id) return;

    async function checkFavoriteAndNote() {
      try {
        const [favRes, noteRes] = await Promise.all([
          fetch(`/api/favorites?questionId=${params.id}`),
          fetch(`/api/notes?questionId=${params.id}`),
        ]);

        if (favRes.ok) {
          const data = await favRes.json();
          const found = data.favorites?.some((f: { questionId: string }) => f.questionId === params.id);
          setIsFavorited(!!found);
        }

        if (noteRes.ok) {
          const data = await noteRes.json();
          const found = data.notes?.find((n: { questionId: string; content: string }) => n.questionId === params.id);
          if (found) {
            setNote(found.content);
            setSavedNote(found.content);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    checkFavoriteAndNote();
  }, [session, params.id]);

  async function handleToggleFavorite() {
    if (!session) return;
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: params.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setIsFavorited(data.favorited);
      }
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSaveNote() {
    if (!session || !note.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: params.id, content: note }),
      });
      if (res.ok) {
        setSavedNote(note);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleAiSolve() {
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: params.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiResults(data.results);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("確定要刪除此題目嗎？此操作無法復原。")) return;
    try {
      const res = await fetch(`/api/questions/${params.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/questions");
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-100 rounded-2xl" />
          <div className="h-32 bg-gray-100 rounded-2xl" />
          <div className="h-48 bg-gray-100 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500 text-lg">找不到此題目</p>
        <Link href="/questions" className="text-blue-500 hover:text-blue-600 mt-2 inline-block">
          返回題庫
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/questions" className="text-gray-500 hover:text-gray-900">
            &larr; 返回題庫
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isFavorited ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
            )}
          >
            {isFavorited ? "★ 已收藏" : "☆ 收藏"}
          </button>
          <Link
            href={`/questions/create?edit=${question.id}`}
            className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-sm font-medium transition-colors"
          >
            編輯
          </Link>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-full text-sm font-medium transition-colors"
          >
            刪除
          </button>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-2">
        <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-sm rounded-full font-medium">
          {question.questionBank?.name || "未分類"}
        </span>
        <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
          {question.type === "SINGLE" ? "單選題" : question.type === "MULTI" ? "多選題" : "情境題"}
        </span>
        <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-sm rounded-full">
          {"★".repeat(question.difficulty)}{"☆".repeat(5 - question.difficulty)} {DIFFICULTY_LABELS[question.difficulty]}
        </span>
        {question.category && (
          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-sm rounded-full">
            {question.category}
          </span>
        )}
        {question.chapter && (
          <span className="px-2.5 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
            {question.chapter}
          </span>
        )}
        {question.tags?.map((tag, i) => (
          <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-500 text-sm rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Question stem */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">題目</h2>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{question.stem}</p>
      </div>

      {/* Options */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">選項</h2>
        <div className="space-y-3">
          {question.options.map((opt) => (
            <div
              key={opt.label}
              className={cn(
                "p-3 rounded-xl border transition-colors",
                showAnswer && question.answer.includes(opt.label)
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-gray-200 bg-gray-50"
              )}
            >
              <span className="font-semibold text-blue-500 mr-2">{opt.label}.</span>
              <span className="text-gray-700">{opt.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Show/hide answer toggle */}
      <button
        onClick={() => setShowAnswer(!showAnswer)}
        className="w-full py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-medium transition-colors"
      >
        {showAnswer ? "隱藏答案" : "顯示答案"}
      </button>

      {/* Answer & Explanation */}
      {showAnswer && (
        <>
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">正確答案</h2>
            <p className="text-2xl font-bold text-emerald-500">{question.answer}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">解析</h2>
            <p className="text-gray-500 whitespace-pre-wrap leading-relaxed">{question.explanation}</p>
          </div>

          {question.wrongOptionExplanations && Object.keys(question.wrongOptionExplanations).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">各選項說明</h2>
              <div className="space-y-3">
                {Object.entries(question.wrongOptionExplanations).map(([label, explanation]) => (
                  <div key={label} className="flex gap-3">
                    <span className="font-semibold text-red-500 flex-shrink-0">{label}.</span>
                    <span className="text-gray-500">{explanation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.extendedKnowledge && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">延伸知識</h2>
              <p className="text-gray-500 whitespace-pre-wrap leading-relaxed">{question.extendedKnowledge}</p>
            </div>
          )}
        </>
      )}

      {/* AI Solve */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">AI 解題</h2>
          <button
            onClick={handleAiSolve}
            disabled={aiLoading}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-300 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-colors"
          >
            {aiLoading ? "分析中..." : "AI 解題"}
          </button>
        </div>

        {aiResults && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["claude", "openai", "gemini"] as const).map((model) => {
              const result = aiResults[model];
              return (
                <div key={model} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-blue-500 mb-2 capitalize">{model}</h3>
                  {result.success && result.data ? (
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="text-gray-500">答案：</span>
                        <span className={cn(
                          "font-bold",
                          result.data.answer === question.answer ? "text-emerald-500" : "text-red-500"
                        )}>
                          {result.data.answer}
                        </span>
                      </p>
                      <p>
                        <span className="text-gray-500">信心度：</span>
                        <span className="text-gray-900">{(result.data.confidence * 100).toFixed(0)}%</span>
                      </p>
                      <p className="text-gray-500">{result.data.reasoning}</p>
                      {result.data.keyPoints && result.data.keyPoints.length > 0 && (
                        <ul className="list-disc list-inside text-gray-500 space-y-1">
                          {result.data.keyPoints.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <p className="text-red-500 text-sm">{result.error || "API 呼叫失敗"}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notes - inline per question */}
      {session && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">我的筆記</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="在此輸入你的筆記..."
            className="w-full h-32 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            {savedNote && note === savedNote && (
              <span className="text-sm text-emerald-500">已儲存</span>
            )}
            {(!savedNote || note !== savedNote) && <span />}
            <button
              onClick={handleSaveNote}
              disabled={savingNote || !note.trim() || note === savedNote}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-colors"
            >
              {savingNote ? "儲存中..." : "儲存筆記"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
