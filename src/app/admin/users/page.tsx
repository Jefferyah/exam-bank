"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  createdAt: string;
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-500/20 text-red-400",
  TEACHER: "bg-amber-500/20 text-amber-400",
  STUDENT: "bg-emerald-500/20 text-emerald-400",
};

export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        // This would need an admin users API endpoint
        // For now, show a placeholder
        setUsers([]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      // This would call an admin API to change user role
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      console.error(err);
    }
  }

  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session || (role !== "ADMIN" && role !== "TEACHER")) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-slate-400">
        <p className="text-lg">權限不足</p>
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 mt-4 inline-block">回首頁</Link>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const lower = search.toLowerCase();
    return (
      u.name?.toLowerCase().includes(lower) ||
      u.email?.toLowerCase().includes(lower)
    );
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-slate-400 hover:text-white">&larr; 返回管理</Link>
        <h1 className="text-2xl font-bold">使用者管理</h1>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋使用者..."
        className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-8 text-center">
          <p className="text-slate-500">
            {users.length === 0
              ? "需要建立管理員 API 端點以載入使用者列表"
              : "找不到符合的使用者"
            }
          </p>
          <p className="text-sm text-slate-600 mt-2">
            建議在 /api/admin/users 建立相關 API
          </p>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">名稱</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">角色</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">建立日期</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm">{user.name || "--"}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{user.email || "--"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2 py-0.5 text-xs rounded-full font-medium",
                        ROLE_COLORS[user.role] || "bg-slate-700 text-slate-400"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                        className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="STUDENT">STUDENT</option>
                        <option value="TEACHER">TEACHER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
