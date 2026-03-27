export interface BankGroup<T> {
  category: string;
  banks: T[];
}

export function groupBanksByCategory<
  T extends { category?: string | null },
>(banks: T[]): BankGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const bank of banks) {
    const cat = bank.category || "未分類";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(bank);
  }
  return [...map.entries()]
    .sort(([a], [b]) => {
      if (a === "未分類") return 1;
      if (b === "未分類") return -1;
      return a.localeCompare(b, "zh-Hant");
    })
    .map(([category, banks]) => ({ category, banks }));
}
