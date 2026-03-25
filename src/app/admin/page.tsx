"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface AdminStats {
  totalUsers: number;
  totalQuestions: number;
  totalExams: number;
}

interface InviteCode {
  id: string;
  code: string;
  maxUses: number;
  usedCount: number;
  createdAt: string;
  usedAt: string | null;
  createdBy: { name: string | null; email: string | null };
  usedBy: { name: string | null; email: string | null } | null;
}

interface QuestionBankOption {
  id: string;
  name: string;
}

type ResetScope = "all" | "wrong" | "exams" | null;

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [generateMaxUses, setGenerateMaxUses] = useState(0); // 0 = unlimited
  const [copied, setCopied] = useState<string | null>(null);
  const [resetScope, setResetScope] = useState<ResetScope>(null);
  const [resetBankId, setResetBankId] = useState<string>("");
  const [questionBanks, setQuestionBanks] = useState<QuestionBankOption[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      return;
    }

    async function fetchData() {
      try {
        const [questionsRes, codesRes] = await Promise.all([
          fetch("/api/questions?limit=1"),
          fetch("/api/invite-codes"),
        ]);

        let totalQuestions = 0;
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          totalQuestions = data.pagination?.total || 0;
        }

        setStats({
          totalUsers: 0,
          totalQuestions,
          totalExams: 0,
        });

        if (codesRes.ok) {
          const data = await codesRes.json();
          setInviteCodes(data.inviteCodes || []);
        }

        // Fetch question banks for reset filter
        const banksRes = await fetch("/api/question-banks");
        if (banksRes.ok) {
          const banksData = await banksRes.json();
          setQuestionBanks(
            (banksData.questionBanks || []).map((b: { id: string; name: string }) => ({
              id: b.id,
              name: b.name,
            }))
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session, status]);

  async function handleGenerateCodes() {
    setGenerating(true);
    try {
      const res = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: generateCount, maxUses: generateMaxUses }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteCodes((prev) => [...data.inviteCodes, ...prev]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  }

  async function handleReset() {
    if (!resetScope) return;

    const scopeLabels: Record<string, string> = {
      all: "全部學習記錄（測驗、錯題、筆記、收藏、難度設定）",
      wrong: "所有錯題記錄",
      exams: "所有測驗記錄",
    };

    const confirmed = confirm(
      `確定要重置${scopeLabels[resetScope]}嗎？此操作無法復原！`
    );
    if (!confirmed) return;

    setResetting(true);
    setResetMessage(null);
    try {
      const res = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: resetScope,
          ...(resetBankId ? { questionBankId: resetBankId } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const counts = Object.entries(data.deleted || {})
          .map(([, v]) => v as number)
          .reduce((a, b) => a + b, 0);
        setResetMessage({ type: "success", text: `重置成功！共刪除 ${counts} 筆記錄` });
        setResetScope(null);
        setResetBankId("");
      } else {
        const data = await res.json();
        setResetMessage({ type: "error", text: data.error || "重置失敗" });
      }
    } catch (err) {
      console.error(err);
      setResetMessage({ type: "error", text: "重置失敗，請稍後再試" });
    } finally {
      setResetting(false);
    }
  }

  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>請先登入</p>
        <Link href="/login" className="text-gray-900 hover:text-gray-700 mt-2 inline-block font-medium">登入</Link>
      </div>
    );
  }

  const isAdmin = role === "ADMIN" || role === "TEACHER";

  const unusedCodes = inviteCodes.filter((c) => c.maxUses === 0 || c.usedCount < c.maxUses);
  const usedCodes = inviteCodes.filter((c) => c.maxUses > 0 && c.usedCount >= c.maxUses);

  const resetSection = (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">重置學習記錄</h2>
        <p className="text-sm text-gray-500 mt-1">清除你的學習數據，重新開始</p>
      </div>

      {/* Scope selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => setResetScope(resetScope === "all" ? null : "all")}
          className={cn(
            "text-left rounded-xl border p-4 transition-all",
            resetScope === "all"
              ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300"
          )}
        >
          <p className="font-medium text-gray-900 text-sm">全部重置</p>
          <p className="text-xs text-gray-500 mt-1">清除所有測驗記錄、錯題、筆記、收藏</p>
        </button>
        <button
          type="button"
          onClick={() => setResetScope(resetScope === "wrong" ? null : "wrong")}
          className={cn(
            "text-left rounded-xl border p-4 transition-all",
            resetScope === "wrong"
              ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300"
          )}
        >
          <p className="font-medium text-gray-900 text-sm">僅重置錯題</p>
          <p className="text-xs text-gray-500 mt-1">只清除錯題記錄</p>
        </button>
        <button
          type="button"
          onClick={() => setResetScope(resetScope === "exams" ? null : "exams")}
          className={cn(
            "text-left rounded-xl border p-4 transition-all",
            resetScope === "exams"
              ? "border-red-200 bg-red-50"
              : "border-gray-200 bg-gray-50 hover:border-gray-300"
          )}
        >
          <p className="font-medium text-gray-900 text-sm">僅重置測驗</p>
          <p className="text-xs text-gray-500 mt-1">只清除測驗記錄</p>
        </button>
      </div>

      {/* Optional question bank filter */}
      {resetScope && resetScope !== "all" && questionBanks.length > 0 && (
        <div>
          <label className="text-sm text-gray-600 block mb-1">指定題庫（可選）</label>
          <select
            value={resetBankId}
            onChange={(e) => setResetBankId(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 w-full sm:w-auto"
          >
            <option value="">全部題庫</option>
            {questionBanks.map((bank) => (
              <option key={bank.id} value={bank.id}>{bank.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Reset button & message */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleReset}
          disabled={!resetScope || resetting}
          className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white rounded-full text-sm font-medium transition-all"
        >
          {resetting ? "重置中..." : "確認重置"}
        </button>
        {resetMessage && (
          <p className={cn(
            "text-sm",
            resetMessage.type === "success" ? "text-emerald-600" : "text-red-600"
          )}>
            {resetMessage.text}
          </p>
        )}
      </div>
    </div>
  );

  if (!isAdmin) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">設定</h1>
        {resetSection}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">管理後台</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-blue-500">{stats?.totalQuestions || 0}</p>
              <p className="text-sm text-gray-600 mt-1">題目總數</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-emerald-500">{unusedCodes.length}</p>
              <p className="text-sm text-gray-600 mt-1">可用邀請碼</p>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <p className="text-3xl font-bold text-amber-500">{usedCodes.length}</p>
              <p className="text-sm text-gray-600 mt-1">已使用邀請碼</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-blue-500">使用者管理</h3>
              <p className="text-sm text-gray-600 mt-1">管理帳號與角色</p>
            </Link>
            <Link
              href="/questions"
              className="bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-emerald-500">題庫管理</h3>
              <p className="text-sm text-gray-600 mt-1">新增、編輯、匯入題目</p>
            </Link>
            <Link
              href="/questions/import"
              className="bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-amber-500">匯入匯出</h3>
              <p className="text-sm text-gray-600 mt-1">批量匯入或匯出題目</p>
            </Link>
          </div>

          {/* Invite Codes Management */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">邀請碼管理</h2>
              <div className="flex items-center gap-2">
                <select
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[1, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>{n} 組</option>
                  ))}
                </select>
                <select
                  value={generateMaxUses}
                  onChange={(e) => setGenerateMaxUses(parseInt(e.target.value))}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>不限次數</option>
                  <option value={1}>限用 1 次</option>
                  <option value={5}>限用 5 次</option>
                  <option value={10}>限用 10 次</option>
                  <option value={50}>限用 50 次</option>
                  <option value={100}>限用 100 次</option>
                </select>
                <button
                  onClick={handleGenerateCodes}
                  disabled={generating}
                  className="px-5 py-2 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-full text-sm font-medium transition-all"
                >
                  {generating ? "產生中..." : "產生邀請碼"}
                </button>
              </div>
            </div>

            {inviteCodes.length === 0 ? (
              <p className="text-gray-400 text-center py-8">尚無邀請碼，點擊上方按鈕產生</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {inviteCodes.map((ic) => (
                  <div
                    key={ic.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border",
                      (ic.maxUses > 0 && ic.usedCount >= ic.maxUses)
                        ? "bg-gray-50 border-gray-200"
                        : "bg-blue-50/50 border-blue-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <code className={cn(
                        "font-mono text-sm font-bold px-2.5 py-1 rounded-lg",
                        (ic.maxUses > 0 && ic.usedCount >= ic.maxUses)
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-white text-blue-600 border border-blue-200"
                      )}>
                        {ic.code}
                      </code>
                      <div className="text-xs text-gray-600 space-y-0.5">
                        <div>
                          已使用 <span className="font-medium text-gray-700">{ic.usedCount}</span> 次
                          {ic.maxUses > 0 ? (
                            <span> / {ic.maxUses} 次</span>
                          ) : (
                            <span className="text-blue-500 ml-1">（不限）</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {new Date(ic.createdAt).toLocaleDateString("zh-TW")}
                      </span>
                      <button
                        onClick={() => copyCode(ic.code)}
                        className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600 transition-colors"
                      >
                        {copied === ic.code ? "已複製!" : "複製"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reset Learning Records */}
          {resetSection}
        </>
      )}
    </div>
  );
}
