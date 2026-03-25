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
  createdAt: string;
  usedAt: string | null;
  createdBy: { name: string | null; email: string | null };
  usedBy: { name: string | null; email: string | null } | null;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generateCount, setGenerateCount] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

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
        body: JSON.stringify({ count: generateCount }),
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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">
        <p>請先登入</p>
        <Link href="/login" className="text-emerald-600 hover:text-emerald-700 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  if (role !== "ADMIN" && role !== "TEACHER") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-500">
        <p className="text-lg text-gray-900">權限不足</p>
        <p className="text-sm mt-1">僅限管理員或教師使用</p>
        <Link href="/" className="text-emerald-600 hover:text-emerald-700 mt-4 inline-block">回首頁</Link>
      </div>
    );
  }

  const unusedCodes = inviteCodes.filter((c) => !c.usedBy);
  const usedCodes = inviteCodes.filter((c) => c.usedBy);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>

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
            <div className="glass-card rounded-2xl p-6">
              <p className="text-3xl font-bold text-emerald-600">{stats?.totalQuestions || 0}</p>
              <p className="text-sm text-gray-500 mt-1">題目總數</p>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <p className="text-3xl font-bold text-emerald-500">{unusedCodes.length}</p>
              <p className="text-sm text-gray-500 mt-1">可用邀請碼</p>
            </div>
            <div className="glass-card rounded-2xl p-6">
              <p className="text-3xl font-bold text-amber-500">{usedCodes.length}</p>
              <p className="text-sm text-gray-500 mt-1">已使用邀請碼</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="glass-card hover:border-emerald-300 hover:shadow-sm rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-blue-500">使用者管理</h3>
              <p className="text-sm text-gray-500 mt-1">管理帳號與角色</p>
            </Link>
            <Link
              href="/questions"
              className="glass-card hover:border-emerald-300 hover:shadow-sm rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-emerald-500">題庫管理</h3>
              <p className="text-sm text-gray-500 mt-1">新增、編輯、匯入題目</p>
            </Link>
            <Link
              href="/questions/import"
              className="glass-card hover:border-emerald-300 hover:shadow-sm rounded-2xl p-5 transition-all"
            >
              <h3 className="font-semibold text-amber-500">匯入匯出</h3>
              <p className="text-sm text-gray-500 mt-1">批量匯入或匯出題目</p>
            </Link>
          </div>

          {/* Invite Codes Management */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-lg font-semibold text-gray-900">邀請碼管理</h2>
              <div className="flex items-center gap-2">
                <select
                  value={generateCount}
                  onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                  className="px-3 py-2 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)' }}
                >
                  {[1, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>{n} 組</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerateCodes}
                  disabled={generating}
                  className="btn-nature rounded-full text-sm font-medium transition-colors"
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
                      ic.usedBy
                        ? "bg-gray-50 border-gray-200"
                        : "bg-emerald-50/50 border-emerald-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <code className={cn(
                        "font-mono text-sm font-bold px-2.5 py-1 rounded-lg",
                        ic.usedBy
                          ? "bg-gray-100 text-gray-400 line-through"
                          : "bg-white text-emerald-600 border border-emerald-200"
                      )}>
                        {ic.code}
                      </code>
                      <div className="text-xs text-gray-500">
                        {ic.usedBy ? (
                          <span>已被 <span className="text-gray-700 font-medium">{ic.usedBy.name || ic.usedBy.email}</span> 使用</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">未使用</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {new Date(ic.createdAt).toLocaleDateString("zh-TW")}
                      </span>
                      {!ic.usedBy && (
                        <button
                          onClick={() => copyCode(ic.code)}
                          className="px-3 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-full text-xs text-gray-600 transition-colors"
                        >
                          {copied === ic.code ? "已複製!" : "複製"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
