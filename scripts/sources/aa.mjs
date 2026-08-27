import { matchName } from "../lib.mjs";

export async function fetchAA() {
  const url = "https://modelcap.ai/benchmarks/artificial-analysis-intelligence-index";
  const res = await fetch(url, { headers: { "user-agent": "token-rank-update" } });
  if (!res.ok) throw new Error(`AA ${res.status}`);
  const html = await res.text();
  const rows = [];
  const re = /\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*([\d.]+)\s*\|/g;
  let m;
  while ((m = re.exec(html))) {
    rows.push({ name: m[1].replace(/\s+/g, " ").trim(), aa: Number(m[2]) });
  }
  if (!rows.length) throw new Error("AA table empty");
  return {
    name: "artificial-analysis",
    rows,
    apply(data) {
      const names = rows.map(r => r.name);
      let n = 0;
      for (const model of data.models) {
        const aliases = [model.n, ...(model.match?.aa || [])];
        let hit = null;
        for (const a of aliases) {
          const found = matchName(a, names);
          if (found) {
            hit = rows.find(r => r.name === found);
            if (hit) break;
          }
        }
        if (hit && Number.isFinite(hit.aa)) {
          if (model.aa !== hit.aa) n++;
          model.aa = hit.aa;
        }
      }
      return n;
    }
  };
}
