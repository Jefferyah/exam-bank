"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

const navLinks = [
  { href: "/", label: "首頁" },
  { href: "/questions", label: "題庫" },
  { href: "/exam", label: "測驗" },
  { href: "/review", label: "複習" },
  { href: "/analytics", label: "分析" },
  { href: "/admin", label: "管理" },
];

function Logo({ isDark }: { isDark: boolean }) {
  return (
    <Link href="/" className="flex items-center flex-shrink-0">
      {isDark ? (
        /* Dark mode: text only, cyan gradient */
        <span className="text-2xl font-bold tracking-tight">
          <span className="text-[#f1f5f9]">Exam</span>
          <span className="text-[#38bdf8]">Bank</span>
        </span>
      ) : (
        /* Light mode: no icon, gradient purple text */
        <span className="text-2xl font-bold tracking-tight">
          <span className="text-gray-900">Exam</span><span className="bg-gradient-to-r from-[#6366f1] via-[#8b5cf6] to-[#a855f7] bg-clip-text text-transparent">Bank</span>
        </span>
      )}
    </Link>
  );
}

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    setMenuOpen(false);
    await signOut({ callbackUrl: "/login", redirect: false });
    window.location.assign("/login");
  }

  const isDark = theme === "dark";

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 border-b transition-colors",
        isDark
          ? "bg-[#0a0b10]/85 backdrop-blur-xl border-[rgba(255,255,255,0.06)]"
          : "bg-white/80 backdrop-blur-xl border-gray-100"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Logo isDark={isDark} />

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
                    isActive
                      ? isDark
                        ? "bg-[#38bdf8] text-[#0a0b10] font-semibold"
                        : "bg-gray-100 text-gray-900 font-semibold"
                      : isDark
                        ? "text-[#7a8599] hover:text-[#f1f5f9]"
                        : "text-gray-500 hover:text-gray-900"
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Right section */}
          <div className="hidden md:flex items-center space-x-3">
            <button
              onClick={toggleTheme}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                isDark
                  ? "text-[#7a8599] hover:text-[#f1f5f9] hover:bg-[rgba(255,255,255,0.04)]"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
              )}
              aria-label={isDark ? "淺色" : "暗色"}
            >
              {isDark ? (
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M4.72 4.72l1.06 1.06M18.22 18.22l1.06 1.06M3 12h1.5M19.5 12H21M4.72 19.28l1.06-1.06M18.22 5.78l1.06-1.06M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" /></svg>
              ) : (
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>
              )}
            </button>
            {status === "loading" ? (
              <div className="h-8 w-20 bg-gray-100 rounded-full animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center space-x-3">
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold",
                  isDark ? "bg-[#151821] text-[#38bdf8] border border-[rgba(255,255,255,0.06)]" : "bg-blue-50 text-blue-600"
                )}>
                  {(session.user.name || session.user.email || "U")[0].toUpperCase()}
                </div>
                <span className={cn("text-sm hidden lg:block", isDark ? "text-[#7a8599]" : "text-gray-500")}>
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className={cn(
                    "px-4 py-1.5 text-sm rounded-full transition-colors",
                    isDark
                      ? "text-[#7a8599] hover:text-[#f1f5f9] bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] border border-[rgba(255,255,255,0.06)]"
                      : "text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100"
                  )}
                >
                  登出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className={cn(
                  "px-5 py-2 text-sm rounded-full font-medium transition-all",
                  isDark
                    ? "bg-[#38bdf8] hover:bg-[#0ea5e9] text-[#0a0b10] shadow-[0_0_20px_rgba(56,189,248,0.2)]"
                    : "bg-gray-900 hover:bg-gray-800 text-white"
                )}
              >
                開始使用 →
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={cn(
              "md:hidden p-2 rounded-lg transition-colors",
              isDark ? "text-[#7a8599] hover:text-[#f1f5f9]" : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            )}
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
        <div className={cn(
          "px-4 pt-2 pb-4 space-y-1 border-t",
          isDark ? "border-[rgba(255,255,255,0.06)] bg-[rgba(10,11,16,0.98)]" : "border-gray-100 bg-white"
        )}>
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? isDark ? "bg-[#38bdf8] text-[#0a0b10]" : "bg-gray-100 text-gray-900"
                    : isDark ? "text-[#7a8599] hover:text-[#f1f5f9]" : "text-gray-600 hover:bg-gray-50"
                )}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <div className={cn("pt-3 border-t", isDark ? "border-[rgba(255,255,255,0.06)]" : "border-gray-100")}>
            <button
              onClick={() => { toggleTheme(); setMenuOpen(false); }}
              className={cn("w-full flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg", isDark ? "text-[#7a8599]" : "text-gray-600 hover:bg-gray-50")}
            >
              {isDark ? "淺色模式" : "暗色模式"}
            </button>
            {session?.user ? (
              <button onClick={handleLogout} className={cn("w-full text-left px-4 py-2.5 text-sm rounded-lg", isDark ? "text-[#7a8599]" : "text-gray-600 hover:bg-gray-50")}>
                登出
              </button>
            ) : (
              <Link href="/login" className={cn("block px-4 py-2.5 text-sm font-medium", isDark ? "text-[#38bdf8]" : "text-blue-500")} onClick={() => setMenuOpen(false)}>
                登入
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
