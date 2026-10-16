import { SearchMoonPhase, SearchSunLongitude } from "astronomy-engine";
import {
  SEKki_NAMES, SEKki_LONS, CHUKI_LONS, KOU_TABLE, KOU_PARTS,
  ROKUYO, ETO_60, FIXED_EVENTS,
} from "./tables.mjs";

const JST_OFFSET_MS = 9 * 3600 * 1000;

export function jdn(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const y2 = y + 4800 - a;
  const m2 = m + 12 * a - 3;
  return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4)
    - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
}

export function fromJdn(jd) {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  const day = e - Math.floor((153 * m + 2) / 5) + 1;
  const month = m + 3 - 12 * Math.floor(m / 10);
  const year = 100 * b + d - 4800 + Math.floor(m / 10);
  return { y: year, m: month, d: day };
}

export function jdnOfDate(o) {
  return jdn(o.y, o.m, o.d);
}

function jstOf(date) {
  const t = new Date(date.getTime() + JST_OFFSET_MS);
  return {
    y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    H: t.getUTCHours(), M: t.getUTCMinutes(), S: t.getUTCSeconds(),
  };
}

export function fmtDate(o) {
  return `${o.y}-${String(o.m).padStart(2, "0")}-${String(o.d).padStart(2, "0")}`;
}

export function fmtTime(o) {
  return `${String(o.H).padStart(2, "0")}:${String(o.M).padStart(2, "0")}`;
}

export function addDays(o, n) {
  const t = new Date(Date.UTC(o.y, o.m - 1, o.d) + n * 86400000);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export function etoIndexAtJdn(jd) {
  return ((jd + 49) % 60 + 60) % 60;
}

export function etoOfDay(o) {
  return ETO_60[etoIndexAtJdn(jdnOfDate(o))];
}

export function etoOfYear(year) {
  return ETO_60[((year - 4) % 60 + 60) % 60];
}

export function rokuyoOf(kyurekiMonth, kyurekiDay) {
  return ROKUYO[(kyurekiMonth + kyurekiDay) % 6];
}

export function findSolarTerms(year) {
  const terms = [];
  let cursor = new Date(Date.UTC(year - 1, 11, 20));
  for (let i = 0; i < SEKki_LONS.length; i++) {
    const t = SearchSunLongitude(SEKki_LONS[i], cursor, 40);
    if (!t) throw new Error(`sun longitude ${SEKki_LONS[i]} not found near ${year}`);
    terms.push({ name: SEKki_NAMES[i], lon: SEKki_LONS[i], jst: jstOf(t.date), utc: t.date });
    cursor = new Date(t.date.getTime() + 3600 * 1000);
  }
  return terms;
}

export function findTermByLon(year, lon) {
  const t = SearchSunLongitude(lon, new Date(Date.UTC(year, 0, 1)), 380);
  if (!t) throw new Error(`lon ${lon} not found in ${year}`);
  return { lon, jst: jstOf(t.date), utc: t.date };
}

export function findNewMoons(from, to) {
  const out = [];
  let cursor = new Date(from.getTime());
  for (;;) {
    const t = SearchMoonPhase(0, cursor, 45);
    if (!t || t.date.getTime() > to.getTime()) break;
    out.push(jstOf(t.date));
    cursor = new Date(t.date.getTime() + 3600 * 1000);
  }
  return out;
}

export function buildKyureki(year) {
  const newMoons = findNewMoons(
    new Date(Date.UTC(year - 1, 8, 1)),
    new Date(Date.UTC(year + 1, 2, 31)),
  );
  const nmJd = newMoons.map(jdnOfDate);

  const termsPrev = findSolarTerms(year - 1);
  const termsCur = findSolarTerms(year);
  const toujiPrev = termsPrev.find((t) => t.lon === 270);
  const toujiCur = termsCur.find((t) => t.lon === 270);

  const monthIndexAt = (jd) => {
    let lo = 0, hi = nmJd.length - 1, ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (nmJd[mid] <= jd) { ans = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    if (ans < 0) throw new Error("new moon before range");
    return ans;
  };

  const i0 = monthIndexAt(jdnOfDate(toujiPrev.jst));
  const i1 = monthIndexAt(jdnOfDate(toujiCur.jst));

  const chukiJd = [jdnOfDate(toujiPrev.jst)];
  for (const t of termsCur) {
    if (CHUKI_LONS.has(t.lon)) chukiJd.push(jdnOfDate(t.jst));
  }
  chukiJd.sort((a, b) => a - b);

  const labels = new Map();
  const end = Math.min(i1 + 3, newMoons.length - 1);
  let k = null;
  if (i1 - i0 === 13) {
    for (let i = i0 + 1; i < i1; i++) {
      const from = nmJd[i];
      const to = nmJd[i + 1] - 1;
      const has = chukiJd.some((jd) => jd >= from && jd <= to);
      if (!has) { k = i; break; }
    }
  }
  let cur = 11;
  let last = 11;
  for (let i = i0; i <= end; i++) {
    if (i === k) {
      labels.set(i, { num: last, leap: true });
    } else {
      labels.set(i, { num: cur, leap: false });
      last = cur;
      cur = cur % 12 + 1;
    }
  }

  const map = new Map();
  const startJd = jdn(year, 1, 1);
  const endJd = jdn(year, 12, 31);
  for (let jd = startJd; jd <= endJd; jd++) {
    const idx = monthIndexAt(jd);
    const lab = labels.get(idx);
    if (!lab) throw new Error(`no label for month index ${idx} in ${year}`);
    map.set(jd, { m: lab.num, d: jd - nmJd[idx] + 1, leap: lab.leap });
  }
  return map;
}

export function buildZassetsu(year, terms) {
  const byName = Object.fromEntries(terms.map((t) => [t.name, t.jst]));
  const list = [];
  const push = (name, jst) => list.push({ name, date: fmtDate(jst) });

  push("初午", findFirstUmaOfFeb(year));
  push("節分", addDays(byName["立春"], -1));

  push("春彼岸(入り)", addDays(byName["春分"], -3));
  push("春彼岸(中日)", byName["春分"]);
  push("春彼岸(明け)", addDays(byName["春分"], 3));
  push("秋彼岸(入り)", addDays(byName["秋分"], -3));
  push("秋彼岸(中日)", byName["秋分"]);
  push("秋彼岸(明け)", addDays(byName["秋分"], 3));

  push("八十八夜", addDays(byName["立春"], 87));
  push("二百十日", addDays(byName["立春"], 209));
  push("二百二十日", addDays(byName["立春"], 219));

  push("入梅", findTermByLon(year, 80).jst);
  push("半夏生", findTermByLon(year, 100).jst);

  const 四立 = {
    297: byName["立春"],
    27: byName["立夏"],
    117: byName["立秋"],
    207: byName["立冬"],
  };
  const 土用Names = { 297: "冬土用", 27: "春土用", 117: "夏土用", 207: "秋土用" };

  for (const lon of [297, 27, 117, 207]) {
    const t = findTermByLon(year, lon);
    push(土用Names[lon] + "入り", t.jst);
    const fromJd = jdnOfDate(t.jst);
    const toJd = jdnOfDate(addDays(四立[lon], -1));
    for (let jd = fromJd; jd <= toJd; jd++) {
      if (etoIndexAtJdn(jd) % 12 === 1) push("土用の丑の日", fromJdn(jd));
    }
  }

  const shanichi = (centerName) => {
    const cJd = jdnOfDate(byName[centerName]);
    for (let diff = 0; diff <= 5; diff++) {
      const cands = diff === 0 ? [0] : [-diff, diff];
      for (const dd of cands) {
        const jd = cJd + dd;
        if (etoIndexAtJdn(jd) % 10 === 4) return fromJdn(jd);
      }
    }
    return null;
  };
  const 春社日 = shanichi("春分");
  const 秋社日 = shanichi("秋分");
  if (春社日) push("春社日", 春社日);
  if (秋社日) push("秋社日", 秋社日);

  return list;
}

function findFirstUmaOfFeb(year) {
  for (let d = 1; d <= 11; d++) {
    if (etoIndexAtJdn(jdn(year, 2, d)) % 12 === 6) return { y: year, m: 2, d };
  }
  return { y: year, m: 2, d: 1 };
}

export function buildKouSegments(terms) {
  const segs = [];
  for (let i = 0; i < terms.length; i++) {
    const t = terms[i];
    const kou = KOU_TABLE[t.name];
    for (let p = 0; p < 3; p++) {
      const from = addDays(t.jst, p * 5);
      const to = p < 2
        ? addDays(t.jst, p * 5 + 4)
        : (i + 1 < terms.length ? addDays(terms[i + 1].jst, -1) : addDays(t.jst, 14));
      segs.push({
        name: kou[p], part: KOU_PARTS[p], sekki: t.name,
        from: fmtDate(from), to: fmtDate(to),
        fromJd: jdnOfDate(from), toJd: jdnOfDate(to),
      });
    }
  }
  return segs;
}

export function computeYear(year, holidaysByDate) {
  const terms24 = findSolarTerms(year);
  const termsPrev = findSolarTerms(year - 1);
  const toujiPrevTerm = termsPrev.find((t) => t.lon === 270);
  const termsForKou = [toujiPrevTerm, ...terms24];

  const kyureki = buildKyureki(year);
  const zassetsu = buildZassetsu(year, terms24);
  const kouSegsAll = buildKouSegments(termsForKou);

  const zByDate = new Map();
  for (const z of zassetsu) {
    if (!zByDate.has(z.date)) zByDate.set(z.date, []);
    zByDate.get(z.date).push(z.name);
  }

  const eventsByDate = new Map();
  const addEvent = (date, name) => {
    if (!eventsByDate.has(date)) eventsByDate.set(date, []);
    if (!eventsByDate.get(date).includes(name)) eventsByDate.get(date).push(name);
  };
  for (const e of FIXED_EVENTS) {
    addEvent(`${year}-${String(e.m).padStart(2, "0")}-${String(e.d).padStart(2, "0")}`, e.name);
  }
  for (const [date, names] of zByDate) for (const n of names) addEvent(date, n);

  for (const [jd, k] of kyureki) {
    if (k.leap) continue;
    const date = fmtDate(fromJdn(jd));
    if (k.m === 8 && k.d === 15) addEvent(date, "十五夜");
    if (k.m === 9 && k.d === 13) addEvent(date, "十三夜");
  }

  const sekkiByDate = new Map();
  for (const t of terms24) sekkiByDate.set(fmtDate(t.jst), t.name);

  const days = [];
  const startJd = jdn(year, 1, 1);
  const endJd = jdn(year, 12, 31);
  for (let jd = startJd; jd <= endJd; jd++) {
    const o = fromJdn(jd);
    const date = fmtDate(o);
    const k = kyureki.get(jd);
    const wd = new Date(Date.UTC(year, o.m - 1, o.d)).getUTCDay();
    const day = {
      date,
      wd,
      rokuyo: rokuyoOf(k.m, k.d),
      kyureki: { m: k.m, d: k.d, leap: k.leap },
      eto: ETO_60[etoIndexAtJdn(jd)],
    };
    const h = holidaysByDate.get(date);
    if (h) day.holiday = h;
    const s = sekkiByDate.get(date);
    if (s) day.sekki = s;
    const seg = kouSegsAll.find((x) => x.fromJd <= jd && jd <= x.toJd);
    if (seg && jd === seg.fromJd) day.kou = { name: seg.name, part: seg.part };
    const ev = eventsByDate.get(date);
    if (ev && ev.length) day.events = ev;
    days.push(day);
  }

  const kouList = kouSegsAll
    .filter((x) => x.from.startsWith(String(year)))
    .map(({ name, part, sekki, from, to }) => ({ name, part, sekki, from, to }));

  const holidays = [...holidaysByDate.entries()]
    .filter(([d]) => d.startsWith(`${year}-`))
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, name]) => ({ date, name }));

  return {
    year,
    etojun: etoOfYear(year),
    days,
    sekki: terms24.map((t) => ({
      name: t.name, lon: t.lon, date: fmtDate(t.jst), time: fmtTime(t.jst),
    })),
    zassetsu: zassetsu.map((z) => ({ name: z.name, date: z.date })),
    kou: kouList,
    holidays,
  };
}
