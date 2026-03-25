import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const sampleQuestions = [
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
    explanation: "BIA（業務影響分析）的主要目的是識別和評估業務流程的重要性，並確定中斷對組織的影響。它幫助確定恢復優先順序和時間目標（RTO/RPO）。",
    wrongOptionExplanations: JSON.stringify({
      A: "識別威脅是風險評估（Risk Assessment）的功能，不是 BIA",
      C: "災難恢復計畫是基於 BIA 結果來制定的，但 BIA 本身不負責開發 DRP",
      D: "評估安全控制效果是安全審計（Security Audit）的工作",
    }),
    extendedKnowledge: "BIA 是 BCP（業務連續性計畫）的第一步。它會識別 MTD（最大可容忍停機時間）、RTO（恢復時間目標）和 RPO（恢復點目標）。",
    domain: "SECURITY_AND_RISK_MANAGEMENT",
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
    explanation: "最小權限原則要求使用者只被授予完成其工作所需的最低限度權限。這可以減少未經授權的存取風險和潛在的損害範圍。",
    wrongOptionExplanations: JSON.stringify({
      B: "所有使用者相同權限違反了最小權限和職責分離原則",
      C: "即使是管理員也應該遵循最小權限原則",
      D: "存取控制應基於職責需求，而非職位高低",
    }),
    extendedKnowledge: "最小權限原則與 Need-to-Know 原則相關。在 RBAC 中，通過角色來實現最小權限分配。",
    domain: "IDENTITY_AND_ACCESS",
    chapter: "Chapter 5",
    difficulty: 1,
    tags: JSON.stringify(["Access Control", "Least Privilege", "IAM"]),
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
    explanation: "將用戶輸入直接拼接到 SQL 查詢中是典型的 SQL 注入漏洞。攻擊者可以通過構造惡意輸入來操縱資料庫查詢。",
    wrongOptionExplanations: JSON.stringify({
      A: "XSS 是將惡意腳本注入到網頁中，影響其他用戶的瀏覽器",
      C: "緩衝區溢出是寫入超出分配記憶體空間的資料",
      D: "CSRF 是利用已認證用戶的瀏覽器發送偽造請求",
    }),
    extendedKnowledge: "防範 SQL 注入的最佳方式是使用參數化查詢（Parameterized Queries）或預備語句（Prepared Statements）。OWASP Top 10 中將注入攻擊列為最常見的安全風險之一。",
    domain: "SOFTWARE_DEVELOPMENT",
    chapter: "Chapter 8",
    difficulty: 2,
    tags: JSON.stringify(["SQL Injection", "OWASP", "Web Security"]),
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
    explanation: "RSA 是非對稱加密演算法，使用公鑰和私鑰對。AES、DES 和 Blowfish 都是對稱加密演算法。",
    wrongOptionExplanations: JSON.stringify({
      A: "AES（Advanced Encryption Standard）是對稱加密演算法",
      B: "DES（Data Encryption Standard）是對稱加密演算法，已被認為不安全",
      D: "Blowfish 是對稱區塊加密演算法",
    }),
    extendedKnowledge: "非對稱加密用於金鑰交換和數位簽章。RSA 的安全性基於大質數分解的困難性。常見的非對稱演算法還包括 ECC 和 Diffie-Hellman。",
    domain: "SECURITY_ARCHITECTURE",
    chapter: "Chapter 3",
    difficulty: 1,
    tags: JSON.stringify(["Cryptography", "RSA", "Asymmetric"]),
  },
  {
    stem: "An organization experiences a security breach where an attacker gains access to the network by impersonating a trusted employee via phone call to the help desk. This attack is BEST classified as:",
    type: "SINGLE",
    options: JSON.stringify([
      { label: "A", text: "Phishing" },
      { label: "B", text: "Social Engineering" },
      { label: "C", text: "Man-in-the-Middle" },
      { label: "D", text: "Brute Force" },
    ]),
    answer: "B",
    explanation: "這是社交工程攻擊的典型案例。攻擊者通過電話冒充可信任的員工來欺騙幫助台人員獲取存取權限。雖然 Phishing 也是社交工程的一種，但透過電話進行的攻擊更精確地稱為 Vishing 或廣義的社交工程。",
    wrongOptionExplanations: JSON.stringify({
      A: "Phishing 特指通過電子郵件或假網站進行的欺騙，這裡是通過電話進行的",
      C: "中間人攻擊是攔截和篡改通訊，不涉及冒充員工打電話",
      D: "暴力破解是通過嘗試大量密碼來破解認證",
    }),
    extendedKnowledge: "社交工程的類型包括：Phishing（釣魚郵件）、Vishing（電話釣魚）、Smishing（簡訊釣魚）、Pretexting（偽裝身份）、Baiting（誘餌）等。最佳防禦是安全意識培訓。",
    domain: "SECURITY_AND_RISK_MANAGEMENT",
    chapter: "Chapter 1",
    difficulty: 2,
    tags: JSON.stringify(["Social Engineering", "Vishing", "Human Factor"]),
  },
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
    explanation: "網路分段的主要安全效益是減少攻擊面並限制安全事件的影響範圍。當一個網段被入侵時，攻擊者無法直接存取其他網段。",
    wrongOptionExplanations: JSON.stringify({
      A: "雖然分段可能改善局部性能，但這不是主要安全效益",
      C: "網路分段通常需要額外的硬體（如防火牆、路由器），可能增加成本",
      D: "分段實際上增加了管理複雜度，但提高了安全性",
    }),
    extendedKnowledge: "網路分段可以通過 VLAN、防火牆、DMZ 等技術實現。零信任架構（Zero Trust）將分段概念推向微分段（Microsegmentation）。",
    domain: "COMMUNICATION_AND_NETWORK",
    chapter: "Chapter 4",
    difficulty: 2,
    tags: JSON.stringify(["Network Security", "Segmentation", "Defense in Depth"]),
  },
  {
    stem: "During a penetration test, the tester discovers that an application stores passwords in plaintext in the database. Which security control has been violated?",
    type: "SINGLE",
    options: JSON.stringify([
      { label: "A", text: "Data classification" },
      { label: "B", text: "Data at rest encryption" },
      { label: "C", text: "Input validation" },
      { label: "D", text: "Session management" },
    ]),
    answer: "B",
    explanation: "密碼以明文儲存在資料庫中違反了靜態資料加密（Data at Rest Encryption）的原則。密碼應該使用加鹽雜湊（Salted Hash）方式儲存。",
    wrongOptionExplanations: JSON.stringify({
      A: "資料分類是識別和標記資料敏感級別，不直接涉及加密儲存",
      C: "輸入驗證是確保用戶輸入的格式正確，與密碼儲存方式無關",
      D: "會話管理是處理用戶認證狀態的維護，與密碼儲存無直接關係",
    }),
    extendedKnowledge: "密碼儲存的最佳實踐是使用 bcrypt、scrypt 或 Argon2 等演算法進行加鹽雜湊。永遠不要使用 MD5 或 SHA-1 來雜湊密碼。",
    domain: "ASSET_SECURITY",
    chapter: "Chapter 2",
    difficulty: 3,
    tags: JSON.stringify(["Encryption", "Password Security", "Data Protection"]),
  },
  {
    stem: "A security team is reviewing logs and notices multiple failed login attempts from various IP addresses targeting a single user account. This is MOST likely which type of attack?",
    type: "SINGLE",
    options: JSON.stringify([
      { label: "A", text: "Password Spraying" },
      { label: "B", text: "Credential Stuffing" },
      { label: "C", text: "Brute Force Attack" },
      { label: "D", text: "Rainbow Table Attack" },
    ]),
    answer: "C",
    explanation: "多個 IP 地址針對單一帳戶進行多次失敗的登入嘗試，最可能是暴力破解攻擊（分散式）。攻擊者使用不同的 IP 來避免帳戶鎖定機制。",
    wrongOptionExplanations: JSON.stringify({
      A: "Password Spraying 是用少數密碼嘗試大量帳戶，不是針對單一帳戶",
      B: "Credential Stuffing 使用已洩露的帳密組合嘗試登入，通常針對多個帳戶",
      D: "Rainbow Table 是離線攻擊，用於破解雜湊值，不會產生登入失敗記錄",
    }),
    extendedKnowledge: "防禦暴力破解的方法包括：帳戶鎖定、漸進式延遲、CAPTCHA、多因子認證（MFA）和 IP 信譽評分系統。",
    domain: "SECURITY_ASSESSMENT",
    chapter: "Chapter 6",
    difficulty: 3,
    tags: JSON.stringify(["Brute Force", "Authentication", "Log Analysis"]),
  },
  {
    stem: "Which of the following incident response phases involves identifying the scope of the compromise and preventing further damage?",
    type: "SINGLE",
    options: JSON.stringify([
      { label: "A", text: "Preparation" },
      { label: "B", text: "Detection and Analysis" },
      { label: "C", text: "Containment, Eradication, and Recovery" },
      { label: "D", text: "Post-Incident Activity" },
    ]),
    answer: "C",
    explanation: "遏制、根除和恢復（Containment, Eradication, and Recovery）階段負責確定入侵範圍並防止進一步損害。遏制是隔離受影響系統，根除是消除威脅，恢復是還原正常運作。",
    wrongOptionExplanations: JSON.stringify({
      A: "準備階段是在事件發生前建立能力和流程",
      B: "偵測和分析階段是發現和確認安全事件",
      D: "事後活動是進行經驗教訓總結和改進措施",
    }),
    extendedKnowledge: "NIST SP 800-61 定義了四個事件回應階段。遏制策略包括短期遏制（斷網）和長期遏制（打補丁後重新上線）。",
    domain: "SECURITY_OPERATIONS",
    chapter: "Chapter 7",
    difficulty: 2,
    tags: JSON.stringify(["Incident Response", "NIST", "Security Operations"]),
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
    explanation: "風險分析需要考慮資產價值、威脅可能性和漏洞嚴重性。Risk = Threat × Vulnerability × Asset Value。辦公室位置本身不是風險分析的核心因素（除非涉及地理相關的威脅）。",
    wrongOptionExplanations: JSON.stringify({
      D: "辦公室位置不是風險分析的核心因素，除非在考慮特定地理威脅時才會相關",
    }),
    extendedKnowledge: "定量風險分析使用 ALE = SLE × ARO 公式。SLE（Single Loss Expectancy）= Asset Value × Exposure Factor。",
    domain: "SECURITY_AND_RISK_MANAGEMENT",
    chapter: "Chapter 1",
    difficulty: 3,
    tags: JSON.stringify(["Risk Analysis", "Quantitative", "Risk Management"]),
  },
];

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

  // Create questions
  for (const q of sampleQuestions) {
    await prisma.question.create({
      data: {
        ...q,
        createdById: user.id,
      },
    });
  }

  console.log(`Created ${sampleQuestions.length} sample questions`);
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
