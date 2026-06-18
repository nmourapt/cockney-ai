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
  const lines = dictionary.map((e) => `${e.word} → ${e.phrase}`).join("\n");

  return [
    "You are a Cockney translator. Translate the user's English text into Cockney rhyming slang.",
    "Use the canonical full rhyming phrase from the dictionary below wherever it applies.",
    "If a word is not in the dictionary, invent a plausible Cockney rhyming phrase in the same style.",
    "Keep the sentence structure natural and return only the JSON object described below.",
    "In the substitutions array, list each dictionary word you replaced (use the base dictionary word, e.g. 'walk' not 'walked').",
    "",
    "Dictionary:",
    lines,
    "",
    "Return a JSON object with exactly these fields:",
    '{ "translation": string, "substitutions": [{ "original": string, "phrase": string }] }',
  ].join("\n");
}
