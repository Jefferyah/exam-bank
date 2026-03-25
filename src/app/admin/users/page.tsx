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
  ADMIN: "bg-red-50 text-red-600 border border-red-200",
  TEACHER: "bg-amber-50 text-amber-600 border border-amber-200",
  STUDENT: "bg-emerald-50 text-emerald-600 border border-emerald-200",
};

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      return;
    }

    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        } else {
          const data = await res.json();
          setError(data.error || "無法載入使用者");
        }
      } catch (err) {
        console.error(err);
        setError("載入失敗");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [session, status]);

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, newRole }),
      });
      if (res.ok) {
        const data = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === data.user.id ? { ...u, role: data.user.role } : u))
        );
      } else {
        const data = await res.json();
        alert(data.error || "更新失敗");
      }
    } catch (err) {
      console.error(err);
    }
  }

  const role = (session?.user as { role?: string } | undefined)?.role;

  if (status === "loading") {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!session || role !== "ADMIN") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-600">
        <p className="text-lg">權限不足</p>
        <Link href="/" className="text-gray-900 hover:text-gray-700 mt-4 inline-block font-medium">回首頁</Link>
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
        <Link href="/admin" className="text-gray-600 hover:text-gray-900">&larr; 返回管理</Link>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">使用者管理</h1>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="搜尋使用者..."
        className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm text-center">
          <p className="text-gray-600">
            {search ? "找不到符合的使用者" : "尚無使用者"}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">名稱</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">角色</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">建立日期</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name || "--"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email || "--"}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-2.5 py-0.5 text-xs rounded-full font-medium",
                        ROLE_COLORS[user.role] || "bg-gray-100 text-gray-600"
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {new Date(user.createdAt).toLocaleDateString("zh-TW")}
                    </td>
                    <td className="px-4 py-3">
                      {user.id === session.user?.id ? (
                        <span className="text-xs text-gray-400">目前帳號</span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="STUDENT">STUDENT</option>
                          <option value="TEACHER">TEACHER</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      )}
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
