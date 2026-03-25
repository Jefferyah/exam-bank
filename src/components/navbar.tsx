"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/", label: "首頁" },
  { href: "/questions", label: "題庫" },
  { href: "/exam", label: "測驗" },
  { href: "/review", label: "複習" },
  { href: "/analytics", label: "分析" },
  { href: "/notes", label: "筆記" },
  { href: "/admin", label: "Admin" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <span className="text-xl font-bold text-indigo-400">CISSP 題庫</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User section */}
          <div className="hidden md:flex items-center space-x-3">
            {status === "loading" ? (
              <div className="h-8 w-20 bg-slate-700 rounded animate-pulse" />
            ) : session?.user ? (
              <div className="flex items-center space-x-3">
                <span className="text-sm text-slate-300">
                  {session.user.name || session.user.email}
                </span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 rounded-md transition-colors"
                >
                  登出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors font-medium"
              >
                登入
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700"
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
        <div className="px-2 pt-2 pb-3 space-y-1 border-t border-slate-700">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block px-3 py-2 rounded-md text-base font-medium text-slate-300 hover:text-white hover:bg-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-slate-700">
            {session?.user ? (
              <div className="px-3 py-2 space-y-2">
                <p className="text-sm text-slate-400">{session.user.name || session.user.email}</p>
                <button
                  onClick={() => signOut()}
                  className="w-full text-left px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 rounded-md"
                >
                  登出
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="block px-3 py-2 text-base font-medium text-indigo-400 hover:text-indigo-300"
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
