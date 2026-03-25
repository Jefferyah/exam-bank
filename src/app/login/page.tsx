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
          <p className="text-4xl mb-3">🌿</p>
          <h1 className="text-3xl font-bold">
            <span className="text-emerald-700">Exam</span>
            <span className="text-amber-600">Bank</span>
          </h1>
          <p className="mt-2" style={{ color: 'var(--muted)' }}>登入以開始學習</p>
        </div>

        <div className="glass-card rounded-2xl p-8 space-y-6">
          {/* Email login */}
          <form onSubmit={handleCredentialLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="inviteCode" className="block text-sm font-medium mb-1">
                邀請碼 <span style={{ color: 'var(--muted)' }} className="font-normal">（新用戶必填）</span>
              </label>
              <input
                id="inviteCode"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="輸入邀請碼"
                className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                style={{ background: 'var(--accent-bg)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
                disabled={loading}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>已有帳號直接輸入 Email 即可登入</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 btn-nature text-sm"
            >
              {loading ? "登入中..." : "登入 / 註冊"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
