"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";
import { ArrowLeft, BookmarkFilled, BookmarkEmpty, DifficultyStarsClickable } from "@/components/icons";
import { CopyQuestionButton } from "@/components/copy-question-button";
import { buildAiPrompt, getAiWebUrls, DEFAULT_AI_PROMPT } from "@/lib/ai-prompt";

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
  const [userDifficulty, setUserDifficulty] = useState<number | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [promptDraft, setPromptDraft] = useState("");
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);

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

  // Fetch user's custom AI prompt
  useEffect(() => {
    if (!session) return;
    async function fetchPrompt() {
      try {
        const res = await fetch("/api/user-settings");
        if (res.ok) {
          const data = await res.json();
          setCustomPrompt(data.aiPromptTemplate || null);
          setPromptDraft(data.aiPromptTemplate || DEFAULT_AI_PROMPT);
        }
      } catch (err) {
        console.error("Failed to fetch prompt:", err);
      }
    }
    fetchPrompt();
  }, [session]);

  async function handleSavePrompt() {
    setSavingPrompt(true);
    try {
      const isDefault = promptDraft.trim() === DEFAULT_AI_PROMPT.trim();
      const res = await fetch("/api/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiPromptTemplate: isDefault ? null : promptDraft }),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomPrompt(data.aiPromptTemplate);
        setShowPromptEditor(false);
      }
    } catch (err) {
      console.error("Failed to save prompt:", err);
    } finally {
      setSavingPrompt(false);
    }
  }

  // Check favorite status and note
  useEffect(() => {
    if (!session || !params.id) return;

    async function checkFavoriteAndNote() {
      try {
        const [favRes, noteRes, diffRes] = await Promise.all([
          fetch(`/api/favorites?questionId=${params.id}`),
          fetch(`/api/notes?questionId=${params.id}`),
          fetch(`/api/user-difficulty?questionId=${params.id}`),
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

        if (diffRes.ok) {
          const data = await diffRes.json();
          if (data.ratings?.[0]?.difficulty) {
            setUserDifficulty(data.ratings[0].difficulty);
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
        <p className="text-gray-600 text-lg">找不到此題目</p>
        <Link href="/questions" className="text-gray-900 hover:text-gray-700 mt-2 inline-block font-medium">
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
          <Link href="/questions" className="flex items-center gap-1 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4" /> 返回題庫
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleFavorite}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
              isFavorited ? "bg-amber-100 text-amber-700 border border-amber-300" : "bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200"
            )}
          >
            {isFavorited ? <><BookmarkFilled className="w-4 h-4" /> 已收藏</> : <><BookmarkEmpty className="w-4 h-4" /> 收藏</>}
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
        <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-sm rounded-full inline-flex items-center gap-1">
          <DifficultyStarsClickable
            value={userDifficulty ?? question.difficulty}
            onChange={async (star) => {
              setUserDifficulty(star);
              try {
                await fetch("/api/user-difficulty", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ questionId: question.id, difficulty: star }),
                });
              } catch {}
            }}
          />
          <span className="ml-1">{DIFFICULTY_LABELS[userDifficulty ?? question.difficulty]}</span>
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
          <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Question stem */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">題目</h2>
          <CopyQuestionButton
            stem={question.stem}
            options={question.options}
            answer={question.answer}
            explanation={question.explanation}
          />
        </div>
        <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{question.stem}</p>
      </div>

      {/* Options */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
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
        className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-full font-medium transition-all"
      >
        {showAnswer ? "隱藏答案" : "顯示答案"}
      </button>

      {/* Answer & Explanation */}
      {showAnswer && (
        <>
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">正確答案</h2>
            <p className="text-2xl font-bold text-emerald-500">{question.answer}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">解析</h2>
            <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{question.explanation}</p>
          </div>

          {question.wrongOptionExplanations && Object.keys(question.wrongOptionExplanations).length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">各選項說明</h2>
              <div className="space-y-3">
                {Object.entries(question.wrongOptionExplanations).map(([label, explanation]) => (
                  <div key={label} className="flex gap-3">
                    <span className="font-semibold text-red-500 flex-shrink-0">{label}.</span>
                    <span className="text-gray-600">{explanation}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.extendedKnowledge && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">延伸知識</h2>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">{question.extendedKnowledge}</p>
            </div>
          )}
        </>
      )}

      {/* AI Solve — open in external AI web */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">AI 解題</h2>
          {session && (
            <button
              onClick={() => { setShowPromptEditor(!showPromptEditor); if (!showPromptEditor) setPromptDraft(customPrompt || DEFAULT_AI_PROMPT); }}
              className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
            >
              {showPromptEditor ? "收起" : "自訂 Prompt"}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          點擊按鈕，自動帶入題目與 Prompt 到 AI 網頁進行解題
          {customPrompt && <span className="ml-1 text-blue-500">（使用自訂 Prompt）</span>}
        </p>

        {/* Prompt editor */}
        {showPromptEditor && (
          <div className="mb-4 space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">自訂 AI Prompt</p>
              <button
                onClick={() => setPromptDraft(DEFAULT_AI_PROMPT)}
                className="text-xs text-gray-500 hover:text-gray-900 transition-colors"
              >
                恢復預設
              </button>
            </div>
            <textarea
              value={promptDraft}
              onChange={(e) => setPromptDraft(e.target.value)}
              className="w-full min-h-[180px] px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y font-mono"
            />
            <div className="flex flex-wrap gap-1.5">
              {["{{題型}}", "{{題目}}", "{{選項}}", "{{作答規則}}"].map((tag) => (
                <span key={tag} className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full font-mono">{tag}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400">上方標籤會在送出時自動替換為實際題目內容。可自由調整 Prompt 結構與指令。</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowPromptEditor(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full text-sm font-medium transition-all"
              >
                {savingPrompt ? "儲存中..." : "儲存 Prompt"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(() => {
            const urls = getAiWebUrls(buildAiPrompt(question, customPrompt));
            const models = [
              { key: "chatgpt" as const, label: "ChatGPT", color: "bg-[#10a37f] hover:bg-[#0d8c6d]", icon: "🤖" },
              { key: "claude" as const, label: "Claude", color: "bg-[#d97706] hover:bg-[#b45309]", icon: "🧠" },
              { key: "gemini" as const, label: "Gemini", color: "bg-[#4285f4] hover:bg-[#3367d6]", icon: "✨" },
            ];
            return models.map((m) => (
              <a
                key={m.key}
                href={urls[m.key]}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-medium text-sm transition-all shadow-sm",
                  m.color
                )}
              >
                <span className="text-lg">{m.icon}</span>
                用 {m.label} 解題
              </a>
            ));
          })()}
        </div>
      </div>

      {/* Notes - inline per question */}
      {session && (
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">我的筆記</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="在此輸入你的筆記..."
            className="w-full min-h-[200px] px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
          />
          <div className="flex items-center justify-between mt-3">
            {savedNote && note === savedNote && (
              <span className="text-sm text-emerald-500">已儲存</span>
            )}
            {(!savedNote || note !== savedNote) && <span />}
            <button
              onClick={handleSaveNote}
              disabled={savingNote || !note.trim() || note === savedNote}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-full text-sm font-medium transition-all"
            >
              {savingNote ? "儲存中..." : "儲存筆記"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
