// Everything the game teaches lives here. Edit this file to change the niche,
// the lessons, or the branding. Both the server and the client import it.

export const BRAND = {
  game: "Prompt Arena",
  handle: "@aliigpt",
  igUrl: "https://instagram.com/aliigpt",
  tagline: "Learn ChatGPT, Claude and Gemini tricks while you play.",
  consent: "Send me ChatGPT, Claude and Gemini tips from @aliigpt. Unsubscribe anytime.",
};

// The five prompt pieces scattered around the map. Collect all five to
// "build a full prompt" for a big score bonus.
export const PIECES = [
  {
    key: "role",
    letter: "R",
    label: "Role",
    color: "#d62976",
    tip: 'Tell the AI who to be. "Act as a senior copywriter" sets the tone and the expertise.',
  },
  {
    key: "context",
    letter: "C",
    label: "Context",
    color: "#4f5bd5",
    tip: "Give it background: who it's for, the goal, the limits. AI can't read your mind.",
  },
  {
    key: "task",
    letter: "T",
    label: "Task",
    color: "#fa7e1e",
    tip: "Name the job with one clear verb: write, summarize, compare, rewrite.",
  },
  {
    key: "format",
    letter: "F",
    label: "Format",
    color: "#00a884",
    tip: "Ask for the shape you want: a table, 5 bullets, under 100 words.",
  },
  {
    key: "example",
    letter: "E",
    label: "Example",
    color: "#962fbf",
    tip: "Paste one example of what good looks like. AI copies patterns fast.",
  },
];

export const COMPLETE_LESSON = {
  title: "Full prompt built! +250",
  tip: "Role + Context + Task + Format + Example. Works the same in ChatGPT, Claude and Gemini.",
};

// Each tip is tagged with the tool it's about. "any" = works everywhere.
export const TOOLS = {
  chatgpt: { label: "ChatGPT", short: "GPT", color: "#19c37d" },
  claude: { label: "Claude", short: "CL", color: "#e8875b" },
  gemini: { label: "Gemini", short: "GEM", color: "#6b9bff" },
  any: { label: "Any AI", short: "AI", color: "#ff5a6e" },
};

// Shown when you destroy a Hallucination bot: how to get answers you can trust.
export const BOT_TIPS = [
  { tool: "any", text: "AI can state wrong facts with total confidence. Check names, numbers and links." },
  { tool: "gemini", text: "Type @Gmail or @Drive so Gemini answers from your real emails and files, not from memory." },
  { tool: "claude", text: 'Paste the document, then ask Claude to "quote the exact lines you used". Easy to check.' },
  { tool: "chatgpt", text: "Turn on web search for anything recent. Without it ChatGPT only knows its training data." },
  { tool: "any", text: 'Add "If you\'re not sure, say so" to your prompt. It cuts made-up answers.' },
  { tool: "any", text: "Ask for sources, then open them. Fake citations are a classic hallucination." },
  { tool: "any", text: "Ask ChatGPT, Claude and Gemini the same question. Where they disagree, double-check." },
  { tool: "any", text: "Long chats drift. Start a fresh chat when answers get weird." },
];

// Shown on the respawn screen: features most people never use.
export const RESPAWN_TIPS = [
  { tool: "chatgpt", text: "Put who you are and how you like answers in Custom Instructions once. Every chat starts smarter." },
  { tool: "chatgpt", text: "Use a Project per big job. Its files and instructions stay in one place." },
  { tool: "chatgpt", text: "Use Temporary Chat for one-off questions you don't want it to remember." },
  { tool: "claude", text: "Wrap parts of your prompt in tags like <context> and <task>. Claude won't mix your data up with your instructions." },
  { tool: "claude", text: "Upload your brand docs to a Claude Project once. Every chat in it uses them." },
  { tool: "claude", text: "Ask for an artifact when you want a doc, page or code you'll keep editing." },
  { tool: "gemini", text: "Save a prompt you reuse as a Gem. One click next time, same instructions every time." },
  { tool: "gemini", text: "Gemini lives inside Gmail, Docs and Sheets. Ask it right where you're working." },
  { tool: "any", text: "Regenerate isn't cheating. Re-roll an answer until one fits." },
  { tool: "any", text: "Break big jobs into steps. One prompt per step beats one giant prompt." },
  { tool: "any", text: 'Say what NOT to do: "no jargon, no emojis, no intro paragraph".' },
  { tool: "any", text: 'Reply with feedback: "shorter", "more casual", "give 3 options". Iterate.' },
];

export const NAMES = {
  weapon: "Tokens",
  ability: "Regenerate",
  abilityHelp: "Dash + heal + 0.6s shield",
  bot: "Hallucination",
};
