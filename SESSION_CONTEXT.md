# ExamBank — Session Context

> 新 session 開始前請先讀完這份文件，掌握專案架構、設計方針與開發慣例。

---

## 一、專案概覽

**ExamBank** 是一個線上題庫練習與考試平台，支援多題庫管理、模擬考試、間隔複習（SRS）、知識圖譜、學習分析等功能。

| 項目 | 技術 |
|------|------|
| 框架 | Next.js 16 (App Router) + React 19 + TypeScript |
| 樣式 | Tailwind CSS 4（注意語法差異） |
| ORM | Prisma 6 + PostgreSQL（生產）/ SQLite（本地 dev.db） |
| 認證 | NextAuth 5 beta |
| 部署 | Zeabur |
| 儲存 | Cloudflare R2（圖片上傳） |
| AI  | OpenAI + Claude + Gemini（AI 解題功能） |

### ⚠️ 重要注意
- **這不是你認識的 Next.js** — 版本有 breaking changes，寫 code 前先讀 `node_modules/next/dist/docs/`
- **本地沒有 PostgreSQL** — `prisma migrate dev` 會失敗，schema 變更用 `npx prisma generate` 產生 client，生產環境再跑 `prisma migrate deploy`
- **使用者偏好繁體中文回覆**
- **改完代碼直接 commit + push，不需要每次問**

---

## 二、目錄結構

```
src/
├── app/                        # App Router 頁面
│   ├── page.tsx                # 首頁（Hero）
│   ├── login/                  # 登入頁
│   ├── questions/              # 題庫管理
│   │   ├── page.tsx            # 題庫列表（分類分組、篩選、標籤）
│   │   ├── [id]/page.tsx       # 題目詳情（含上一題/下一題導覽）
│   │   ├── create/page.tsx     # 新增/編輯題目
│   │   └── import/page.tsx     # 匯入題目（JSON）
│   ├── exam/                   # 考試相關
│   │   ├── page.tsx            # 出題設定（題庫選擇、亂序開關等）
│   │   ├── [id]/page.tsx       # 作答頁面（含答對/答錯顏色標記）
│   │   ├── [id]/result/        # 考試結果
│   │   └── review/page.tsx     # SRS 間隔複習
│   ├── review/page.tsx         # 複習中心（5 tabs: 總覽/SRS/錯題/收藏/筆記）
│   ├── analytics/              # 學習分析
│   ├── knowledge/              # 知識庫（per-tag markdown 筆記）
│   │   ├── page.tsx            # 知識圖譜（掌握度泡泡圖）
│   │   └── [tag]/page.tsx      # 單一標籤的筆記編輯器
│   ├── admin/                  # 管理頁面
│   └── api/                    # API Routes
│       ├── questions/          # 題目 CRUD（含 per-user tag override）
│       ├── exams/              # 考試 CRUD
│       ├── tags/               # 標籤列表
│       ├── knowledge/          # 知識圖譜 API
│       ├── analytics/          # 學習分析 API
│       ├── favorites/          # 收藏
│       ├── notes/              # 筆記
│       ├── review-cards/       # SRS 卡片
│       ├── import-export/      # 匯入匯出
│       └── ...
├── lib/                        # 工具函式
│   ├── db.ts                   # Prisma client
│   ├── auth.ts                 # NextAuth 設定
│   ├── effective-tags.ts       # Per-user 標籤覆蓋批次查詢
│   ├── question-nav.ts         # 題目上下題導覽（sessionStorage）
│   ├── group-banks.ts          # 題庫分類分組工具
│   ├── safe-json.ts            # 安全 JSON parse
│   ├── srs.ts                  # 間隔複習演算法
│   └── ai-prompt.ts            # AI 解題 prompt 建構
├── components/
│   ├── navbar.tsx              # 頂部導航列
│   ├── tag-editor.tsx          # 標籤編輯器（optimistic UI + rollback）
│   ├── theme-provider.tsx      # 主題切換（data-theme attribute）
│   ├── daily-goal-tracker.tsx  # 每日目標追蹤
│   └── icons.tsx               # SVG 圖示元件
└── prisma/
    ├── schema.prisma           # 資料庫 schema
    └── dev.db                  # 本地 SQLite
```

---

## 三、核心設計方針

### 3.1 Per-User Tag Override 系統

使用者可以為任何題目設定自己的標籤，不影響其他人。

**架構：**
- `UserTagOverride` model：`@@unique([userId, questionId])`，`tags` 欄位為 JSON string
- **寫入分流**：擁有者/admin 修改 → 更新 `Question.tags`（影響所有人）；非擁有者 → `upsert` 到 `UserTagOverride`（只影響自己）
- **讀取覆蓋**：所有 API 讀取路徑用 `getEffectiveTagsMap()` 批次查詢 override，避免 N+1
- **已套用的 API**：`questions`, `questions/[id]`, `tags`, `exams/[id]`, `knowledge`, `analytics`

```typescript
// src/lib/effective-tags.ts
export async function getEffectiveTagsMap(questionIds: string[], userId: string)
export function getEffectiveTags(question, overrideMap)
```

### 3.2 題庫分類分組

- `QuestionBank` 有 `category` 欄位
- `groupBanksByCategory()` 工具函式將題庫按分類分組，未分類排最後
- 所有題庫下拉選單用 `<optgroup>` 顯示
- 題庫列表頁用可收合的分類區段

### 3.3 題目導覽（上一題/下一題）

- `src/lib/question-nav.ts`：用 `sessionStorage` 儲存當前瀏覽的題目 ID 列表
- 來源頁面（錯題本、收藏、筆記、題庫列表、標籤篩選）在渲染列表時呼叫 `setQuestionNavList(ids, label)`
- `/questions/[id]` 讀取 sessionStorage，顯示「上一題 / 下一題」導覽列

### 3.4 出題設定

- **題目亂序**：預設開啟，可關閉（按原始順序出題）
- **選項亂序**：預設關閉，可開啟
- 兩個開關並排顯示在「作答設定」區塊，用文字符號 icon（⇅ / ⇄），不用 emoji

### 3.5 知識圖譜掌握度

```
低掌握：< 60%  → 紅色
中掌握：60% ~ 84% → 黃色
高掌握：≥ 85% → 綠色
```

---

## 四、UI / 設計規範

### 4.1 暗色主題

採用 **灰黑色調**，不是純黑。通過 `data-theme="dark"` attribute 控制。

| 層級 | 色碼 | 用途 |
|------|------|------|
| 導航列背景 | `#161720` | navbar（比內容區稍深） |
| 頁面背景 | `#1a1b20` | `--background` |
| 輸入框 / accent | `#1e1f24` | `--accent-bg`, input bg |
| 卡片背景 | `#232429` | `--card` |
| 卡片 hover | `#2a2b31` | `--card-hover` |
| 邊框 | `rgba(255,255,255,0.08)` | `--border` |

**重點色**：`#38bdf8`（cyan）作為主要強調色。

### 4.2 風格要求

- **不使用 emoji 做 icon**（用 SVG 或文字符號如 ⇅ ⇄）
- 卡片用 `rounded-2xl`，按鈕用 `rounded-full`
- 摘要卡片有左側彩色漸層條 + 淡色調背景 + 副文案
- 保持簡潔不花俏，不要「太 AI 感」的泛用模組

### 4.3 暗色模式 CSS 結構

所有暗色覆寫集中在 `src/app/globals.css`：
- CSS 變數定義在 `[data-theme="dark"]`
- class 覆寫用 `[data-theme="dark"] .bg-white` 等選擇器 + `!important`
- Markdown 編輯器用 `[data-color-mode="dark"]` 選擇器

---

## 五、常見開發模式

### 5.1 API 權限模式

```typescript
// 標籤編輯：任何登入用戶可以，非擁有者寫入到 UserTagOverride
// 題目完整編輯：只有擁有者 / admin
const isOwner = question.questionBank.createdById === session.user.id;
const isAdmin = session.user.role === "admin";
```

### 5.2 Optimistic UI + Rollback

```typescript
// TagEditor 範例
function addTag(tag) {
  const prev = [...tags];       // 保存 rollback 用
  setTags([...tags, tag]);      // 立即更新 UI
  saveTags([...tags, tag], prev); // API call，失敗時 rollback
}
```

### 5.3 批次查詢避免 N+1

```typescript
const overrideMap = await getEffectiveTagsMap(
  items.map(i => i.questionId),
  userId
);
// 然後在迴圈中用 overrideMap.get(id) ?? fallback
```

### 5.4 useRef 防止 useEffect 首次清除狀態

```typescript
const prevValueRef = useRef(value);
useEffect(() => {
  if (prevValueRef.current !== value) {
    // 只在值真正改變時執行
    prevValueRef.current = value;
  }
}, [value]);
```

---

## 六、資料庫注意事項

### 6.1 待執行的 Migration

`UserTagOverride` model 已加入 schema，但 **生產環境尚未建立資料表**。需要：
1. 建立 migration SQL（或在 Zeabur 手動執行）
2. 執行 `npx prisma migrate deploy`

### 6.2 JSON 字串欄位

`Question.tags`、`Exam.config`、`UserTagOverride.tags` 等欄位在 DB 中儲存為 JSON string，讀取時用 `safeJsonParse()` 解析。

---

## 七、TypeScript 驗證

每次修改後執行：
```bash
npx tsc --noEmit
```
確保無編譯錯誤再 commit。

---

## 八、Git 工作流

- 直接在 `main` 分支開發
- 改完直接 commit + push（不需要每次問使用者）
- commit message 用繁體中文，格式：`feat:` / `fix:` + 簡短描述
- 結尾加 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## 九、測試重點

手動驗證時注意：
1. **暗色模式** — 每次改 UI 都要確認 light/dark 兩種模式
2. **標籤系統** — 非擁有者編輯標籤是否正確寫入 override、讀取時是否覆蓋
3. **題目導覽** — 從不同列表（錯題/收藏/筆記/標籤篩選）進入題目，上下題是否正常
4. **題庫分組** — 所有下拉選單和列表是否正確按分類分組
5. **出題設定** — 亂序開關是否正確影響題目/選項順序
6. **知識圖譜** — 掌握度顏色門檻是否正確（<60 紅 / 60-84 黃 / ≥85 綠）

---

## 十、已知的待辦 / 技術債

- [ ] 生產環境 `UserTagOverride` 資料表 migration
- [ ] `prisma/dev.db` 是 SQLite，與生產 PostgreSQL 有差異，本地開發需注意
- [ ] 無自動化測試（無 Jest/Vitest 設定）
- [ ] 部分頁面 `dark:bg-gray-700` 等 Tailwind dark variant 與 `globals.css` 的 `[data-theme="dark"]` 覆寫可能衝突
