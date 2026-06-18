import { Hono } from "hono";
import { translate } from "./translate";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

const EXAMPLES = [
  "I walked down the road with my wife to visit an old mate.",
  "Look at my feet, I need a drink and some money.",
  "Let's go into the house and up the stairs.",
];

app.post("/api/translate", async (c) => {
  let body: { text?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }

  const text = body.text?.trim();
  if (!text) {
    return c.json({ error: "text is required" }, 400);
  }
  if (text.length > 1000) {
    return c.json({ error: "text is too long (max 1000 chars)" }, 400);
  }

  try {
    const result = await translate(text, c.env);
    return c.json(result);
  } catch (err) {
    console.error("translation error", err);
    return c.json({ error: "Translation failed" }, 500);
  }
});

app.get("/styles.css", (c) => c.env.ASSETS.fetch(c.req.raw));

app.get("/", (c) => {
  const queryText = new URL(c.req.url).searchParams.get("text") ?? "";
  return c.html(<Page initialText={queryText} />);
});

function Page({ initialText }: { initialText: string }) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Cockney AI</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body class="min-h-screen bg-canvas text-ink">
        <main class="mx-auto max-w-3xl px-6 py-16">
          <header class="mb-12 text-center">
            <h1 class="font-display text-display-lg mb-3">Cockney AI</h1>
            <p class="text-body text-lg">Translate English into Cockney rhyming slang.</p>
          </header>

          <section class="bg-surface-card rounded-xxl shadow-sm border border-hairline p-8">
            <form id="translator" class="space-y-5">
              <label class="block">
                <span class="sr-only">English text</span>
                <textarea
                  id="text-input"
                  name="text"
                  rows={4}
                  class="w-full rounded-xl border border-hairline-strong bg-canvas-soft p-4 text-ink placeholder-muted outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Type something in English..."
                >
                  {initialText}
                </textarea>
              </label>

              <div class="flex flex-wrap items-center justify-between gap-4">
                <div class="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      type="button"
                      class="example-chip rounded-pill border border-hairline-strong bg-surface-strong px-4 py-2 text-sm text-body hover:border-primary hover:text-ink transition"
                      data-example={ex}
                    >
                      Try an example
                    </button>
                  ))}
                </div>
                <button
                  type="submit"
                  id="submit-btn"
                  class="inline-flex items-center rounded-pill bg-primary px-6 py-2.5 font-medium text-on-primary hover:bg-primary-active transition disabled:opacity-60"
                >
                  <span id="btn-spinner" class="mr-2 hidden h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></span>
                  <span id="btn-text">Translate</span>
                </button>
              </div>
            </form>

            <div id="loading" class="mt-8 hidden text-center text-muted">
              Thinking in rhymes…
            </div>

            <div id="result" class="mt-8 hidden">
              <div class="rounded-xl border border-hairline bg-canvas-soft p-6">
                <div class="mb-2 flex items-center justify-between">
                  <h2 class="text-title-sm font-medium text-ink">Translation</h2>
                  <button
                    id="copy-btn"
                    type="button"
                    class="rounded-pill border border-hairline-strong px-4 py-1.5 text-sm text-body hover:border-primary hover:text-ink transition"
                  >
                    Copy
                  </button>
                </div>
                <p id="translation-output" class="text-xl leading-relaxed text-ink"></p>
              </div>

              <div class="mt-6">
                <h3 class="text-caption-uppercase mb-3 text-muted">Words used</h3>
                <ul id="substitutions" class="space-y-2"></ul>
              </div>
            </div>

            <div id="error" class="mt-6 hidden rounded-lg border border-semantic-error bg-red-50 p-4 text-semantic-error"></div>
          </section>

          <footer class="mt-12 text-center text-sm text-muted">
            <p>
              Also available as an API: <code class="rounded bg-surface-strong px-2 py-1">POST /api/translate</code>
            </p>
          </footer>
        </main>

        <script dangerouslySetInnerHTML={{ __html: clientScript }} />
      </body>
    </html>
  );
}

const clientScript = `
(function() {
  const form = document.getElementById('translator');
  const input = document.getElementById('text-input');
  const submitBtn = document.getElementById('submit-btn');
  const btnText = document.getElementById('btn-text');
  const btnSpinner = document.getElementById('btn-spinner');
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  const translationOutput = document.getElementById('translation-output');
  const substitutionsList = document.getElementById('substitutions');
  const errorBox = document.getElementById('error');
  const copyBtn = document.getElementById('copy-btn');

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    if (isLoading) {
      btnSpinner.classList.remove('hidden');
      btnText.textContent = 'Translating…';
    } else {
      btnSpinner.classList.add('hidden');
      btnText.textContent = 'Translate';
    }
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
    result.classList.add('hidden');
    loading.classList.add('hidden');
  }

  function renderSubstitution(s) {
    if (s.phrase === s.short) {
      return \`<li class="text-body"><span class="font-medium text-ink">\${escapeHtml(s.original)}</span> → \${escapeHtml(s.short)}</li>\`;
    }
    const remainder = s.phrase.slice(s.short.length).trim();
    return \`<li class="text-body"><span class="font-medium text-ink">\${escapeHtml(s.original)}</span> → \${escapeHtml(s.short)} <span class="text-muted">(\${escapeHtml(remainder)})</span></li>\`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  async function submit() {
    const text = input.value.trim();
    if (!text) return;
    setLoading(true);
    result.classList.add('hidden');
    errorBox.classList.add('hidden');

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      translationOutput.textContent = data.translation;
      substitutionsList.innerHTML = (data.substitutions || []).map(renderSubstitution).join('');
      result.classList.remove('hidden');
    } catch (e) {
      showError(e.message);
    } finally {
      setLoading(false);
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });

  document.querySelectorAll('.example-chip').forEach((btn) => {
    btn.textContent = btn.dataset.example.length > 40 ? btn.dataset.example.slice(0, 37) + '…' : btn.dataset.example;
    btn.addEventListener('click', () => {
      input.value = btn.dataset.example;
      submit();
    });
  });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(translationOutput.textContent);
      copyBtn.textContent = 'Copied';
      setTimeout(() => copyBtn.textContent = 'Copy', 1500);
    } catch {}
  });

  // Update URL for permalink when a translation is made
  form.addEventListener('submit', () => {
    const url = new URL(location.href);
    url.searchParams.set('text', input.value);
    history.replaceState(null, '', url);
  });

  if (input.value.trim()) submit();
})();
`;

export default app;
