import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeYear, jdn, fromJdn, findSolarTerms, fmtDate, jdnOfDate } from "./lib/koyomi.mjs";
import { eraOf } from "./lib/tables.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const csvPath = path.join(root, "data", "syukujitsu.csv");
const outDir = path.join(root, "site", "data");

function loadHolidays() {
  const buf = fs.readFileSync(csvPath);
  const txt = new TextDecoder("shift_jis").decode(buf);
  const map = new Map();
  const lines = txt.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^(\d+)\/(\d+)\/(\d+),(.+)$/);
    if (!m) continue;
    const date = `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
    map.set(date, m[4].trim());
  }
  return map;
}

function nthMonday(year, month, n) {
  let d = 1;
  while (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 1) d++;
  return d + 7 * (n - 1);
}

function legalHolidays(year) {
  const terms = findSolarTerms(year);
  const byName = Object.fromEntries(terms.map((t) => [t.name, t.jst]));
  const items = [
    { m: 1, d: 1, name: "元日" },
    { m: 1, d: nthMonday(year, 1, 2), name: "成人の日" },
    { m: 2, d: 11, name: "建国記念の日" },
    { m: 2, d: 23, name: "天皇誕生日" },
    { m: 4, d: 29, name: "昭和の日" },
    { m: 5, d: 3, name: "憲法記念日" },
    { m: 5, d: 4, name: "みどりの日" },
    { m: 5, d: 5, name: "こどもの日" },
    { m: 7, d: nthMonday(year, 7, 3), name: "海の日" },
    { m: 8, d: 11, name: "山の日" },
    { m: 9, d: nthMonday(year, 9, 3), name: "敬老の日" },
    { m: 10, d: nthMonday(year, 10, 2), name: "スポーツの日" },
    { m: 11, d: 3, name: "文化の日" },
    { m: 11, d: 23, name: "勤労感謝の日" },
    { m: byName["春分"].m, d: byName["春分"].d, name: "春分の日" },
    { m: byName["秋分"].m, d: byName["秋分"].d, name: "秋分の日" },
  ];
  const map = new Map(
    items.map((it) => [`${year}-${String(it.m).padStart(2, "0")}-${String(it.d).padStart(2, "0")}`, it.name]),
  );

  for (const [date, name] of [...map]) {
    const [y, m, d] = date.split("-").map(Number);
    if (new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0) {
      let jd = jdn(y, m, d) + 1;
      for (;;) {
        const cand = fmtDate(fromJdn(jd));
        if (!map.has(cand)) { map.set(cand, "振替休日"); break; }
        jd++;
      }
    }
  }

  const keys = [...map.keys()].sort();
  for (let i = 1; i < keys.length - 1; i++) {
    const prev = keys[i - 1], next = keys[i + 1];
    if (jdnOfDate(parseDate(next)) - jdnOfDate(parseDate(prev)) === 2) {
      const between = fmtDate(fromJdn(jdnOfDate(parseDate(prev)) + 1));
      if (!map.has(between)) map.set(between, "国民の休日");
    }
  }
  return map;
}

function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function holidaysForYear(year, csvMap) {
  const hasCsv = [...csvMap.keys()].some((k) => k.startsWith(`${year}-`));
  if (hasCsv) {
    const m = new Map();
    for (const [date, name] of csvMap) {
      if (date.startsWith(`${year}-`)) m.set(date, name);
    }
    return m;
  }
  return legalHolidays(year);
}

const argYears = process.argv.slice(2).map(Number).filter((n) => !Number.isNaN(n));
const years = argYears.length
  ? argYears
  : Array.from({ length: 26 }, (_, i) => 2020 + i);

fs.mkdirSync(outDir, { recursive: true });
const csvMap = loadHolidays();

const notes = {};
for (const year of years) {
  const holidays = holidaysForYear(year, csvMap);
  const data = computeYear(year, holidays);
  data.era = eraOf(year);
  if (year === 2033 || year === 2034) {
    data.note = "2033年問題の影響があり得るため参考値です";
    notes[year] = data.note;
  }
  const file = path.join(outDir, `koyomi-${year}.json`);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(`wrote ${path.relative(root, file)} (${data.days.length} days, ${data.zassetsu.length} zassetsu, ${data.kou.length} kou)`);
}

fs.writeFileSync(
  path.join(outDir, "years.json"),
  JSON.stringify({
    years,
    generated: new Date().toISOString(),
    notes,
  }),
);
console.log("wrote years.json");
