/* Offline similar-idiom suggestions from precomputed data and local text overlap. */
(function (global) {
  const precomputed = global.CHENGYU_SIMILAR || {};
  const bank = global.CHENGYU_BANK || [];
  const bankByText = new Map(bank.map((e) => [e.text, e]));

  function normalize(text) {
    return String(text || "")
      .trim()
      .replace(/\s+/g, "");
  }

  function tokenizeMeaning(meaning) {
    const s = String(meaning || "")
      .replace(/[，。、；：！？""''（）\s]/g, "")
      .trim();
    const tokens = new Set();
    for (let i = 0; i < s.length; i += 1) {
      if (s[i]) tokens.add(s[i]);
      if (i < s.length - 1) tokens.add(s.slice(i, i + 2));
    }
    return tokens;
  }

  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let inter = 0;
    for (const x of a) {
      if (b.has(x)) inter += 1;
    }
    return inter / (a.size + b.size - inter);
  }

  function enrichSuggestions(texts) {
    return texts
      .map((t) => {
        const entry = bankByText.get(t);
        if (!entry) return { text: t, meaning: "", example: "" };
        return {
          text: entry.text,
          meaning: entry.meaning,
          example: entry.example || "",
        };
      })
      .slice(0, 4);
  }

  function fromPrecomputed(text) {
    const key = normalize(text);
    const bankHit = bankByText.get(key) || [...bankByText.values()].find((e) => normalize(e.text) === key);
    const lookupKey = bankHit ? bankHit.text : text;
    const list = precomputed[lookupKey];
    if (list && list.length) {
      return enrichSuggestions(list);
    }
    if (bankHit && bankHit.cluster) {
      const clusterPeers = bank
        .filter((e) => e.cluster === bankHit.cluster && e.text !== bankHit.text)
        .map((e) => e.text)
        .slice(0, 4);
      if (clusterPeers.length) return enrichSuggestions(clusterPeers);
    }
    return null;
  }

  function fromMeaningOverlap(text, meaning) {
    const exclude = normalize(text);
    const targetTokens = tokenizeMeaning(meaning);
    if (!targetTokens.size) return [];

    const scored = [];
    for (const entry of bank) {
      if (normalize(entry.text) === exclude) continue;
      const score = jaccard(targetTokens, tokenizeMeaning(entry.meaning));
      if (score > 0.12) {
        scored.push({ entry, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 4).map((x) => ({
      text: x.entry.text,
      meaning: x.entry.meaning,
      example: x.entry.example || "",
      score: x.score,
    }));
  }

  function suggestForIdiom(text, meaning) {
    const pre = fromPrecomputed(text);
    if (pre && pre.length) return { source: "bank", items: pre };

    const resolvedMeaning =
      meaning || (global.ChengyuDictionary && ChengyuDictionary.lookupMeaning(text)) || "";
    const overlap = fromMeaningOverlap(text, resolvedMeaning);
    if (overlap.length) return { source: "local", items: overlap };

    return { source: "none", items: [] };
  }

  function allBankSuggestions() {
    const keys = [...bankByText.keys()].sort((a, b) => a.localeCompare(b, "zh-CN"));
    return keys.map((text) => {
      const entry = bankByText.get(text);
      const items = fromPrecomputed(text) || [];
      return { text, meaning: entry.meaning, example: entry.example || "", similar: items };
    });
  }

  global.ChengyuSimilarMatcher = {
    suggestForIdiom,
    allBankSuggestions,
    fromPrecomputed,
  };
})(typeof window !== "undefined" ? window : globalThis);