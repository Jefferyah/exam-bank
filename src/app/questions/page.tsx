"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { DIFFICULTY_LABELS, cn } from "@/lib/utils";
import { groupBanksByCategory } from "@/lib/group-banks";
import { DifficultyStars } from "@/components/icons";
import { setQuestionNavList } from "@/lib/question-nav";

interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  category?: string | null;
  isPublic?: boolean;
  createdById?: string;
  _count?: { questions: number };
  createdBy?: { name: string | null };
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
  return (
    <Suspense>
      <QuestionsPageInner />
    </Suspense>
  );
}

function QuestionsPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const initialTag = searchParams.get("tags") || "";
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [questionBankId, setQuestionBankId] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
  const [showBankManager, setShowBankManager] = useState(!initialTag);
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [savingBankId, setSavingBankId] = useState<string | null>(null);
  const [hiddenBankIds, setHiddenBankIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState(initialTag);

  const currentUserId = session?.user?.id;
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role;

  // Update question navigation list for prev/next in detail page
  useEffect(() => {
    if (questions.length > 0) {
      const label = selectedTag ? `${selectedTag} 相關題目` : "題庫";
      setQuestionNavList(questions.map((q) => q.id), label);
    }
  }, [questions, selectedTag]);

  const fetchBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/question-banks?includeHidden=true");
      if (res.ok) {
        const data = await res.json();
        setQuestionBanks(Array.isArray(data) ? data : data.questionBanks || []);
      }
    } catch (err) {
      console.error("Failed to fetch question banks:", err);
    }
  }, []);

  const fetchHiddenBanks = useCallback(async () => {
    try {
      const res = await fetch("/api/hidden-banks");
      if (res.ok) {
        const data = await res.json();
        setHiddenBankIds(new Set(data.hiddenBankIds || []));
      }
    } catch (err) {
      console.error("Failed to fetch hidden banks:", err);
    }
  }, []);

  const fetchTags = useCallback(async (bankId?: string) => {
    try {
      const params = bankId ? `?bankIds=${bankId}` : "";
      const res = await fetch(`/api/tags${params}`);
      if (res.ok) {
        const data = await res.json();
        setAllTags(data.tags || []);
      }
    } catch (err) {
      console.error("Failed to fetch tags:", err);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
    fetchHiddenBanks();
    fetchTags();
  }, [fetchBanks, fetchHiddenBanks, fetchTags]);

  // Re-fetch tags when selected bank changes
  const prevBankIdRef = useRef(questionBankId);
  useEffect(() => {
    fetchTags(questionBankId || undefined);
    // Only clear selected tag when bank actually changes (not on initial mount)
    if (prevBankIdRef.current !== questionBankId) {
      setSelectedTag("");
      prevBankIdRef.current = questionBankId;
    }
  }, [questionBankId, fetchTags]);

  const fetchQuestions = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (questionBankId) params.set("questionBankId", questionBankId);
      if (difficulty) params.set("difficulty", difficulty);
      if (type) params.set("type", type);
      if (selectedTag) params.set("tags", selectedTag);

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
  }, [search, questionBankId, difficulty, type, selectedTag]);

  useEffect(() => {
    fetchQuestions(1);
  }, [fetchQuestions]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchQuestions(1);
  }

  async function handleDeleteBank(bankId: string, bankName: string, questionCount: number) {
    // Fetch impact data before confirming
    try {
      const impactRes = await fetch(`/api/question-banks/${bankId}/impact`);
      if (impactRes.ok) {
        const impact = await impactRes.json();
        const lines = [
          `確定要刪除題庫「${bankName}」嗎？`,
          "",
          "⚠️ 此操作無法復原，將刪除以下資料：",
          `  - ${impact.questionCount} 道題目`,
        ];
        if (impact.affectedUsers > 0) {
          lines.push(`  - 影響 ${impact.affectedUsers} 位使用者`);
        }
        if (impact.examCount > 0) {
          lines.push(`  - ${impact.examCount} 場考試的 ${impact.examAnswerCount} 筆作答記錄`);
        }
        if (impact.noteCount > 0) {
          lines.push(`  - ${impact.noteCount} 則筆記`);
        }
        if (impact.favoriteCount > 0) {
          lines.push(`  - ${impact.favoriteCount} 個收藏`);
        }
        if (impact.wrongRecordCount > 0) {
          lines.push(`  - ${impact.wrongRecordCount} 筆錯題記錄`);
        }
        const confirmed = window.confirm(lines.join("\n"));
        if (!confirmed) return;
      } else {
        // Fallback to simple confirm
        const confirmed = window.confirm(
          `確定要刪除題庫「${bankName}」嗎？\n\n⚠️ 這會同時刪除該題庫下的 ${questionCount} 題，此操作無法復原。`
        );
        if (!confirmed) return;
      }
    } catch {
      const confirmed = window.confirm(
        `確定要刪除題庫「${bankName}」嗎？\n\n⚠️ 這會同時刪除該題庫下的 ${questionCount} 題，此操作無法復原。`
      );
      if (!confirmed) return;
    }

    setDeletingBankId(bankId);
    try {
      const res = await fetch(`/api/question-banks/${bankId}`, { method: "DELETE" });
      if (res.ok) {
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

  async function handleToggleHidden(bankId: string) {
    try {
      const res = await fetch("/api/hidden-banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionBankId: bankId }),
      });
      if (res.ok) {
        await fetchHiddenBanks();
        // Clear filter if the hidden bank was currently selected
        if (questionBankId === bankId) {
          setQuestionBankId("");
        }
        // Refresh questions list and tags to reflect the change
        fetchQuestions(1);
        fetchTags(questionBankId === bankId ? undefined : questionBankId || undefined);
      }
    } catch {
      alert("操作失敗，請重試");
    }
  }

  async function handleTogglePublic(bankId: string, currentlyPublic: boolean) {
    try {
      const res = await fetch(`/api/question-banks/${bankId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: !currentlyPublic }),
      });
      if (res.ok) {
        await fetchBanks();
      }
    } catch {
      alert("修改失敗，請重試");
    }
  }

  async function handleRenameBank(bankId: string) {
    if (!editingName.trim()) return;
    setSavingBankId(bankId);
    try {
      const res = await fetch(`/api/question-banks/${bankId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim(), category: editingCategory.trim() || null }),
      });
      if (res.ok) {
        await fetchBanks();
        setEditingBankId(null);
        setEditingName("");
        setEditingCategory("");
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

  function toggleCategory(cat: string) {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
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
          {(currentUserRole === "ADMIN" || currentUserRole === "TEACHER") && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Question Bank Manager */}
      {showBankManager && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">題庫列表</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHidden(!showHidden)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-full transition-colors border",
                  showHidden
                    ? "text-amber-600 bg-amber-50 border-amber-200"
                    : "text-gray-500 bg-gray-50 border-gray-200 hover:bg-gray-100"
                )}
              >
                {showHidden ? "隱藏已隱藏題庫" : `顯示已隱藏題庫 (${hiddenBankIds.size})`}
              </button>
              <span className="text-sm text-gray-600">共 {showHidden ? questionBanks.length : questionBanks.filter((b) => !hiddenBankIds.has(b.id)).length} 個題庫</span>
            </div>
          </div>

          {questionBanks.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>尚無題庫</p>
              <p className="text-sm mt-1">匯入題目時會自動建立題庫</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupBanksByCategory(
                questionBanks.filter((bank) => showHidden || !hiddenBankIds.has(bank.id))
              ).map((group) => {
                const isCollapsed = collapsedCategories.has(group.category);
                const totalQuestions = group.banks.reduce((sum, b) => sum + (b._count?.questions ?? 0), 0);
                return (
                  <div key={group.category} className="border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden">
                    {/* Category header */}
                    <button
                      onClick={() => toggleCategory(group.category)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-150 dark:hover:bg-gray-650 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <svg className={cn("w-4 h-4 text-gray-500 transition-transform", !isCollapsed && "rotate-90")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{group.category}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{group.banks.length} 個題庫</span>
                        <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{totalQuestions} 題</span>
                      </div>
                    </button>
                    {/* Bank list */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {group.banks.map((bank) => {
                          const isOwner = bank.createdById === currentUserId;
                          const canManage = isOwner || currentUserRole === "ADMIN";
                          const isHidden = hiddenBankIds.has(bank.id);
                          return (
                            <div
                              key={bank.id}
                              className={cn(
                                "flex items-center justify-between p-4 transition-colors group",
                                isHidden ? "bg-gray-50 dark:bg-gray-800 opacity-60" : "bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750"
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                {editingBankId === bank.id ? (
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-gray-500 w-10 flex-shrink-0">名稱</label>
                                      <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameBank(bank.id); if (e.key === "Escape") { setEditingBankId(null); setEditingName(""); setEditingCategory(""); } }}
                                        className="flex-1 px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        autoFocus
                                      />
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-xs text-gray-500 w-10 flex-shrink-0">分類</label>
                                      <input
                                        type="text"
                                        value={editingCategory}
                                        onChange={(e) => setEditingCategory(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") handleRenameBank(bank.id); if (e.key === "Escape") { setEditingBankId(null); setEditingName(""); setEditingCategory(""); } }}
                                        placeholder="例如：CCSP、CISSP"
                                        className="flex-1 px-3 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div className="flex items-center gap-2 ml-12">
                                      <button
                                        onClick={() => handleRenameBank(bank.id)}
                                        disabled={savingBankId === bank.id}
                                        className="px-3 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-all disabled:opacity-50"
                                      >
                                        {savingBankId === bank.id ? "..." : "儲存"}
                                      </button>
                                      <button
                                        onClick={() => { setEditingBankId(null); setEditingName(""); setEditingCategory(""); }}
                                        className="px-3 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
                                      >
                                        取消
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px] sm:max-w-xs">{bank.name}</p>
                                    <span className="inline-block px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium rounded-full flex-shrink-0">
                                      {bank._count?.questions ?? 0} 題
                                    </span>
                                    {bank.isPublic ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-full flex-shrink-0">公開</span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 text-xs font-medium rounded-full flex-shrink-0">私人</span>
                                    )}
                                    {isHidden && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 text-xs font-medium rounded-full flex-shrink-0">已隱藏</span>
                                    )}
                                    {!isOwner && bank.createdBy && (
                                      <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full flex-shrink-0 max-w-[120px] truncate">
                                        by {bank.createdBy.name || "匿名"}
                                      </span>
                                    )}
                                  </div>
                                )}
                                {bank.description && editingBankId !== bank.id && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">{bank.description}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                {editingBankId !== bank.id && (
                                  <>
                                    <button
                                      onClick={() => canManage && handleTogglePublic(bank.id, !!bank.isPublic)}
                                      disabled={!canManage}
                                      className={cn(
                                        "px-3 py-1.5 text-xs rounded-full transition-colors",
                                        !canManage
                                          ? "text-gray-400 bg-gray-100 cursor-not-allowed opacity-50"
                                          : bank.isPublic
                                            ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100"
                                            : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                                      )}
                                      title={!canManage ? "只有擁有者可以操作" : ""}
                                    >
                                      {bank.isPublic ? "設為私人" : "設為公開"}
                                    </button>
                                    <button
                                      onClick={() => canManage && (() => { setEditingBankId(bank.id); setEditingName(bank.name); setEditingCategory(bank.category || ""); })()}
                                      disabled={!canManage}
                                      className={cn(
                                        "px-3 py-1.5 text-xs rounded-full transition-colors",
                                        !canManage
                                          ? "text-gray-400 bg-gray-100 cursor-not-allowed opacity-50"
                                          : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                                      )}
                                      title={!canManage ? "只有擁有者可以操作" : ""}
                                    >
                                      編輯
                                    </button>
                                    <button
                                      onClick={() => { setQuestionBankId(bank.id); setShowBankManager(false); }}
                                      className="px-3 py-1.5 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-full transition-colors"
                                    >
                                      篩選
                                    </button>
                                    {!canManage && (
                                      <button
                                        onClick={() => handleToggleHidden(bank.id)}
                                        className={cn(
                                          "px-3 py-1.5 text-xs rounded-full transition-colors",
                                          isHidden
                                            ? "text-amber-600 bg-amber-50 hover:bg-amber-100"
                                            : "text-gray-600 bg-gray-100 hover:bg-gray-200"
                                        )}
                                      >
                                        {isHidden ? "取消隱藏" : "隱藏"}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => canManage && handleDeleteBank(bank.id, bank.name, bank._count?.questions ?? 0)}
                                      disabled={!canManage || deletingBankId === bank.id}
                                      className={cn(
                                        "px-3 py-1.5 text-xs rounded-full transition-colors",
                                        !canManage
                                          ? "text-gray-400 bg-gray-100 border border-gray-200 cursor-not-allowed opacity-50"
                                          : "text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                                      )}
                                      title={!canManage ? "只有擁有者可以刪除" : ""}
                                    >
                                      {deletingBankId === bank.id ? "刪除中..." : "刪除"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋關鍵字..."
            className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={questionBankId}
            onChange={(e) => setQuestionBankId(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部題庫</option>
            {groupBanksByCategory(
              questionBanks.filter((bank) => !hiddenBankIds.has(bank.id))
            ).map((group) => (
              <optgroup key={group.category} label={group.category}>
                {group.banks.map((bank) => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </optgroup>
            ))}
          </select>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部難度</option>
            {Object.entries(DIFFICULTY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>

          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">全部類型</option>
            <option value="SINGLE">單選題</option>
            <option value="MULTI">多選題</option>
            <option value="SCENARIO">情境題</option>
          </select>

          <TagFilterCombobox
            tags={allTags}
            value={selectedTag}
            onChange={setSelectedTag}
          />
        </div>
      </div>

      {/* Results info */}
      <p className="text-sm text-gray-600">共 {pagination.total} 題</p>

      {/* Question list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-700 rounded-2xl animate-pulse" />
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
              className="block bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all"
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
                      <button
                        key={i}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          window.open(`/knowledge/${encodeURIComponent(tag)}`, "_blank");
                        }}
                        className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                      >
                        {tag}
                      </button>
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

/* ── Searchable tag filter combobox ── */
function TagFilterCombobox({ tags, value, onChange }: { tags: string[]; value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? tags.filter((t) => t.toLowerCase().includes(search.toLowerCase()))
    : tags;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); setTimeout(() => inputRef.current?.focus(), 50); }}
        className={cn(
          "w-full text-left px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between gap-2",
          !value && "text-gray-500"
        )}
      >
        <span className="truncate">{value || "全部標籤"}</span>
        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋標籤..."
              className="w-full px-2.5 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              onMouseDown={(e) => { e.preventDefault(); onChange(""); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                !value ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              )}
            >
              全部標籤
            </button>
            {filtered.map((tag) => (
              <button
                key={tag}
                onMouseDown={(e) => { e.preventDefault(); onChange(tag); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  value === tag ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600" : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                )}
              >
                {tag}
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-gray-400 text-center">找不到相符的標籤</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
