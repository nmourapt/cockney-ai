export interface Env {
  AI: Ai;
  COCKNEY_KV: KVNamespace;
  ASSETS: Fetcher;
}

export interface DictionaryEntry {
  word: string;
  phrase: string;
  short: string;
  category: string;
}

export interface Substitution {
  original: string;
  phrase: string;
  short: string;
}

export interface TranslationResult {
  translation: string;
  substitutions: Substitution[];
}

