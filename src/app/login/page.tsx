"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("請輸入 Email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        inviteCode: inviteCode.trim(),
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("INVITE_CODE_REQUIRED")) {
          setError("新用戶需要邀請碼才能註冊");
        } else if (result.error.includes("INVITE_CODE_INVALID")) {
          setError("邀請碼無效");
        } else if (result.error.includes("INVITE_CODE_USED")) {
          setError("此邀請碼已被使用");
        } else {
          setError("登入失敗，請重試");
        }
      } else {
        window.location.assign("/");
      }
    } catch {
      setError("登入失敗，請重試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="hero-gradient min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            歡迎回來
          </h1>
          <p className="mt-2 text-gray-500">登入 ExamBank 開始學習</p>
        </div>

        <div className="bg-white shadow-xl rounded-2xl p-8 space-y-6 border border-gray-200">
          {/* Email login */}
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-1">
                邀請碼 <span className="text-gray-400 font-normal">（新用戶必填）</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="輸入邀請碼"
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-400">已有帳號直接輸入 Email 即可登入</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-white font-medium shadow-sm transition-colors"
            >
              {loading ? "登入中..." : "登入 / 註冊"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
