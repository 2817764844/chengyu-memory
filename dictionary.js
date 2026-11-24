/* Built-in idiom lookup — no network, no API keys. */
(function (global) {
  const bank = global.CHENGYU_BANK || [];
  const byText = new Map();

  function normalizeText(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, "");
  }

  for (const entry of bank) {
    byText.set(normalizeText(entry.text), entry);
  }

  function lookup(text) {
    const key = normalizeText(text);
    if (!key) return null;
    const hit = byText.get(key);
    if (hit) {
      return {
        text: hit.text,
        meaning: hit.meaning,
        example: hit.example || "",
        cluster: hit.cluster || "",
        fromBank: true,
      };
    }
    return null;
  }

  function lookupMeaning(text) {
    const hit = lookup(text);
    return hit ? hit.meaning : "";
  }

  function lookupExample(text) {
    const hit = lookup(text);
    return hit ? hit.example : "";
  }

  function fuzzySuggest(text) {
    const key = normalizeText(text);
    if (!key || key.length < 2) return null;
    let best = null;
    let bestScore = 0;
    for (const entry of bank) {
      const t = entry.text;
      if (t.includes(key) || key.includes(t)) {
        const score = Math.min(key.length, t.length);
        if (score > bestScore) {
          bestScore = score;
          best = entry;
        }
      }
    }
    return best;
  }

  function bankSize() {
    return bank.length;
  }

  function allBank() {
    return bank.slice();
  }

  global.ChengyuDictionary = {
    lookup,
    lookupMeaning,
    lookupExample,
    fuzzySuggest,
    bankSize,
    allBank,
    normalizeText,
  };
})(typeof window !== "undefined" ? window : globalThis);