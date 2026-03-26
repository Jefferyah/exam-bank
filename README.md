# ExamBank

線上題庫練習與模擬考平台，支援多題庫管理、AI 解題、學習分析與多人協作。

## 功能總覽

### 題庫管理
- 建立 / 編輯 / 刪除題庫，支援公開或私人
- 題目類型：單選題（SINGLE）、多選題（MULTI）、情境題（SCENARIO）
- 題目編輯器：題幹、選項、答案、解析、錯選解析、延伸知識、章節、分類、標籤、難度（1-5）
- JSON 批量匯入 / 匯出，支援簡易格式與完整格式，自動偵測轉換
- 隱藏不需要的公開題庫

### 考試系統
- **練習模式**：無時間限制，即時顯示答案與解析
- **模擬考模式**：限時作答，交卷後才顯示結果
- 可依題庫、難度、題數自由組卷
- 特殊篩選：僅錯題 / 僅收藏 / 僅有筆記的題目
- 答題旗標、自動儲存（每 30 秒）、進度條、計時器
- 交卷後完整成績報告，含逐題檢討

### AI 解題
- 支援三種 AI 模型：OpenAI GPT-4o、Anthropic Claude、Google Gemini
- 每題可即時呼叫 AI 分析，含信心指數與詳細解釋
- 在答題頁面與成績頁面皆可使用

### 學習分析
- 整體統計：正確率、完成測驗數、已答題數、平均分數、連續學習天數
- 學習活躍度熱力圖（近 30 天）
- 分數趨勢圖（最近 10 場測驗）
- 練習 vs 模擬考表現對比
- 答題速度分析（模擬考模式）：各難度 / 各題庫的平均耗時，答對 vs 答錯速度比較
- 各題庫正確率排行
- 難度分佈與正確率圓環圖
- 錯題排行榜 Top 10
- 題庫詳細分析頁：最弱題庫高亮、一鍵加強練習

### 複習系統
- 錯題本：依錯誤次數排序，追蹤最近答錯時間
- 收藏題目：快速標記與篩選
- 個人筆記：每題可記錄學習心得
- 自訂難度：覆寫系統難度評級

### 管理後台（ADMIN）
- 邀請碼管理：批量產生、追蹤使用狀況、設定使用上限
- 使用者管理：角色分配（ADMIN / TEACHER / STUDENT）
- 資料重設：可依範圍重設錯題紀錄、考試紀錄、指定題庫相關資料
- 刪除題庫前顯示影響範圍（影響用戶數、考試數、筆記數等）

### 帳號與權限
- Email + 密碼登入，支援 GitHub OAuth
- 邀請碼制度控制註冊
- 角色權限控管：非擁有者無法編輯 / 刪除他人題庫
- 密碼變更功能

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | React 19、Next.js 16（App Router）、TypeScript、Tailwind CSS 4 |
| 後端 | Next.js API Routes |
| 資料庫 | PostgreSQL + Prisma ORM |
| 認證 | NextAuth v5（Credentials + GitHub OAuth） |
| AI | OpenAI SDK、Anthropic SDK、Google Generative AI SDK |
| 部署 | Docker / Vercel |

---

## 快速開始

### 環境需求
- Node.js 20+
- PostgreSQL 資料庫

### 安裝

```bash
git clone https://github.com/Jefferyah/exam-bank.git
cd exam-bank
npm install
```

### 環境變數

複製 `.env.example` 並填入設定：

```bash
cp .env.example .env
```

```env
# 資料庫
DATABASE_URL="postgres://..."
DIRECT_DATABASE_URL="postgres://..."

# NextAuth
AUTH_SECRET="your-secret-here"
AUTH_GITHUB_ID="your-github-oauth-id"
AUTH_GITHUB_SECRET="your-github-oauth-secret"

# AI APIs（選填，不填則該 AI 功能不可用）
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-..."
GOOGLE_GENERATIVE_AI_API_KEY="..."
```

### 啟動開發伺服器

```bash
npx prisma db push    # 初始化資料庫
npm run dev            # http://localhost:3000
```

### 其他指令

```bash
npm run build          # 建置生產版本
npm run start          # 啟動生產伺服器
npm run db:seed        # 匯入種子資料
npm run db:studio      # 開啟 Prisma Studio（資料庫 GUI）
npm run lint           # ESLint 檢查
```

---

## Docker 部署

```bash
docker build -t exam-bank .
docker run -p 3000:3000 --env-file .env exam-bank
```

容器啟動時會自動執行 `prisma db push` 同步資料庫結構。

---

## 資料庫模型

```
User             使用者（ADMIN / TEACHER / STUDENT）
QuestionBank     題庫（公開 / 私人）
Question         題目（單選 / 多選 / 情境）
Exam             考試（練習 / 模擬考）
ExamAnswer       作答紀錄（答案、耗時、旗標）
Note             個人筆記
Favorite         收藏題目
WrongRecord      錯題紀錄（次數、最近錯誤時間）
UserDifficulty   自訂難度
InviteCode       邀請碼
HiddenBank       隱藏題庫
```

---

## 專案結構

```
exam-bank/
├── src/
│   ├── app/
│   │   ├── page.tsx              # 首頁 / 儀表板
│   │   ├── login/                # 登入頁
│   │   ├── exam/                 # 組卷、作答、成績
│   │   ├── questions/            # 題庫瀏覽、建題、匯入、題目詳情
│   │   ├── review/               # 錯題、收藏、筆記複習
│   │   ├── analytics/            # 學習分析、題庫分析
│   │   ├── admin/                # 管理後台、使用者管理
│   │   └── api/                  # 19 個 API 端點
│   ├── components/               # 共用元件（Navbar、Icons 等）
│   └── lib/                      # 認證、資料庫、工具函式、AI 整合
├── prisma/
│   └── schema.prisma             # 資料庫結構定義
├── Dockerfile                    # Docker 部署設定
├── .env.example                  # 環境變數範本
└── package.json
```
