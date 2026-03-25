"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

interface AdminStats {
  totalUsers: number;
  totalQuestions: number;
  totalExams: number;
  recentActivity: { type: string; description: string; date: string }[];
}

export default function AdminPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Use available APIs to gather stats
        const questionsRes = await fetch("/api/questions?limit=1");
        let totalQuestions = 0;
        if (questionsRes.ok) {
          const data = await questionsRes.json();
          totalQuestions = data.pagination?.total || 0;
        }

        setStats({
          totalUsers: 0, // Would need admin API
          totalQuestions,
          totalExams: 0, // Would need admin API
          recentActivity: [],
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p>請先登入</p>
        <Link href="/login" className="text-indigo-400 hover:text-indigo-300 mt-2 inline-block">登入</Link>
      </div>
    );
  }

  if (role !== "ADMIN" && role !== "TEACHER") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p className="text-lg">權限不足</p>
        <p className="text-sm mt-1">僅限管理員或教師使用</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block">回首頁</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">管理後台</h1>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Stats cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="text-3xl font-bold text-indigo-400">{stats?.totalUsers || "--"}</p>
              <p className="text-sm text-slate-400 mt-1">使用者總數</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="text-3xl font-bold text-emerald-400">{stats?.totalQuestions || 0}</p>
              <p className="text-sm text-slate-400 mt-1">題目總數</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-6">
              <p className="text-3xl font-bold text-amber-400">{stats?.totalExams || "--"}</p>
              <p className="text-sm text-slate-400 mt-1">測驗總數</p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-indigo-500/50 rounded-lg p-6 transition-all"
            >
              <h3 className="font-semibold text-indigo-400">使用者管理</h3>
              <p className="text-sm text-slate-400 mt-1">管理使用者帳號與角色</p>
            </Link>
            <Link
              href="/questions"
              className="bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-indigo-500/50 rounded-lg p-6 transition-all"
            >
              <h3 className="font-semibold text-emerald-400">題庫管理</h3>
              <p className="text-sm text-slate-400 mt-1">新增、編輯、匯入題目</p>
            </Link>
            <Link
              href="/questions/import"
              className="bg-slate-800 hover:bg-slate-750 hover:ring-1 hover:ring-indigo-500/50 rounded-lg p-6 transition-all"
            >
              <h3 className="font-semibold text-amber-400">匯入匯出</h3>
              <p className="text-sm text-slate-400 mt-1">批量匯入或匯出題目</p>
            </Link>
          </div>

          {/* Recent activity */}
          <div className="bg-slate-800 rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">近期活動</h2>
            {stats?.recentActivity && stats.recentActivity.length > 0 ? (
              <div className="space-y-3">
                {stats.recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div>
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-slate-500">{activity.type}</p>
                    </div>
                    <span className="text-xs text-slate-500">{activity.date}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">尚無近期活動記錄</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
