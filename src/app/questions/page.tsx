"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";
import { DifficultyStars } from "@/components/icons";

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  _count?: { questions: number };
  createdBy?: { name: string | null; email: string };
}

interface Question {
  id: string;
  stem: string;
  type: string;
  difficulty: number;
  tags: string[];
  options: { label: string; text: string }[];
  questionBank?: { id: string; name: string };
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [questionBankId, setQuestionBankId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [showBankManager, setShowBankManager] = useState(false);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingBankId, setSavingBankId] = useState<string | null>(null);

  const fetchBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/question-banks");
      if (res.ok) {
        const data = await res.json();
        setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
      }
    } catch (err) {
      console.error("Failed to fetch question banks:", err);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const fetchQuestions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (questionBankId) params.set("questionBankId", questionBankId);
      if (difficulty) params.set("difficulty", difficulty);
      if (type) params.set("type", type);

      const res = await fetch(`/api/questions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions);
        setPagination(data.pagination);
      }
    } catch (err) {
      console.error("Failed to fetch questions:", err);
    } finally {
      setLoading(false);
    }
  }, [search, questionBankId, difficulty, type]);

  useEffect(() => {
    fetchQuestions(1);
  }, [fetchQuestions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchQuestions(1);
  }

  async function handleDeleteBank(bankId: string, bankName: string, questionCount: number) {
    const confirmed = window.confirm(
      `確定要刪除題庫「${bankName}」嗎？\n\n⚠️ 這會同時刪除該題庫下的 ${questionCount} 題，此操作無法復原。`
    );
    if (!confirmed) return;

    setDeletingBankId(bankId);
    try {
      const res = await fetch(`/api/question-banks/${bankId}`, { method: "DELETE" });
      if (res.ok) {
        // Refresh banks and questions
        await fetchBanks();
        if (questionBankId === bankId) {
          setQuestionBankId("");
        }
        fetchQuestions(1);
      } else {
        const data = await res.json();
        alert(data.error || "刪除失敗");
      }
    } catch {
      alert("刪除失敗，請重試");
    } finally {
      setDeletingBankId(null);
    }
  }

  async function handleRenameBank(bankId: string) {
    if (!editingName.trim()) return;
    setSavingBankId(bankId);
    try {
      const res = await fetch(`/api/question-banks/${bankId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        await fetchBanks();
        setEditingBankId(null);
        setEditingName("");
      } else {
        const data = await res.json();
        alert(data.error || "修改失敗");
      }
    } catch {
      alert("修改失敗，請重試");
    } finally {
      setSavingBankId(null);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">題庫管理</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBankManager(!showBankManager)}
            className={cn(
              "px-6 py-2.5 rounded-full text-sm font-medium transition-colors border",
              showBankManager
                ? "bg-blue-50 text-blue-600 border-blue-200"
                : "bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200"
            )}
          >
            {showBankManager ? "收起題庫" : "管理題庫"}
          </button>
          <Link
            href="/questions/create"
            className="px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-full text-sm font-medium shadow-sm transition-all"
          >
            新增題目
          </Link>
          <Link
            href="/questions/import"
            className="px-6 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-sm font-medium transition-colors"
          >
            匯入題目
          </Link>
        </div>
      </div>

      {/* Question Bank Manager */}
      {showBankManager && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">題庫列表</h2>
            <span className="text-sm text-gray-600">共 {questionBanks.length} 個題庫</span>
          </div>

          {questionBanks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>尚無題庫</p>
              <p className="text-sm mt-1">匯入題目時會自動建立題庫</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questionBanks.map((bank) => (
                <div
                  key={bank.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    {editingBankId === bank.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameBank(bank.id); if (e.key === "Escape") { setEditingBankId(null); setEditingName(""); } }}
                          className="flex-1 px-3 py-1 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameBank(bank.id)}
                          disabled={savingBankId === bank.id}
                          className="px-3 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-all disabled:opacity-50"
                        >
                          {savingBankId === bank.id ? "..." : "儲存"}
                        </button>
                        <button
                          onClick={() => { setEditingBankId(null); setEditingName(""); }}
                          className="px-3 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">{bank.name}</p>
                        <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full flex-shrink-0">
                          {bank._count?.questions ?? 0} 題
                        </span>
                      </div>
                    )}
                    {bank.description && editingBankId !== bank.id && (
                      <p className="text-sm text-gray-600 mt-0.5 truncate">{bank.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {editingBankId !== bank.id && (
                      <>
                        {/* Rename bank */}
                        <button
                          onClick={() => { setEditingBankId(bank.id); setEditingName(bank.name); }}
                          className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          改名
                        </button>
                        {/* Filter by this bank */}
                        <button
                          onClick={() => {
                            setQuestionBankId(bank.id);
                            setShowBankManager(false);
                          }}
                          className="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                        >
                          篩選
                        </button>
                        {/* Delete bank */}
                        <button
                          onClick={() => handleDeleteBank(bank.id, bank.name, bank._count?.questions ?? 0)}
                          disabled={deletingBankId === bank.id}
                          className="px-3 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full transition-colors disabled:opacity-50"
                        >
                          {deletingBankId === bank.id ? "刪除中..." : "刪除"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋關鍵字..."
            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-sm font-medium shadow-sm transition-all flex-shrink-0"
            title="搜尋"
          >
            <svg className="w-4 h-4 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <span className="hidden md:inline">搜尋</span>
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={questionBankId}
            onChange={(e) => setQuestionBankId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部題庫</option>
            {questionBanks.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部難度</option>
            {Object.entries(DIFFICULTY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部類型</option>
            <option value="SINGLE">單選題</option>
            <option value="MULTI">多選題</option>
            <option value="SCENARIO">情境題</option>
          </select>
        </div>
      </div>

      {/* Results info */}
      <p className="text-sm text-gray-600">共 {pagination.total} 題</p>

      {/* Question list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">找不到符合條件的題目</p>
          <p className="text-sm mt-1">嘗試調整篩選條件或新增題目</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <Link
              key={q.id}
              href={`/questions/${q.id}`}
              className="block bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium line-clamp-2">{q.stem}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
                      {q.questionBank?.name || "未分類"}
                    </span>
                    <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {q.type === "SINGLE" ? "單選" : q.type === "MULTI" ? "多選" : "情境"}
                    </span>
                    <DifficultyStars value={q.difficulty} />
                    {q.tags?.slice(0, 3).map((tag, i) => (
                      <span key={i} className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => fetchQuestions(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-sm text-gray-700 transition-colors"
          >
            上一頁
          </button>
          <span className="text-sm text-gray-600">
            第 {pagination.page} / {pagination.totalPages} 頁
          </span>
          <button
            onClick={() => fetchQuestions(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-full text-sm text-gray-700 transition-colors"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
