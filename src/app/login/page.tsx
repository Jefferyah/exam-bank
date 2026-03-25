"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
        router.push("/");
      }
    } catch {
      setError("登入失敗，請重試");
    } finally {
      setLoading(false);
    }
  }

  async function handleGitHubLogin() {
    await signIn("github", { callbackUrl: "/" });
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">萬用題庫系統</h1>
          <p className="mt-2 text-gray-500">登入以開始學習</p>
        </div>

        <div className="bg-white shadow-lg rounded-2xl p-8 space-y-6 border border-gray-200">
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
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-full text-white font-medium shadow-sm transition-colors"
            >
              {loading ? "登入中..." : "登入 / 註冊"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-400">或</span>
            </div>
          </div>

          {/* GitHub login */}
          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full text-gray-700 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            以 GitHub 登入
          </button>
        </div>
      </div>
    </div>
  );
}
