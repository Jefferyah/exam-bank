import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DOMAINS = {
  SECURITY_AND_RISK_MANAGEMENT: "Domain 1: Security and Risk Management",
  ASSET_SECURITY: "Domain 2: Asset Security",
  SECURITY_ARCHITECTURE: "Domain 3: Security Architecture and Engineering",
  COMMUNICATION_AND_NETWORK: "Domain 4: Communication and Network Security",
  IDENTITY_AND_ACCESS: "Domain 5: Identity and Access Management",
  SECURITY_ASSESSMENT: "Domain 6: Security Assessment and Testing",
  SECURITY_OPERATIONS: "Domain 7: Security Operations",
  SOFTWARE_DEVELOPMENT: "Domain 8: Software Development Security",
} as const;

export type DomainKey = keyof typeof DOMAINS;

export const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Medium",
  4: "Hard",
  5: "Very Hard",
};

export function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
