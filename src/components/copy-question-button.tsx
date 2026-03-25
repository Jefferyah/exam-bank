"use client";

import { useState } from "react";
import { CopyIcon, CheckIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface CopyQuestionButtonProps {
  /** The question stem / body text */
  stem: string;
  /** Array of option objects with label (A/B/C/D) and text */
  options: { label: string; text: string }[];
  /** Optional: the correct answer label(s) */
  answer?: string;
  /** Optional: explanation text */
  explanation?: string;
  /** Button size variant */
  size?: "sm" | "md";
  className?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function CopyQuestionButton({
  stem,
  options,
  answer,
  explanation,
  size = "sm",
  className,
}: CopyQuestionButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const cleanStem = stripHtml(stem);
    const lines = [cleanStem, ""];

    for (const opt of options) {
      lines.push(`${opt.label}. ${stripHtml(opt.text)}`);
    }

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const isSmall = size === "sm";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full transition-all font-medium",
        isSmall ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
        copied
          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border border-gray-200",
        className
      )}
      title="複製題目與選項"
    >
      {copied ? (
        <>
          <CheckIcon className="w-3.5 h-3.5" />
          已複製
        </>
      ) : (
        <>
          <CopyIcon className="w-3.5 h-3.5" />
          複製題目
        </>
      )}
    </button>
  );
}
