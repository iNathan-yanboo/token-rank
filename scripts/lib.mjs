import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LATEST = join(ROOT, "data", "latest.json");
export const HISTORY_DIR = join(ROOT, "data", "history");
export const HISTORY_INDEX = join(HISTORY_DIR, "index.json");

const VENDOR_SLUG = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  月之暗面: "moonshot",
  阿里云百炼: "alibaba",
  DeepSeek: "deepseek",
  智谱: "zhipu",
  xAI: "xai",
  字节火山: "bytedance",
  百度千帆: "baidu",
  美团: "meituan",
  MiniMax: "minimax",
  腾讯混元: "tencent",
  讯飞星火: "iflytek",
  小米: "xiaomi",
  Google: "google",
  "360智脑": "360",
  阶跃星辰: "stepfun",
  "腾讯云 TokenHub": "tencent",
  昆仑天工: "skywork",
  Mistral: "mistral"
};

export function modelId(v, n) {
  const vendor = VENDOR_SLUG[v] || slug(v);
  return `${vendor}/${slug(n)}`;
}

export function slug(s) {
  return String(s)
    .toLowerCase()
    .replace(/高峰/g, "peak")
    .replace(/空闲/g, "offpeak")
    .replace(/刊例/g, "list")
    .replace(/限时/g, "promo")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function norm(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export function today(d = new Date()) {
  const tz = new Date(d.getTime() + 8 * 3600 * 1000);
  return tz.toISOString().slice(0, 10);
}

export function blend(row, usdCny) {
  const inn = row.unit === "usd" ? row.in * usdCny : row.in;
  const out = row.unit === "usd" ? row.out * usdCny : row.out;
  const inEff = row.promoIn != null ? (row.unit === "usd" ? row.promoIn * usdCny : row.promoIn) : inn;
  const outEff = row.promoOut != null ? (row.unit === "usd" ? row.promoOut * usdCny : row.promoOut) : out;
  return inEff + 0.25 * outEff;
}

export async function loadLatest() {
  return JSON.parse(await readFile(LATEST, "utf8"));
}

export async function writeSnapshot(data, { date } = {}) {
  const day = date || data.date || today();
  data.date = day;
  data.updatedAt = new Date().toISOString();
  for (const m of data.models) {
    if (!m.id) m.id = modelId(m.v, m.n);
    m.blend = Number(blend(m, data.fx.usdCny).toFixed(6));
  }
  const json = JSON.stringify(data, null, 2) + "\n";
  await mkdir(HISTORY_DIR, { recursive: true });
  await writeFile(LATEST, json);
  await writeFile(join(HISTORY_DIR, `${day}.json`), json);
  let index = { dates: [] };
  try { index = JSON.parse(await readFile(HISTORY_INDEX, "utf8")); } catch {}
  if (!index.dates.includes(day)) index.dates.push(day);
  index.dates.sort();
  await writeFile(HISTORY_INDEX, JSON.stringify(index, null, 2) + "\n");
  return { day, path: join(HISTORY_DIR, `${day}.json`) };
}

export function matchName(query, candidates) {
  const q = norm(query);
  if (!q) return null;
  let best = null;
  for (const c of candidates) {
    const n = norm(c);
    if (!n) continue;
    if (n === q) return c;
    if (n.includes(q) || q.includes(n)) {
      const score = Math.min(n.length, q.length) / Math.max(n.length, q.length);
      if (!best || score > best.score) best = { c, score };
    }
  }
  return best && best.score >= 0.55 ? best.c : null;
}
