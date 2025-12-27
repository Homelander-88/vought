javascript:(function () {
  const OPENAI_KEY =
    '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';

  let busy = !1;

  function scrape() {
    try {
      let q = null;

      [
        '.ql-editor',
        '[aria-labelledby="question-data"]',
        '#question-data',
        '.question-text',
        '[class*="question"]',
        '[class*="Question"]',
        'main'
      ].some((sel) => {
        const e = document.querySelector(sel);
        if (e && e.innerText && e.innerText.length > 10) {
          q = e;
          return !0;
        }
      });

      let question = '';

      if (q) {
        question = q.innerText.trim();
      } else {
        const lines = (document.body.innerText || '')
          .split('\n')
          .filter((l) => l.trim().length > 15);

        question = lines.slice(0, 15).join('\n');
      }

      [...document.querySelectorAll('pre,code,.code-block,[class*="code"]')].forEach(
        (b, i) => {
          const t = (b.innerText || '').trim();
          if (
            t.length > 5 &&
            t.length < 3000 &&
            !question.includes(t)
          ) {
            question += `\n[CODE ${i + 1}]:\n${t}`;
          }
        }
      );

      if (!question || question.length < 10) return null;

      let els = document.querySelectorAll('[id^="tt-option-"]');

      if (!els.length)
        els = document.querySelectorAll('.option,[class*="option"]');

      const seen = new Set();
      const options = [];

      els.forEach((el) => {
        const t = (el.innerText || '').trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        options.push({ text: t, el });
      });

      if (options.length < 2) return null;

      return { question, options };
    } catch {
      return null;
    }
  }

  async function ask(ctx) {
    try {
      const r = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + OPENAI_KEY
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            temperature: 0,
            max_tokens: 800,
            messages: [
              {
                role: 'system',
                content: 'You are a precise computer science and education expert.'
              },
              {
                role: 'user',
                content:
                  'QUESTION:\n' +
                  ctx.question +
                  '\n\nOPTIONS:\n' +
                  ctx.options
                    .map((o, i) => `${i}. ${o.text}`)
                    .join('\n\n') +
                  '\n\nReturn JSON only:\n{"correctIndex":number}'
              }
            ]
          })
        }
      );

      if (!r.ok) return null;

      const j = await r.json();
      const out = JSON.parse(
        j.choices?.[0]?.message?.content || '{}'
      );

      if (typeof out.correctIndex !== 'number') return null;
      if (out.correctIndex < 0 || out.correctIndex >= ctx.options.length)
        return null;

      return out.correctIndex;
    } catch {
      return null;
    }
  }

  function clickOption(el) {
    if (!el) return;

    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: !0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: !0 }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: !0 }));
  }

  async function solve() {
    if (busy) return;
    busy = !0;

    try {
      const data = scrape();
      if (!data) return;

      const idx = await ask(data);
      if (typeof idx !== 'number') return;

      clickOption(data.options[idx].el);
    } finally {
      busy = !1;
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.code === 'KeyA') {
      e.preventDefault();
      solve();
    }
  });
})();
