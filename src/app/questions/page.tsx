"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";

interface QuestionBank {
  id: string;
  name: string;
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

  // Fetch question banks on mount
  useEffect(() => {
    async function fetchBanks() {
      try {
        const res = await fetch("/api/question-banks");
        if (res.ok) {
          const data = await res.json();
          setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
        }
      } catch (err) {
        console.error("Failed to fetch question banks:", err);
      }
    }
    fetchBanks();
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">題庫管理</h1>
        <div className="flex gap-2">
          <Link
            href="/questions/create"
            className="btn-nature px-6 py-2.5 text-sm font-medium shadow-sm"
          >
            新增題目
          </Link>
          <Link
            href="/questions/import"
            className="btn-secondary px-6 py-2.5 text-sm font-medium"
          >
            匯入題目
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋關鍵字..."
            className="flex-1 px-4 py-2 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
          />
          <button
            type="submit"
            className="btn-nature px-6 py-2 text-sm font-medium shadow-sm"
          >
            搜尋
          </button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={questionBankId}
            onChange={(e) => setQuestionBankId(e.target.value)}
            className="px-3 py-2 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
          >
            <option value="">全部題庫</option>
            {questionBanks.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-2 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
          >
            <option value="">全部難度</option>
            {Object.entries(DIFFICULTY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
          >
            <option value="">全部類型</option>
            <option value="SINGLE">單選題</option>
            <option value="MULTI">多選題</option>
            <option value="SCENARIO">情境題</option>
          </select>
        </div>
      </div>

      {/* Results info */}
      <p className="text-sm text-gray-500">共 {pagination.total} 題</p>

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
              className="block glass-card rounded-2xl p-5 hover:shadow-md hover:border-emerald-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 font-medium line-clamp-2">{q.stem}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {/* Question bank badge */}
                    <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                      {q.questionBank?.name || "未分類"}
                    </span>
                    {/* Type badge */}
                    <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                      {q.type === "SINGLE" ? "單選" : q.type === "MULTI" ? "多選" : "情境"}
                    </span>
                    {/* Difficulty stars */}
                    <span className="text-xs text-amber-500">
                      {"★".repeat(q.difficulty)}{"☆".repeat(5 - q.difficulty)}
                    </span>
                    {/* Tags */}
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
            className="btn-secondary px-4 py-1.5 text-sm"
          >
            上一頁
          </button>
          <span className="text-sm text-gray-500">
            第 {pagination.page} / {pagination.totalPages} 頁
          </span>
          <button
            onClick={() => fetchQuestions(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="btn-secondary px-4 py-1.5 text-sm"
          >
            下一頁
          </button>
        </div>
      )}
    </div>
  );
}
