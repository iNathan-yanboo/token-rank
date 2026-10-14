import { matchName } from "../lib.mjs";

const SOURCES = [
  "https://models.fru.dev/benchmarks/aa-intelligence-index",
  "https://www.benchleader.com/benchmarks/aa_intelligence_index",
  "https://atlas.kevinhu.io/benchmarks/aa-intelligence-index-v4-3-2"
];

const VENDOR_TAIL = /\s+(anthropic|openai|google|meta|spacexai|xiaomi|alibaba|zhipu ai|z\.?ai|stepfun|moonshot ai|mistral ai|deepseek|minimax)\s*$/i;

export async function fetchAA() {
  const pages = await Promise.all(SOURCES.map(async url => {
    const res = await fetch(url, { headers: { "user-agent": "token-rank-update" } });
    if (!res.ok) throw new Error(`AA ${res.status} ${url}`);
    return { url, html: await res.text() };
  }));
  const byName = new Map();
  for (const page of pages) {
    for (const row of parsePage(page)) {
      const prev = byName.get(row.name);
      if (!prev || row.aa > prev.aa) byName.set(row.name, row);
    }
  }
  const rows = [...byName.values()];
  if (rows.length < 20) throw new Error("AA table empty");
  return {
    name: "artificial-analysis",
    rows,
    apply(data) {
      let n = 0;
      for (const model of data.models) {
        const aliases = [model.n, ...(model.match?.aa || [])];
        const hits = [];
        for (const row of rows) {
          for (const a of aliases) {
            if (matchName(a, [row.name]) === row.name) {
              hits.push(row);
              break;
            }
          }
        }
        if (!hits.length) continue;
        const aa = Math.max(...hits.map(h => h.aa));
        if (model.aa !== aa) n++;
        model.aa = aa;
      }
      return n;
    }
  };
}

function parsePage({ url, html }) {
  if (url.includes("models.fru.dev")) return parseFru(html);
  return [...parseHtmlTable(html), ...parseMarkdownTable(html)];
}

function parseFru(html) {
  const marker = "window.__DATA__=";
  const i = html.indexOf(marker);
  if (i < 0) return [];
  const j = html.indexOf("</script>", i);
  const data = JSON.parse(html.slice(i + marker.length, j).trim().replace(/;+$/, ""));
  const scores = data?.route?.scores;
  if (!Array.isArray(scores)) return [];
  return scores.map(s => row(s.raw || s.model, s.score)).filter(Boolean);
}

function parseHtmlTable(html) {
  const rows = [];
  const trs = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  for (const tr of trs) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(m => text(m[1]));
    if (cells.length < 2) continue;
    const start = /^\d+$/.test(cells[0] || "") ? 1 : 0;
    const name = cleanName(cells.slice(start).find(c => /[a-zA-Z]/.test(c)) || "");
    const score = cells.slice(start).map(c => Number(c.replace(/,/g, ""))).find(n => Number.isFinite(n) && n > 0 && n <= 100);
    const r = row(name, score);
    if (r) rows.push(r);
  }
  return rows;
}

function parseMarkdownTable(html) {
  const rows = [];
  for (const line of html.split("\n")) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*([\d.]+)\s*\|/);
    if (!m) continue;
    const r = row(cleanName(text(m[1])), Number(m[2]));
    if (r) rows.push(r);
  }
  return rows;
}

function cleanName(name) {
  return String(name)
    .replace(/^new\s+/i, "")
    .replace(/\s+open\s*↗?\s*$/i, "")
    .replace(VENDOR_TAIL, "")
    .replace(/\s+/g, " ")
    .trim();
}

function text(html) {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function row(name, score) {
  const aa = Number(Number(score).toFixed(1));
  const n = String(name || "").trim();
  if (!n || n.toLowerCase() === "model" || !Number.isFinite(aa) || aa <= 0) return null;
  return { name: n, aa };
}
