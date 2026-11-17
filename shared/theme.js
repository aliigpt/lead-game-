// Everything the game teaches lives here. Edit this file to change the niche,
// the lessons, or the branding. Both the server and the client import it.

export const BRAND = {
  game: "Prompt Arena",
  handle: "@aliigpt",
  igUrl: "https://instagram.com/aliigpt",
  tagline: "Build the perfect AI prompt. Bust hallucinations. Beat your friends.",
  consent: "Send me AI tips from @aliigpt. Unsubscribe anytime.",
};

// The five prompt pieces scattered around the map. Collect all five to
// "build a full prompt" for a big score bonus.
export const PIECES = [
  {
    key: "role",
    letter: "R",
    label: "Role",
    color: "#ff4fd8",
    tip: 'Tell the AI who to be. "Act as a senior copywriter" sets the tone and the expertise.',
  },
  {
    key: "context",
    letter: "C",
    label: "Context",
    color: "#3fd0ff",
    tip: "Give it background: who it's for, the goal, the limits. AI can't read your mind.",
  },
  {
    key: "task",
    letter: "T",
    label: "Task",
    color: "#ffd23f",
    tip: "Name the job with one clear verb: write, summarize, compare, rewrite.",
  },
  {
    key: "format",
    letter: "F",
    label: "Format",
    color: "#6bff8a",
    tip: "Ask for the shape you want: a table, 5 bullets, under 100 words.",
  },
  {
    key: "example",
    letter: "E",
    label: "Example",
    color: "#ff8a3f",
    tip: "Paste one example of what good looks like. AI copies patterns fast.",
  },
];

export const COMPLETE_LESSON = {
  title: "Full prompt built! +250",
  tip: "Role + Context + Task + Format + Example. That's a prompt that works on the first try.",
};

// Shown when you destroy a Hallucination bot.
export const HALLUCINATION_LESSONS = [
  "AI can state wrong facts with total confidence. Check names, numbers and links.",
  'Add "If you don\'t know, say so" to your prompt to cut made-up answers.',
  "Ask for sources, then open them. Fake citations are a classic hallucination.",
  "Paste the real document in. AI answers better from your text than from memory.",
  "Long chats drift. Start a fresh chat when answers get weird.",
  "Ask the AI to check its own answer step by step before you trust it.",
];

// Shown on the respawn screen.
export const RESPAWN_TIPS = [
  "Regenerate isn't cheating. Re-roll an answer until one fits.",
  "Break big jobs into steps. One prompt per step beats one giant prompt.",
  'Say what NOT to do: "no jargon, no emojis, no intro paragraph".',
  "Reply with feedback: \"shorter\", \"more casual\", \"give 3 options\". Iterate.",
  "Give it a word count or a reading level. Vague in, vague out.",
  "Save prompts that work. Reuse them as templates.",
];

export const NAMES = {
  weapon: "Tokens",
  ability: "Regenerate",
  abilityHelp: "Dash + heal + 0.6s shield",
  bot: "Hallucination",
};
