# cockney-ai — build plan

## Goal

A public Cloudflare Workers demo that translates English text into Cockney rhyming slang, powered by Workers AI + AI Gateway. MVP is English only. Includes a web UI and an API endpoint.

## Design decisions (locked)

| Decision | Choice |
|----------|--------|
| Project / repo | `cockney-ai` |
| Domain | `cockney.nmoura.cf` |
| Stack | TypeScript, Hono, `hono/jsx`, Tailwind CSS, ElevenLabs design system |
| AI model | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| AI routing | Workers AI binding via AI Gateway `cockney` (cache enabled) |
| Dictionary store | Cloudflare KV, key `dictionary`, seeded with 100 entries |
| Auth | None for MVP |
| Manual cache | None — rely on AI Gateway caching |

## Routes

- `GET /` — landing page with translation form, example chips, copy-to-clipboard, and permalink support (`?text=`).
- `POST /api/translate` — JSON API. Request `{ "text": "..." }`. Response `{ "translation": "...", "substitutions": [{ "original", "phrase", "short" }], "model" }`.

## Translation behaviour

1. Load dictionary from `env.COCKNEY_KV.get("dictionary")`.
2. Build a system prompt telling the model to translate to Cockney using the dictionary, then later this summarizes...
3. Use Workers AI JSON mode / `response_format: { type: "json_schema", ... }` to request a structured output with the translation plus a list of substitutions used.
4. Call `env.AI.run(model, messages, { gateway: { id: "cockney", skipCache: false } })`.
5. Parse JSON, return to client.

## Substitutions UI

Below the translated text, render a list:

```
house → cat (and mouse)
stairs → apples (and pears)
```

Logic: the API returns `phrase` and `short` for each substituted source word. If `phrase !== short`, render `${original} → ${short} (${phrase.slice(short.length).trim()})`; otherwise just `${original} → ${short}`.

## File structure (target)

```
projects/cockney-ai/
├── public/
│   └── styles.css        # compiled Tailwind output
├── src/
│   ├── index.tsx         # Hono app, routes, JSX page
│   ├── translate.ts      # AI call + prompt/dictionary handling
│   ├── types.ts          # Env + JSON schema types
│   └── seed-dictionary.ts
├── dictionary.json       # source-of-truth for the 100-entry seed
├── tailwind.config.js
├── package.json
├── tsconfig.json
├── wrangler.jsonc
└── .dev.vars             # not committed; holds COCKNEY_AI_TOKEN locally for dev
```

## Build / deploy steps

1. `npm init` + install deps: `hono`, `wrangler`, `tailwindcss`, `typescript`.
2. `wrangler.jsonc`: AI binding, KV namespace `COCKNEY_KV`, static assets, routes/domain config.
3. Create KV namespace via `wrangler kv:namespace create COCKNEY_KV`.
4. Seed dictionary with `wrangler kv:key put --binding=COCKNEY_KV dictionary < dictionary.json`.
5. Implement `src/translate.ts` with JSON-mode prompt.
6. Implement `src/index.tsx` UI (Hono JSX) with Tailwind classes, copy button, example chips, query-param prefill.
7. Compile Tailwind to `public/styles.css`.
8. Run `wrangler dev` and verify API + UI.
9. Deploy with `wrangler deploy` and add `cockney.nmoura.cf` custom domain.

## Out of scope for MVP

- Multi-language / auto-detect.
- Audio playback / accent TTS.
- User-contributed slang or dictionary admin UI.
- Managed cache beyond AI Gateway.

## References

- [Workers AI JSON mode](https://developers.cloudflare.com/workers-ai/features/json-mode/)
- [AI Gateway Worker binding](https://developers.cloudflare.com/ai-gateway/usage/worker-binding-methods/)
- [Llama 3.3 70B fp8-fast](https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/)
