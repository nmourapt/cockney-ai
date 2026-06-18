import type { DictionaryEntry, Env, TranslationResult } from "./types";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export async function translate(text: string, env: Env): Promise<TranslationResult> {
  const raw = await env.COCKNEY_KV.get("dictionary");
  const dictionary: DictionaryEntry[] = raw ? JSON.parse(raw) : [];

  const systemPrompt = buildSystemPrompt(dictionary);

  const schema = {
    type: "object",
    properties: {
      translation: { type: "string" },
      substitutions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            original: { type: "string" },
            phrase: { type: "string" },
          },
          required: ["original", "phrase"],
        },
      },
    },
    required: ["translation", "substitutions"],
  };

  const response = await env.AI.run(
    MODEL,
    {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      max_tokens: 512,
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    },
    { gateway: { id: "cockney", skipCache: false } }
  );

  const parsed: unknown =
    typeof response === "string" ? JSON.parse(response) : (response as { response?: unknown }).response;

  const typed = parsed as TranslationResult;
  const dictionaryMap = new Map(dictionary.map((e) => [e.word.toLowerCase(), e]));

  const substitutions = (typed.substitutions || []).map((s) => {
    const entry = dictionaryMap.get(s.original.toLowerCase());
    return {
      original: s.original,
      phrase: s.phrase,
      short: entry?.short ?? s.phrase,
    };
  });

  return {
    translation: typed.translation ?? "",
    substitutions,
  };
}

function buildSystemPrompt(dictionary: DictionaryEntry[]): string {
  const lines = dictionary
    .map((e) => {
      const remainder = e.phrase.slice(e.short.length).trim();
      return remainder ? `${e.word} → ${e.short} (${remainder})` : `${e.word} → ${e.short}`;
    })
    .join("\n");

  return [
    "You are a Cockney translator. Translate the user's English text into Cockney rhyming slang using the SHORT form only.",
    "For every dictionary entry below, the short form is shown before the parentheses. Use only that short form in the translation and omit the rhyming part.",
    "Example: 'walk' becomes 'ball', never 'ball of chalk'. 'wife' becomes 'trouble', never 'trouble and strife'.",
    "If a word is not in the dictionary, invent a short Cockney substitute in the same style.",
    "Keep the sentence structure natural and return only the JSON object described below.",
    "In the substitutions array, list each dictionary word you replaced (use the base dictionary word, e.g. 'walk' not 'walked') and the FULL phrase it maps to.",
    "",
    "Dictionary:",
    lines,
    "",
    "Return a JSON object with exactly these fields:",
    '{ "translation": string, "substitutions": [{ "original": string, "phrase": string }] }',
  ].join("\n");
}
