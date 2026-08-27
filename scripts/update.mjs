#!/usr/bin/env node
import { loadLatest, writeSnapshot, today } from "./lib.mjs";
import { fetchAA } from "./sources/aa.mjs";
import { fetchOpenRouter } from "./sources/openrouter.mjs";

const snapshotOnly = process.argv.includes("--snapshot-only");
const useOr = process.argv.includes("--openrouter");
const skipAa = process.argv.includes("--skip-aa");

const data = await loadLatest();
const prev = JSON.parse(JSON.stringify(data.models.map(m => ({
  id: m.id, in: m.in, out: m.out, cache: m.cache, aa: m.aa
}))));

const reports = [];
if (!snapshotOnly) {
  const jobs = [];
  if (!skipAa) jobs.push(["aa", fetchAA()]);
  if (useOr) jobs.push(["openrouter", fetchOpenRouter()]);
  for (const [key, p] of jobs) {
    try {
      const src = await p;
      const changed = src.apply(data);
      reports.push(`${src.name}: 更新 ${changed} 条`);
    } catch (err) {
      reports.push(`${key}: 失败（${err.message}），保留旧值`);
    }
  }
} else {
  reports.push("仅归档当前 latest.json");
}

const out = await writeSnapshot(data, { date: today() });
const diffs = [];
const now = Object.fromEntries(data.models.map(m => [m.id, m]));
for (const old of prev) {
  const m = now[old.id];
  if (!m) continue;
  const parts = [];
  if (m.in !== old.in || m.out !== old.out) parts.push(`价 ${old.in}/${old.out} -> ${m.in}/${m.out}`);
  if (m.aa !== old.aa) parts.push(`评分 ${old.aa ?? "—"} -> ${m.aa ?? "—"}`);
  if (parts.length) diffs.push(`${m.n}: ${parts.join("；")}`);
}

console.log(`快照 ${out.day}`);
for (const line of reports) console.log(line);
if (diffs.length) {
  console.log(`变动 ${diffs.length} 条：`);
  for (const line of diffs.slice(0, 30)) console.log(" - " + line);
  if (diffs.length > 30) console.log(` - …另 ${diffs.length - 30} 条`);
} else {
  console.log("价格与评分相对上一份 latest 无变化");
}
