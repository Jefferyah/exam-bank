"use client";

import { useEffect, useState } from "react";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  canCreate?: boolean; // ADMIN/TEACHER can create new categories
  type?: "bank" | "question"; // which category pool to use
  className?: string;
  placeholder?: string;
}

export default function CategorySelect({
  value,
  onChange,
  canCreate = false,
  type = "bank",
  className = "",
  placeholder = "選擇分類",
}: CategorySelectProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    fetch(`/api/categories?type=${type}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, [type]);

  const handleAddNew = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (!categories.includes(trimmed)) {
      setCategories((prev) => [...prev, trimmed].sort((a, b) => a.localeCompare(b, "zh-Hant")));
    }
    onChange(trimmed);
    setNewCategory("");
    setIsAdding(false);
  };

  if (isAdding && canCreate) {
    return (
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddNew();
            if (e.key === "Escape") setIsAdding(false);
          }}
          placeholder="輸入新分類名稱"
          className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
        />
        <button
          onClick={handleAddNew}
          className="px-3 py-2 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors"
        >
          確定
        </button>
        <button
          onClick={() => setIsAdding(false)}
          className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 ${className}`}
      >
        <option value="">{placeholder}</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      {canCreate && (
        <button
          onClick={() => setIsAdding(true)}
          className="px-3 py-2 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl transition-colors whitespace-nowrap"
        >
          + 新增
        </button>
      )}
    </div>
  );
}
