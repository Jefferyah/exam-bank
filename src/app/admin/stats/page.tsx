"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import ProgressRing, { scoreToColor } from "@/components/progress-ring";

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
  successRate: number | null;
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

interface CategoryScore {
  category: string;
  bankNames: string[];
  totalQuestions: number;
  questionsAttempted: number;
  indicators: {
    coverage: number;
    mastery: number;
    time: number;
    correction: number;
    trend: number;
  };
  rawValues: {
    masteryAccuracy: number;
    timeMinutes: number;
    targetMinutes: number;
    activeDays: number;
    correctedCount: number;
    wrongCount: number;
  };
  score: number;
}

interface SuccessRateData {
  categories: CategoryScore[];
  overallScore: number;
}

type SortKey = "name" | "totalAnswered" | "accuracy" | "practiceMinutes" | "totalExams";

export default function AdminStatsPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<UserStat[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("totalAnswered");
  const [sortAsc, setSortAsc] = useState(false);
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [successRateData, setSuccessRateData] = useState<SuccessRateData | null>(null);
  const [loadingRate, setLoadingRate] = useState(false);
  const [showScoreExplain, setShowScoreExplain] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserStat | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status !== "authenticated" || role !== "ADMIN") return;
    const params = filterCategory !== "ALL" ? `?category=${encodeURIComponent(filterCategory)}` : "";
    setLoading(true);
    fetch(`/api/admin/stats${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUsers(data.users);
          setSummary(data.summary);
          if (data.categories) setCategories(data.categories);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status, role, filterCategory]);

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

  const handleExpandUser = async (userId: string) => {
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      setSuccessRateData(null);
      return;
    }
    setExpandedUserId(userId);
    setSuccessRateData(null);
    setLoadingRate(true);
    try {
      const res = await fetch(`/api/admin/stats/success-rate?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setSuccessRateData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRate(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: deleteTarget.id }),
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
        if (expandedUserId === deleteTarget.id) {
          setExpandedUserId(null);
          setSuccessRateData(null);
        }
        setDeleteTarget(null);
      } else {
        const data = await res.json();
        alert(data.error || "刪除失敗");
      }
    } catch {
      alert("刪除失敗，請稍後重試");
    } finally {
      setDeleting(false);
    }
  };

  const INDICATOR_LABELS: Record<string, string> = {
    coverage: "覆蓋率",
    mastery: "精熟度",
    time: "投入時間",
    correction: "訂正率",
    trend: "近期趨勢",
  };

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

      {/* Score Explanation */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">點擊學員列可展開成功率分析</p>
        <button
          onClick={() => setShowScoreExplain(!showScoreExplain)}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          {showScoreExplain ? "收起計分說明 ▲" : "計分說明 ▼"}
        </button>
      </div>

      {showScoreExplain && (
        <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm space-y-3 text-xs text-gray-600 dark:text-gray-400">
          <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">成功率計分邏輯</p>
          <p>成功率以<strong>單一題庫分類</strong>為計分單位，只計算學員有接觸過的分類。總分 = 各分類依題數加權平均。</p>

          <div className="space-y-2.5">
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">1. 覆蓋率（25%）</p>
              <p>每題依作答次數給分：0 次 → 0%、1 次 → 50%、2 次 → 85%、3 次以上 → 100%。</p>
              <p>公式：所有題目得分加總 ÷ 該分類總題數 × 100%。未做過的題計入分母。</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">2. 精熟度（30%）</p>
              <p>第 2 次以上作答的正確率 × 題目覆蓋率，反映理解程度與廣度。</p>
              <p>分段線性：正確率 &lt;40% → 0~15 分、40~60% → 15~40 分、60~85% → 40~100 分、≥85% → 滿分。再乘以（已做題數 ÷ 總題數）。</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">3. 投入時間（15%）</p>
              <p>實際花費時間 ÷ 目標時間（每題 4 分鐘）。</p>
              <p>比例 ≥100% → 滿分、50~100% → 50~100 分、20~50% → 15~50 分、&lt;20% → 0~15 分。</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">4. 訂正率（15%）</p>
              <p>答錯過的題目後來有答對的比例。全部訂正 = 滿分，從未答錯也算滿分。未做過任何題目則為 0 分。</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">5. 近期趨勢（15%）</p>
              <p>過去 15 天的練習頻率，越近期權重越高：</p>
              <p>最近 5 天每天 1.5 分、6~10 天每天 1.0 分、11~15 天每天 0.5 分，滿分 15 分再換算百分比。</p>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-gray-100 dark:border-gray-700">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(85) }} />
              <span>70%+ 優秀（綠）</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(55) }} />
              <span>40~70% 待加強（黃）</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: scoreToColor(20) }} />
              <span>0~40% 需努力（紅）</span>
            </span>
          </div>

          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            備註：學員隱藏的題庫在學員端不計分，但管理員視角會包含所有題庫。
          </p>
        </div>
      )}

      {/* Filter + Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">角色：</span>
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
          <div className="flex items-center gap-2">
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">分類：</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-0 rounded-full px-3 py-1 focus:ring-2 focus:ring-purple-400 outline-none cursor-pointer"
                >
                  <option value="ALL">總成功率</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <span className="text-xs text-gray-400">{sorted.length} 人</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[9%] hidden sm:table-column" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
            </colgroup>
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
                <th className="text-right px-3 py-3">
                  <SortHeader label="練習時數" field="practiceMinutes" />
                </th>
                <th className="text-center px-3 py-3">
                  <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    {filterCategory === "ALL" ? "成功率" : filterCategory}
                  </span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {sorted.map((user) => (
                <React.Fragment key={user.id}>
                  <tr
                    onClick={() => handleExpandUser(user.id)}
                    className={cn(
                      "hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer",
                      expandedUserId === user.id && "bg-purple-50/50 dark:bg-purple-900/10"
                    )}
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
                        <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto flex-shrink-0">
                          {expandedUserId === user.id ? "▲" : "▼"}
                        </span>
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
                    <td className="text-right px-3 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                      {user.practiceMinutes > 0 ? formatMinutes(user.practiceMinutes) : "—"}
                    </td>
                    <td className="text-center px-3 py-3">
                      {user.successRate !== null ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <ProgressRing score={user.successRate} size={32} strokeWidth={3} showLabel={false} />
                          <span className="text-xs tabular-nums font-medium" style={{ color: scoreToColor(user.successRate) }}>
                            {user.successRate}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded success rate row */}
                  {expandedUserId === user.id && (
                    <tr>
                      <td colSpan={7} className="bg-gray-50/50 dark:bg-gray-800/50 px-5 py-5">
                        {loadingRate ? (
                          <div className="text-center text-gray-400 py-6">載入成功率分析中...</div>
                        ) : successRateData && successRateData.categories.length === 0 ? (
                          <div className="text-center text-gray-400 py-6">此學員尚未作答任何題目</div>
                        ) : successRateData ? (
                          <div className="space-y-5">
                            {/* Overall score */}
                            <div className="flex items-center gap-5">
                              <ProgressRing score={successRateData.overallScore} size={90} strokeWidth={7} label="總成功率" />
                              <div>
                                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                                  成功率總分：
                                  <span style={{ color: scoreToColor(successRateData.overallScore) }}>
                                    {successRateData.overallScore}%
                                  </span>
                                </p>
                                <p className="text-xs text-gray-400 mt-0.5">
                                  涵蓋 {successRateData.categories.length} 個題庫分類 · 依題數加權平均
                                </p>
                              </div>
                            </div>

                            {/* Per-category breakdown */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {successRateData.categories.map((cat) => (
                                <div
                                  key={cat.category}
                                  className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3"
                                >
                                  {/* Category header */}
                                  <div className="flex items-center gap-3">
                                    <ProgressRing score={cat.score} size={52} strokeWidth={5} showLabel={true} className="flex-shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                                        {cat.category}
                                      </p>
                                      <p className="text-[10px] text-gray-400 truncate">
                                        {cat.bankNames.join("、")}
                                      </p>
                                      <p className="text-[10px] text-gray-400">
                                        已做 {cat.questionsAttempted} / {cat.totalQuestions} 題
                                      </p>
                                    </div>
                                  </div>

                                  {/* 5 indicator bars */}
                                  {(() => {
                                    const rv = cat.rawValues;
                                    const RAW_DETAILS: Record<string, string> = {
                                      coverage: `已做 ${cat.questionsAttempted} / ${cat.totalQuestions} 題`,
                                      mastery: rv ? `第2次以上正確率 ${rv.masteryAccuracy}% × 覆蓋 ${cat.questionsAttempted}/${cat.totalQuestions} 題` : "",
                                      time: rv ? `已投入 ${rv.timeMinutes} 分 / 目標 ${rv.targetMinutes} 分` : "",
                                      correction: rv ? (rv.wrongCount === 0 ? "從未答錯" : `已訂正 ${rv.correctedCount} / ${rv.wrongCount} 題`) : "",
                                      trend: rv ? `近 15 天有 ${rv.activeDays} 天練習` : "",
                                    };
                                    return (
                                      <div className="space-y-2">
                                        {(Object.entries(cat.indicators) as [string, number][]).map(([key, value]) => (
                                          <div key={key}>
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] text-gray-500 dark:text-gray-400 w-14 text-right flex-shrink-0">
                                                {INDICATOR_LABELS[key]}
                                              </span>
                                              <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                  className="h-full rounded-full transition-all duration-500"
                                                  style={{
                                                    width: `${value}%`,
                                                    backgroundColor: scoreToColor(value),
                                                  }}
                                                />
                                              </div>
                                              <span className="text-[10px] tabular-nums w-8 text-right" style={{ color: scoreToColor(value) }}>
                                                {value}%
                                              </span>
                                            </div>
                                            {RAW_DETAILS[key] && (
                                              <p className="text-[9px] text-gray-400 dark:text-gray-500 ml-16 mt-0.5">{RAW_DETAILS[key]}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {/* Delete user button */}
                        {user.id !== session?.user?.id && (
                          <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(user); }}
                              className="px-4 py-1.5 text-xs font-medium text-red-500 hover:text-white hover:bg-red-500 border border-red-200 dark:border-red-800 rounded-full transition-all"
                            >
                              刪除此使用者
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400">
                    沒有符合條件的用戶
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">確認刪除使用者</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">此操作無法復原</p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-3 space-y-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{deleteTarget.name || "未命名"}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{deleteTarget.email}</p>
              <p className="text-xs text-gray-400">
                {ROLE_LABELS[deleteTarget.role] || deleteTarget.role} · 做題 {deleteTarget.totalAnswered} · 測驗 {deleteTarget.totalExams} 次
              </p>
            </div>

            <p className="text-sm text-red-600 dark:text-red-400">
              將永久刪除此使用者及其所有資料，包括測驗記錄、錯題、筆記、收藏、複習卡片等。
            </p>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white rounded-full text-sm font-medium transition-colors"
              >
                {deleting ? "刪除中..." : "確認刪除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
