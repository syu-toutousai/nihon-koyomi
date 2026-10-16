import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeYear, findSolarTerms, jdnOfDate, fmtDate } from "./lib/koyomi.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const NAOJ = {
  2026: {
    terms: {
      小寒: "01-05 17:23", 大寒: "01-20 10:45", 立春: "02-04 05:02", 雨水: "02-19 00:52",
      啓蟄: "03-05 22:59", 春分: "03-20 23:46", 清明: "04-05 03:40", 穀雨: "04-20 10:39",
      立夏: "05-05 20:49", 小満: "05-21 09:37", 芒種: "06-06 00:48", 夏至: "06-21 17:25",
      小暑: "07-07 10:57", 大暑: "07-23 04:13", 立秋: "08-07 20:43", 処暑: "08-23 11:19",
      白露: "09-07 23:41", 秋分: "09-23 09:05", 寒露: "10-08 15:29", 霜降: "10-23 18:38",
      立冬: "11-07 18:52", 小雪: "11-22 16:23", 大雪: "12-07 11:53", 冬至: "12-22 05:50",
    },
    zassetsu: {
      節分: "2026-02-03", 春彼岸入り: "2026-03-17", 秋彼岸入り: "2026-09-20",
      八十八夜: "2026-05-02", 二百十日: "2026-09-01",
      入梅: "2026-06-11", 半夏生: "2026-07-02",
      冬土用入り: "2026-01-17", 春土用入り: "2026-04-17",
      夏土用入り: "2026-07-20", 秋土用入り: "2026-10-20",
    },
  },
  2027: {
    terms: {
      小寒: "01-05 23:10", 大寒: "01-20 16:30", 立春: "02-04 10:46", 雨水: "02-19 06:33",
      啓蟄: "03-06 04:40", 春分: "03-21 05:25", 清明: "04-05 09:17", 穀雨: "04-20 16:18",
      立夏: "05-06 02:25", 小満: "05-21 15:18", 芒種: "06-06 06:26", 夏至: "06-21 23:11",
      小暑: "07-07 16:37", 大暑: "07-23 10:05", 立秋: "08-08 02:27", 処暑: "08-23 17:14",
      白露: "09-08 05:28", 秋分: "09-23 15:02", 寒露: "10-08 21:17", 霜降: "10-24 00:33",
      立冬: "11-08 00:39", 小雪: "11-22 22:16", 大雪: "12-07 17:38", 冬至: "12-22 11:42",
    },
    zassetsu: {
      節分: "2027-02-03", 春彼岸入り: "2027-03-18", 秋彼岸入り: "2027-09-20",
      八十八夜: "2027-05-02", 二百十日: "2027-09-01",
      入梅: "2027-06-11", 半夏生: "2027-07-02",
      冬土用入り: "2027-01-17", 春土用入り: "2027-04-17",
      夏土用入り: "2027-07-20", 秋土用入り: "2027-10-21",
    },
  },
};

const KOYOMI8 = [
  { date: "2026-01-01", m: 11, d: 13, leap: false, rokuyo: "大安", eto: "乙亥" },
  { date: "2025-08-01", m: 6, d: 8, leap: true, rokuyo: "先勝", eto: "壬寅" },
  { date: "2027-02-06", m: 12, d: 30, leap: false, rokuyo: "大安", eto: "丙辰" },
  { date: "2023-03-22", m: 2, d: 1, leap: true, rokuyo: "友引", eto: "己卯" },
  { date: "2025-07-25", m: 6, d: 1, leap: true, rokuyo: "赤口", eto: "乙未" },
];

function loadCsvHolidays() {
  const buf = fs.readFileSync(path.join(root, "data", "syukujitsu.csv"));
  const txt = new TextDecoder("shift_jis").decode(buf);
  const map = new Map();
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^(\d+)\/(\d+)\/(\d+),(.+)$/);
    if (!m) continue;
    map.set(`${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`, m[4].trim());
  }
  return map;
}

function minDiff(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return Math.abs((ah * 60 + am) - (bh * 60 + bm));
}

let failures = 0;
const fail = (msg) => { console.log("NG: " + msg); failures++; };

const csv = loadCsvHolidays();

for (const yearStr of Object.keys(NAOJ)) {
  const year = Number(yearStr);
  const terms = findSolarTerms(year);
  const byName = Object.fromEntries(terms.map((t) => [t.name, t]));
  for (const [name, expect] of Object.entries(NAOJ[year].terms)) {
    const [md, hm] = expect.split(" ");
    const t = byName[name];
    const gotMd = `${String(t.jst.m).padStart(2, "0")}-${String(t.jst.d).padStart(2, "0")}`;
    const gotHm = `${String(t.jst.H).padStart(2, "0")}:${String(t.jst.M).padStart(2, "0")}`;
    if (gotMd !== md) fail(`${year} ${name} 日付: expected ${md}, got ${gotMd}`);
    if (minDiff(gotHm, hm) > 2) fail(`${year} ${name} 時刻: expected ${hm}, got ${gotHm}`);
  }
  const data = computeYear(year, new Map([...csv].filter(([d]) => d.startsWith(yearStr))));
  const zmap = new Map();
  for (const z of data.zassetsu) {
    const key = z.name.replace("(", "(").replace(")", ")");
    if (!zmap.has(key)) zmap.set(key, z.date);
  }
  const zExpect = NAOJ[year].zassetsu;
  const zKeys = [
    ["節分", "節分"], ["春彼岸(入り)", "春彼岸入り"], ["秋彼岸(入り)", "秋彼岸入り"],
    ["八十八夜", "八十八夜"], ["二百十日", "二百十日"],
    ["入梅", "入梅"], ["半夏生", "半夏生"],
    ["冬土用入り", "冬土用入り"], ["春土用入り", "春土用入り"],
    ["夏土用入り", "夏土用入り"], ["秋土用入り", "秋土用入り"],
  ];
  for (const [gotKey, expKey] of zKeys) {
    if (zmap.get(gotKey) !== zExpect[expKey]) {
      fail(`${year} ${expKey}: expected ${zExpect[expKey]}, got ${zmap.get(gotKey)}`);
    }
  }
  console.log(`NAOJ ${year} 突合 完了`);
}

for (const s of KOYOMI8) {
  const year = Number(s.date.slice(0, 4));
  const data = computeYear(year, new Map([...csv].filter(([d]) => d.startsWith(String(year)))));
  const day = data.days.find((x) => x.date === s.date);
  if (!day) { fail(`${s.date} not found`); continue; }
  if (day.kyureki.m !== s.m || day.kyureki.d !== s.d || day.kyureki.leap !== s.leap) {
    fail(`${s.date} 旧暦: expected ${s.leap ? "閏" : ""}${s.m}/${s.d}, got ${day.kyureki.leap ? "閏" : ""}${day.kyureki.m}/${day.kyureki.d}`);
  }
  if (day.rokuyo !== s.rokuyo) fail(`${s.date} 六曜: expected ${s.rokuyo}, got ${day.rokuyo}`);
  if (day.eto !== s.eto) fail(`${s.date} 日干支: expected ${s.eto}, got ${day.eto}`);
}

console.log(failures === 0 ? "すべて一致" : `${failures} 件の不一致`);
process.exit(failures === 0 ? 0 : 1);
