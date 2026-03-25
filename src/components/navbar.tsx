"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

const navLinks = [
  { href: "/", label: "首頁", icon: "🏠" },
  { href: "/questions", label: "題庫", icon: "📚" },
  { href: "/exam", label: "測驗", icon: "✏️" },
  { href: "/review", label: "複習", icon: "🔄" },
  { href: "/analytics", label: "分析", icon: "📊" },
  { href: "/admin", label: "管理", icon: "⚙️" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    setMenuOpen(false);
    await signOut({
      callbackUrl: "/login",
      redirect: false,
    });
    window.location.assign("/login");
  }

  const isDark = theme === "dark";

  return (
    <nav className="sticky top-0 z-50 glass-card border-b-0" style={{ borderBottom: '1px solid var(--glass-border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2">
            <span className="text-2xl">🌿</span>
            <span className="text-xl font-bold">
              <span className="text-emerald-700 dark:text-emerald-400">Exam</span>
              <span className="text-amber-600 dark:text-amber-400">Bank</span>
            </span>
          </Link>

          {/* Desktop nav - centered pill tabs */}
          <div className="hidden md:flex items-center rounded-full p-1" style={{ background: 'var(--accent-bg)' }}>
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-white shadow-sm text-emerald-700"
                      : "text-gray-500 hover:text-emerald-700"
                  )}
                  style={isActive ? { background: 'var(--card-solid)' } : {}}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User section */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 hover:scale-105"
              style={{ background: 'var(--accent-bg)', color: 'var(--muted)' }}
              aria-label={isDark ? "切換為淺色模式" : "切換為暗色模式"}
              title={isDark ? "切換為淺色模式" : "切換為暗色模式"}
            >
              {isDark ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.72 4.72l1.06 1.06M18.22 18.22l1.06 1.06M3 12h1.5M19.5 12H21M4.72 19.28l1.06-1.06M18.22 5.78l1.06-1.06M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
            {status === "loading" ? (
              <div className="h-8 w-20 rounded-full animate-pulse" style={{ background: 'var(--accent-bg)' }} />
            ) : session?.user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm" style={{ color: 'var(--muted)' }}>
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="btn-secondary px-4 py-1.5 text-sm"
                >
                  登出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="btn-nature px-5 py-2 text-sm"
              >
                登入
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-xl transition-colors"
            style={{ color: 'var(--muted)' }}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={cn("md:hidden", menuOpen ? "block" : "hidden")}>
        <div className="px-4 pt-2 pb-4 space-y-1" style={{ borderTop: '1px solid var(--border)', background: 'var(--card-solid)' }}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "text-emerald-700"
                    : "hover:text-emerald-700"
                )}
                style={isActive ? { background: 'var(--primary-light)', color: 'var(--primary)' } : { color: 'var(--muted)' }}
                onClick={() => setMenuOpen(false)}
              >
                <span className="mr-2">{link.icon}</span>
                {link.label}
              </Link>
            );
          })}
          <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => {
                toggleTheme();
                setMenuOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-xl"
              style={{ color: 'var(--muted)' }}
            >
              {isDark ? (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.72 4.72l1.06 1.06M18.22 18.22l1.06 1.06M3 12h1.5M19.5 12H21M4.72 19.28l1.06-1.06M18.22 5.78l1.06-1.06M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
              <span>{isDark ? "切換為淺色模式" : "切換為暗色模式"}</span>
            </button>
            {session?.user ? (
              <div className="space-y-2">
                <p className="px-4 text-sm" style={{ color: 'var(--muted)' }}>{session.user.name || session.user.email}</p>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm rounded-xl transition-colors"
                  style={{ color: 'var(--muted)' }}
                >
                  登出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="block px-4 py-2.5 text-sm font-medium"
                style={{ color: 'var(--primary)' }}
                onClick={() => setMenuOpen(false)}
              >
                登入
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
