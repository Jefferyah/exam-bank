"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface UserStat {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  totalExams: number;
  totalAnswered: number;
  totalCorrect: number;
  accuracy: number;
  practiceMinutes: number;
  activeToday: boolean;
}

interface Summary {
  totalUsers: number;
  activeToday: number;
  totalExams: number;
  totalAnswered: number;
  totalCorrect: number;
  globalAccuracy: number;
  totalPracticeHours: number;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "管理員",
  TEACHER: "教師",
  STUDENT: "學員",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400",
  TEACHER: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  STUDENT: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400",
};

type SortKey = "name" | "totalAnswered" | "accuracy" | "practiceMinutes" | "totalExams";

export default function AdminStatsPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalAnswered");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("ALL");

  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status !== "authenticated" || role !== "ADMIN") return;
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUsers(data.users);
          setSummary(data.summary);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, role]);

  if (status === "loading" || loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">
        載入中...
      </div>
    );
  }

  if (role !== "ADMIN") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-600">
        <p>僅限管理員查看</p>
        <Link href="/" className="text-blue-500 hover:text-blue-600 mt-2 inline-block">
          返回首頁
        </Link>
      </div>
    );
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const filtered = filterRole === "ALL" ? users : users.filter((u) => u.role === filterRole);
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    if (typeof va === "string" && typeof vb === "string") {
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
  });

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} 分鐘`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} 小時 ${m} 分` : `${h} 小時`;
  };

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <button
      onClick={() => handleSort(field)}
      className={cn(
        "flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors",
        sortKey === field ? "text-purple-600 dark:text-purple-400" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      )}
    >
      {label}
      {sortKey === field && (
        <span className="text-[10px]">{sortAsc ? "↑" : "↓"}</span>
      )}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            學員總覽
          </h1>
          <p className="text-sm text-gray-500 mt-1">管理員上帝視角 — 查看所有學員的學習狀況</p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        >
          ← 返回管理
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "總用戶", value: summary.totalUsers, sub: `今日活躍 ${summary.activeToday}` },
            { label: "總做題數", value: summary.totalAnswered.toLocaleString(), sub: `${summary.totalExams} 場考試` },
            { label: "總答對率", value: `${summary.globalAccuracy}%`, sub: `${summary.totalCorrect.toLocaleString()} 題答對` },
            { label: "總練習時數", value: `${summary.totalPracticeHours}h`, sub: "模擬考計時累計" },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-4 shadow-sm"
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{card.label}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{card.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter + Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">篩選：</span>
            {["ALL", "STUDENT", "TEACHER", "ADMIN"].map((r) => (
              <button
                key={r}
                onClick={() => setFilterRole(r)}
                className={cn(
                  "px-3 py-1 text-xs rounded-full transition-colors",
                  filterRole === r
                    ? "bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                )}
              >
                {r === "ALL" ? "全部" : ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{sorted.length} 人</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-750">
                <th className="text-left px-5 py-3">
                  <SortHeader label="學員" field="name" />
                </th>
                <th className="text-center px-3 py-3 hidden sm:table-cell">角色</th>
                <th className="text-right px-3 py-3">
                  <SortHeader label="做題數" field="totalAnswered" />
                </th>
                <th className="text-right px-3 py-3">
                  <SortHeader label="考試數" field="totalExams" />
                </th>
                <th className="text-right px-3 py-3">
                  <SortHeader label="答對率" field="accuracy" />
                </th>
                <th className="text-right px-5 py-3">
                  <SortHeader label="練習時數" field="practiceMinutes" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {sorted.map((user) => (
                <tr
                  key={user.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {user.activeToday && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="今日活躍" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-3 py-3 hidden sm:table-cell">
                    <span className={cn("inline-block px-2 py-0.5 text-[10px] font-medium rounded-full", ROLE_COLORS[user.role] || "bg-gray-100 text-gray-500")}>
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                  </td>
                  <td className="text-right px-3 py-3 tabular-nums text-gray-900 dark:text-gray-100 font-medium">
                    {user.totalAnswered.toLocaleString()}
                  </td>
                  <td className="text-right px-3 py-3 tabular-nums text-gray-600 dark:text-gray-400">
                    {user.totalExams}
                  </td>
                  <td className="text-right px-3 py-3">
                    <span
                      className={cn(
                        "tabular-nums font-medium",
                        user.totalAnswered === 0
                          ? "text-gray-300 dark:text-gray-600"
                          : user.accuracy >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : user.accuracy >= 60
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-500 dark:text-red-400"
                      )}
                    >
                      {user.totalAnswered > 0 ? `${user.accuracy}%` : "—"}
                    </span>
                  </td>
                  <td className="text-right px-5 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                    {user.practiceMinutes > 0 ? formatMinutes(user.practiceMinutes) : "—"}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400">
                    沒有符合條件的用戶
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
