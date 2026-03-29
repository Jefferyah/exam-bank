"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isNewUser = inviteCode.trim().length > 0;

  async function handleCredentialLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("請輸入 Email");
      return;
    }
    if (!password) {
      setError("請輸入密碼");
      return;
    }
    if (isNewUser && password !== confirmPassword) {
      setError("兩次密碼輸入不一致，請重新確認");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        inviteCode: inviteCode.trim(),
        callbackUrl: "/",
        redirect: false,
      });

      if (result?.error) {
        if (result.error.includes("INVITE_CODE_INVALID")) {
          setError("邀請碼無效");
        } else if (result.error.includes("INVITE_CODE_EXHAUSTED")) {
          setError("此邀請碼已達使用上限");
        } else if (result.error.includes("WEAK_PASSWORD")) {
          setError("密碼需至少 8 個字元，包含英文字母和數字");
        } else {
          // Unified message for: wrong password, email not found, missing invite code, etc.
          // Prevents email enumeration
          setError("帳號或密碼錯誤，若為新用戶請填寫邀請碼");
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

        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 space-y-6 border border-gray-200 dark:border-gray-700">
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
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                密碼
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isNewUser ? "設定您的密碼" : "輸入密碼"}
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              {isNewUser && (
                <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                  ⚠ 此密碼將作為您日後的登入密碼，請妥善記住
                </p>
              )}
            </div>

            {/* Confirm password — only shown for new users */}
            {isNewUser && (
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  確認密碼
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次輸入密碼"
                  className={`w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    confirmPassword && password !== confirmPassword
                      ? "border-red-400 dark:border-red-500"
                      : "border-gray-200 dark:border-gray-600"
                  }`}
                  disabled={loading}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">密碼不一致</p>
                )}
              </div>
            )}

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
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-400">已有帳號輸入 Email 和密碼即可登入</p>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isNewUser && password !== confirmPassword)}
              className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-full text-white font-medium shadow-sm transition-colors"
            >
              {loading ? "登入中..." : isNewUser ? "註冊" : "登入"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
