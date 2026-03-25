import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create demo user
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
      role: "ADMIN",
    },
  });

  console.log(`Created user: ${user.email}`);

  // Create sample question banks
  const cisspBank = await prisma.questionBank.create({
    data: {
      name: "CISSP 資安認證",
      description: "CISSP 八大 Domain 題庫",
      createdById: user.id,
    },
  });

  const networkBank = await prisma.questionBank.create({
    data: {
      name: "網路安全基礎",
      description: "網路安全入門練習題",
      createdById: user.id,
    },
  });

  console.log(`Created question banks: ${cisspBank.name}, ${networkBank.name}`);

  // Sample questions for CISSP bank
  const cisspQuestions = [
    {
      stem: "Which of the following BEST describes the purpose of a Business Impact Analysis (BIA)?",
      type: "SINGLE",
      options: JSON.stringify([
        { label: "A", text: "To identify all possible threats to an organization" },
        { label: "B", text: "To determine the criticality of business processes and the impact of disruption" },
        { label: "C", text: "To develop a disaster recovery plan" },
        { label: "D", text: "To assess the effectiveness of existing security controls" },
      ]),
      answer: "B",
      explanation: "BIA（業務影響分析）的主要目的是識別和評估業務流程的重要性，並確定中斷對組織的影響。",
      wrongOptionExplanations: JSON.stringify({
        A: "識別威脅是風險評估（Risk Assessment）的功能",
        C: "災難恢復計畫是基於 BIA 結果來制定的",
        D: "評估安全控制效果是安全審計的工作",
      }),
      extendedKnowledge: "BIA 是 BCP 的第一步。它會識別 MTD、RTO 和 RPO。",
      questionBankId: cisspBank.id,
      category: "Security and Risk Management",
      chapter: "Chapter 1",
      difficulty: 2,
      tags: JSON.stringify(["BIA", "BCP", "Risk Management"]),
    },
    {
      stem: "In the context of access control, what does the principle of least privilege mean?",
      type: "SINGLE",
      options: JSON.stringify([
        { label: "A", text: "Users should have the minimum permissions necessary to perform their job functions" },
        { label: "B", text: "All users should have the same level of access" },
        { label: "C", text: "Administrators should have unlimited access to all systems" },
        { label: "D", text: "Access should be granted based on seniority" },
      ]),
      answer: "A",
      explanation: "最小權限原則要求使用者只被授予完成其工作所需的最低限度權限。",
      wrongOptionExplanations: JSON.stringify({
        B: "所有使用者相同權限違反了最小權限原則",
        C: "即使是管理員也應該遵循最小權限原則",
        D: "存取控制應基於職責需求，而非職位高低",
      }),
      extendedKnowledge: "最小權限原則與 Need-to-Know 原則相關。",
      questionBankId: cisspBank.id,
      category: "Identity and Access Management",
      chapter: "Chapter 5",
      difficulty: 1,
      tags: JSON.stringify(["Access Control", "Least Privilege", "IAM"]),
    },
    {
      stem: "Which encryption algorithm is considered asymmetric?",
      type: "SINGLE",
      options: JSON.stringify([
        { label: "A", text: "AES" },
        { label: "B", text: "DES" },
        { label: "C", text: "RSA" },
        { label: "D", text: "Blowfish" },
      ]),
      answer: "C",
      explanation: "RSA 是非對稱加密演算法，使用公鑰和私鑰對。",
      wrongOptionExplanations: JSON.stringify({
        A: "AES 是對稱加密演算法",
        B: "DES 是對稱加密演算法",
        D: "Blowfish 是對稱區塊加密演算法",
      }),
      extendedKnowledge: "非對稱加密用於金鑰交換和數位簽章。",
      questionBankId: cisspBank.id,
      category: "Security Architecture",
      chapter: "Chapter 3",
      difficulty: 1,
      tags: JSON.stringify(["Cryptography", "RSA", "Asymmetric"]),
    },
    {
      stem: "在進行風險分析時，以下哪些因素需要被考慮？（選擇所有適用的答案）",
      type: "MULTI",
      options: JSON.stringify([
        { label: "A", text: "Asset value (資產價值)" },
        { label: "B", text: "Threat likelihood (威脅可能性)" },
        { label: "C", text: "Vulnerability severity (漏洞嚴重性)" },
        { label: "D", text: "Office location (辦公室位置)" },
      ]),
      answer: "A,B,C",
      explanation: "風險分析需要考慮資產價值、威脅可能性和漏洞嚴重性。Risk = Threat × Vulnerability × Asset Value。",
      wrongOptionExplanations: JSON.stringify({
        D: "辦公室位置不是風險分析的核心因素",
      }),
      extendedKnowledge: "定量風險分析使用 ALE = SLE × ARO 公式。",
      questionBankId: cisspBank.id,
      category: "Security and Risk Management",
      chapter: "Chapter 1",
      difficulty: 3,
      tags: JSON.stringify(["Risk Analysis", "Quantitative"]),
    },
  ];

  // Sample questions for Network bank
  const networkQuestions = [
    {
      stem: "Which of the following is a PRIMARY benefit of network segmentation?",
      type: "SINGLE",
      options: JSON.stringify([
        { label: "A", text: "Increased network speed" },
        { label: "B", text: "Reduced attack surface and containment of breaches" },
        { label: "C", text: "Lower hardware costs" },
        { label: "D", text: "Simplified network management" },
      ]),
      answer: "B",
      explanation: "網路分段的主要安全效益是減少攻擊面並限制安全事件的影響範圍。",
      wrongOptionExplanations: JSON.stringify({
        A: "雖然分段可能改善局部性能，但這不是主要安全效益",
        C: "網路分段通常需要額外的硬體",
        D: "分段實際上增加了管理複雜度",
      }),
      extendedKnowledge: "網路分段可以通過 VLAN、防火牆、DMZ 等技術實現。",
      questionBankId: networkBank.id,
      category: "Network Security",
      chapter: "Chapter 4",
      difficulty: 2,
      tags: JSON.stringify(["Network Security", "Segmentation"]),
    },
    {
      stem: "A company is implementing a new web application. During the security review, the development team discovers that user input is being directly concatenated into SQL queries. Which type of vulnerability does this represent?",
      type: "SINGLE",
      options: JSON.stringify([
        { label: "A", text: "Cross-Site Scripting (XSS)" },
        { label: "B", text: "SQL Injection" },
        { label: "C", text: "Buffer Overflow" },
        { label: "D", text: "Cross-Site Request Forgery (CSRF)" },
      ]),
      answer: "B",
      explanation: "將用戶輸入直接拼接到 SQL 查詢中是典型的 SQL 注入漏洞。",
      wrongOptionExplanations: JSON.stringify({
        A: "XSS 是將惡意腳本注入到網頁中",
        C: "緩衝區溢出是寫入超出分配記憶體空間的資料",
        D: "CSRF 是利用已認證用戶的瀏覽器發送偽造請求",
      }),
      extendedKnowledge: "防範 SQL 注入的最佳方式是使用參數化查詢。",
      questionBankId: networkBank.id,
      category: "Web Security",
      chapter: "Chapter 8",
      difficulty: 2,
      tags: JSON.stringify(["SQL Injection", "OWASP", "Web Security"]),
    },
  ];

  // Create all questions
  for (const q of [...cisspQuestions, ...networkQuestions]) {
    await prisma.question.create({
      data: {
        ...q,
        createdById: user.id,
      },
    });
  }

  console.log(`Created ${cisspQuestions.length + networkQuestions.length} sample questions`);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
