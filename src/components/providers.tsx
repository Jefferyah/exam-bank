"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import { DailyGoalTracker } from "@/components/daily-goal-tracker";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <DailyGoalTracker />
      </ThemeProvider>
    </SessionProvider>
  );
}
