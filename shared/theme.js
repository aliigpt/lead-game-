// Everything the game teaches lives here: branding, the AI jargon terms and
// their Hong Kong analogies, and the tips. Every string has a Cantonese (zh)
// and English (en) version. Both the server and the client import this file.

export const BRAND = {
  game: { zh: "AI 術語大亂鬥", en: "AI Jargon Brawl" },
  handle: "@aliigpt",
  igUrl: "https://instagram.com/aliigpt",
  tagline: {
    zh: "一邊打機，一邊學識 AI 術語。",
    en: "Learn AI jargon while you fight your friends.",
  },
  consent: {
    zh: "我想收到 @aliigpt 嘅 AI 貼士，隨時可以取消。",
    en: "Send me AI tips from @aliigpt. Unsubscribe anytime.",
  },
};

// Collectible cards. Each one is a term with a power while it sits in your
// 書包 (bag). The bag holds BAG_SIZE cards: pick up one more and the oldest
// falls out. That's how a context window works.
export const CARDS = [
  {
    key: "llm", term: "LLM", emoji: "🧠", color: "#e4572e",
    analogy: { zh: "AI 嘅大腦", en: "the AI's brain" },
    explain: {
      zh: "大型語言模型，即係 ChatGPT、Claude、Gemini 背後嗰個大腦。睇過海量文字，學識估下一個字。",
      en: "The large language model behind ChatGPT, Claude and Gemini. It read a huge amount of text and learned to predict the next word.",
    },
    power: { zh: "攻擊力 +50%", en: "+50% damage" },
  },
  {
    key: "api", term: "API", emoji: "🧋", color: "#b5763a",
    analogy: { zh: "茶餐廳伙記", en: "the cha chaan teng waiter" },
    explain: {
      zh: "你同廚房之間嘅伙記：你落單，佢幫你攞返嚟。App 就係透過 API 叫 AI 做嘢。",
      en: "The waiter between you and the kitchen: you order, they bring it back. Apps use an API to ask the AI for things.",
    },
    power: { zh: "伙記送餐：慢慢回血", en: "Waiter brings food: slowly heals you" },
  },
  {
    key: "mcp", term: "MCP", emoji: "🔌", color: "#2a9d8f",
    analogy: { zh: "AI 嘅 USB-C", en: "USB-C for AI" },
    explain: {
      zh: "一個統一插頭，AI 一插就用到 Gmail、Notion、Google Drive 呢啲工具。",
      en: "One standard plug, so AI can connect to tools like Gmail, Notion or Google Drive.",
    },
    power: { zh: "Token 充電快一倍", en: "Tokens recharge 2x faster" },
  },
  {
    key: "agent", term: "Agent", emoji: "🧑‍💼", color: "#3a6ea5",
    analogy: { zh: "私人助理", en: "a personal assistant" },
    explain: {
      zh: "唔止答你問題，仲會自己諗步驟、用工具，幫你做完成件事。",
      en: "It doesn't just answer. It plans the steps, uses tools and finishes the job for you.",
    },
    power: { zh: "助理自動幫你開火", en: "Your assistant auto-fires for you" },
  },
  {
    key: "rag", term: "RAG", emoji: "📖", color: "#6a4c93",
    analogy: { zh: "開書考試", en: "an open-book exam" },
    explain: {
      zh: "AI 答之前，先翻查你畀佢嘅資料，唔使靠記憶，少啲作故仔。",
      en: "Before answering, the AI looks things up in your documents instead of relying on memory. Fewer made-up answers.",
    },
    power: { zh: "自動瞄準", en: "Auto-aim" },
  },
  {
    key: "skills", term: "Skills", emoji: "📋", color: "#1f7a4d",
    analogy: { zh: "SOP 手冊", en: "an SOP manual" },
    explain: {
      zh: "預先寫好嘅做法。AI 做嗰類工作就跟住手冊做，次次都一樣咁穩陣。",
      en: "Pre-written how-tos. When the AI does that kind of job it follows the manual, consistent every time.",
    },
    power: { zh: "技能冷卻減半", en: "Ability cooldown halved" },
  },
];

// Terms that are game rules rather than cards.
export const RULES = {
  token: {
    term: "Token", emoji: "🚕", color: "#c8102e",
    analogy: { zh: "的士咪錶", en: "a taxi meter" },
    explain: {
      zh: "AI 計數嘅單位。你打嘅字、佢答嘅字都計錢，好似的士咪錶咁一路跳。",
      en: "The unit AI counts in. Every word you send and get back is metered, like a taxi meter ticking.",
    },
  },
  context: {
    term: "Context window", emoji: "🎒", color: "#d17a00",
    analogy: { zh: "書包", en: "a schoolbag" },
    explain: {
      zh: "AI 一次過記得幾多嘢係有上限嘅。書包滿咗，最舊嗰啲就會跌咗出嚟。",
      en: "AI can only hold so much at once. When the bag is full, the oldest stuff falls out.",
    },
  },
  hallucination: {
    term: "Hallucination", emoji: "🤥", color: "#5b3a70",
    analogy: { zh: "作故仔同事", en: "the coworker who makes stuff up" },
    explain: {
      zh: "AI 有時會好有自信咁作啲嘢出嚟，好似個作故仔同事。重要資料要自己核實。",
      en: "Sometimes AI confidently makes things up, like a coworker who invents stories. Double-check anything important.",
    },
  },
  injection: {
    term: "Prompt injection", emoji: "📞", color: "#8a1c1c",
    analogy: { zh: "電話騙案", en: "a phone scam" },
    explain: {
      zh: "有人將隱藏指令收埋喺網頁或者文件入面，呃 AI 跟佢做嘢，好似電話騙案咁。",
      en: "Someone hides instructions in a web page or file to trick the AI into obeying them, like a phone scam.",
    },
  },
};

// Shown when you bust a 作故仔 bot: how to catch made-up answers.
export const BOT_TIPS = [
  { zh: "叫 AI 講出處，然後自己撳入去睇。", en: "Ask the AI for sources, then open them yourself." },
  { zh: "加一句「唔肯定就話唔知」，作故仔會少好多。", en: 'Add "If you\'re not sure, say you don\'t know." Far fewer made-up answers.' },
  { zh: "數字、人名、日期，一定要自己再 check。", en: "Always double-check numbers, names and dates." },
  { zh: "用 RAG：將真資料貼畀佢，叫佢淨係根據呢份嘢答。", en: "Use RAG: paste the real document and tell it to answer only from that." },
  { zh: "同一條問題問兩個 AI，答案唔同嗰度就要小心。", en: "Ask two AIs the same question. Where they disagree, be careful." },
];

// Every term, in the order the respawn screen cycles through them.
export const ALL_TERMS = [RULES.token, RULES.context, RULES.hallucination, RULES.injection, ...CARDS];

export const MASTER_LESSON = {
  title: { zh: "AI 術語大師！+250", en: "AI Jargon Master! +250" },
  text: {
    zh: "六張卡都學齊。LLM、API、MCP、Agent、RAG、Skills，你而家識晒。",
    en: "All six cards learned. LLM, API, MCP, Agent, RAG, Skills: you know them all now.",
  },
};

export const NAMES = {
  ability: { zh: "重新生成", en: "Regenerate" },
  abilityHelp: { zh: "衝刺 + 回血 + 短暫護盾", en: "Dash + heal + short shield" },
  bot: { zh: "作故仔", en: "Hallucination" },
};
