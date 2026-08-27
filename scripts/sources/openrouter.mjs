import { matchName } from "../lib.mjs";

export async function fetchOpenRouter() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { "user-agent": "token-rank-update" }
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const json = await res.json();
  const rows = (json.data || []).map(item => {
    const p = item.pricing || {};
    const inn = p.prompt == null ? null : Number(p.prompt) * 1e6;
    const out = p.completion == null ? null : Number(p.completion) * 1e6;
    return {
      id: item.id,
      name: item.name || item.id,
      in: inn,
      out,
      cache: p.input_cache_read == null ? null : Number(p.input_cache_read) * 1e6
    };
  }).filter(r => r.in > 0 || r.out > 0);
  return {
    name: "openrouter",
    rows,
    apply(data) {
      const names = rows.map(r => r.name);
      let n = 0;
      for (const model of data.models) {
        if (model.unit !== "usd") continue;
        const aliases = [model.n, model.match?.openrouter, ...(model.match?.or || [])].filter(Boolean);
        let hit = null;
        if (model.match?.openrouter) {
          hit = rows.find(r => r.id === model.match.openrouter);
        }
        if (!hit) {
          for (const a of aliases) {
            const found = matchName(a, names);
            if (found) {
              hit = rows.find(r => r.name === found);
              if (hit) break;
            }
          }
        }
        if (!hit) continue;
        const next = {
          in: roundPrice(hit.in),
          out: roundPrice(hit.out),
          cache: hit.cache == null ? model.cache : roundPrice(hit.cache)
        };
        if (next.in !== model.in || next.out !== model.out || next.cache !== model.cache) n++;
        model.in = next.in;
        model.out = next.out;
        if (next.cache != null) model.cache = next.cache;
      }
      return n;
    }
  };
}

function roundPrice(v) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v >= 10) return Number(v.toFixed(2));
  if (v >= 1) return Number(v.toFixed(3));
  return Number(v.toFixed(4));
}
