(() => {
  const MONTH_ALIAS = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"];
  const WD = ["日", "月", "火", "水", "木", "金", "土"];

  const state = { years: [], year: null, data: null, notes: {}, pdfYears: [], today: null };

  const $ = (id) => document.getElementById(id);

  const pad = (n) => String(n).padStart(2, "0");
  const md = (date) => {
    const [y, m, d] = date.split("-").map(Number);
    return `${m}/${d}`;
  };
  const mdw = (date) => {
    const [y, m, d] = date.split("-").map(Number);
    return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
  };
  const eraOf = (year) => (year === 2019 ? "令和元年" : `令和${year - 2018}年`);

  async function init() {
    try {
      const res = await fetch("data/years.json");
      const meta = await res.json();
      state.years = meta.years;
      state.notes = meta.notes || {};
      const now = new Date();
      const y = Number(new URLSearchParams(location.search).get("year"));
      state.year = state.years.includes(y) ? y
        : state.years.includes(now.getFullYear()) ? now.getFullYear()
        : state.years[state.years.length - 1];
      buildYearSelect();
      try {
        const pdfRes = await fetch("pdf/manifest.json");
        state.pdfYears = (await pdfRes.json()).years || [];
      } catch (e) {
        state.pdfYears = [];
      }
      const tYear = new Date().getFullYear();
      if (state.years.includes(tYear)) {
        try {
          const tRes = await fetch(`data/koyomi-${tYear}.json`);
          state.today = { year: tYear, data: await tRes.json() };
        } catch (e) {
          state.today = null;
        }
      }
      await loadYear(state.year);
    } catch (e) {
      $("yearHead").textContent = "データを読み込めませんでした（ローカルで開く場合は簡易サーバー経由で開いてください）";
    }
  }

  function buildYearSelect() {
    const sel = $("yearSelect");
    sel.innerHTML = "";
    for (const y of state.years) {
      const opt = document.createElement("option");
      opt.value = y;
      opt.textContent = `${y}年（${eraOf(y)}）`;
      sel.appendChild(opt);
    }
    sel.value = state.year;
  }

  async function loadYear(year) {
    const res = await fetch(`data/koyomi-${year}.json`);
    state.data = await res.json();
    state.year = year;
    $("yearSelect").value = year;
    history.replaceState(null, "", `?year=${year}${location.hash}`);
    render();
    const h = location.hash.match(/^#d=(\d{4}-\d{2}-\d{2})$/);
    if (h) openDetail(h[1]);
  }

  function render() {
    const d = state.data;
    const head = $("yearHead");
    head.innerHTML = "";
    const era = document.createElement("span");
    era.className = "era";
    era.textContent = `${d.era}（${d.year}年）`;
    const eto = document.createElement("span");
    eto.className = "etojun";
    eto.textContent = `${d.etojun}の年`;
    head.append(era, eto);
    if (d.note) {
      const note = document.createElement("span");
      note.textContent = `　※${d.note}`;
      head.appendChild(note);
    }
    if (state.pdfYears.includes(d.year)) {
      const pdf = document.createElement("a");
      pdf.href = `pdf/koyomi-${d.year}.pdf`;
      pdf.textContent = "　印刷用PDF";
      pdf.style.color = "var(--midori)";
      head.appendChild(pdf);
    }

    const months = $("months");
    months.innerHTML = "";
    for (let m = 1; m <= 12; m++) months.appendChild(renderMonth(m, d));

    renderSummaries(d);
    renderKou(d);
    renderFooter(d);
    renderToday();
  }

  const addDay = (date, n) => {
    const [y, m, d] = date.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
    return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
  };

  function renderToday() {
    const el = $("todayCard");
    if (!state.today) {
      el.hidden = true;
      return;
    }
    const data = state.today.data;
    const now = new Date();
    const dateStr = `${data.year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const day = data.days.find((x) => x.date === dateStr);
    if (!day) {
      el.hidden = true;
      return;
    }
    let curIdx = -1;
    data.sekki.forEach((s, i) => { if (s.date <= dateStr) curIdx = i; });
    const curS = curIdx >= 0 ? data.sekki[curIdx] : null;
    const nextS = curIdx + 1 < data.sekki.length ? data.sekki[curIdx + 1] : null;
    const kouNow = data.kou.find((k) => k.from <= dateStr && dateStr <= k.to);
    const m = now.getMonth() + 1;
    const d = now.getDate();

    const rows = [];
    rows.push(`<div class="tc-row"><span class="k">旧暦</span><span class="v">${day.kyureki.leap ? "閏" : ""}${day.kyureki.m}月${day.kyureki.d}日</span></div>`);
    rows.push(`<div class="tc-row"><span class="k">干支</span><span class="v">${data.etojun}年 ${day.eto}の日</span></div>`);
    if (curS) {
      rows.push(`<div class="tc-row"><span class="k">二十四節気</span><span class="v">${curS.name}（${md(curS.date)}〜${nextS ? md(addDay(nextS.date, -1)) : ""}）</span></div>`);
    }
    if (kouNow) {
      rows.push(`<div class="tc-row"><span class="k">七十二候</span><span class="v">${kouNow.name}（${kouNow.part}・${md(kouNow.from)}〜${md(kouNow.to)}）</span></div>`);
    }
    if (day.holiday) rows.push(`<div class="tc-row tc-holiday"><span class="k">祝日</span><span class="v">${day.holiday}</span></div>`);
    if (day.events && day.events.length) rows.push(`<div class="tc-row"><span class="k">行事・雑節</span><span class="v">${day.events.join("、")}</span></div>`);
    rows.push(`<div class="tc-hint">${state.year === data.year ? "クリックで今日を詳細表示" : `${data.year}年の暦で今日を表示 →`}</div>`);

    el.innerHTML = `
      <div class="tc-left">
        <div class="tc-label">今日の暦</div>
        <div class="tc-date"><span class="tc-era">${data.era}</span>${m}月${d}日<span class="tc-wd">（${WD[day.wd]}）</span></div>
        <div class="tc-rokuyo${day.rokuyo === "大安" ? "" : " mild"}">${day.rokuyo}</div>
      </div>
      <div class="tc-right">${rows.join("")}</div>`;
    el.hidden = false;
  }

  function renderMonth(month, d) {
    const card = document.createElement("section");
    card.className = "month-card";
    const h2 = document.createElement("h2");
    const mname = document.createElement("span");
    mname.className = "mname";
    mname.textContent = MONTH_ALIAS[month - 1];
    const sekkiOfMonth = d.sekki.filter((s) => Number(s.date.slice(5, 7)) === month).map((s) => s.name).join("・");
    const msekki = document.createElement("span");
    msekki.className = "msekki";
    msekki.textContent = sekkiOfMonth;
    h2.append(document.createTextNode(`${month}月`), mname, msekki);
    card.appendChild(h2);

    const grid = document.createElement("div");
    grid.className = "grid";
    WD.forEach((w, i) => {
      const el = document.createElement("div");
      el.className = "wday" + (i === 0 ? " sun" : i === 6 ? " sat" : "");
      el.textContent = w;
      grid.appendChild(el);
    });

    const days = d.days.filter((x) => Number(x.date.slice(5, 7)) === month);
    const firstWd = days[0].wd;
    for (let i = 0; i < firstWd; i++) {
      const el = document.createElement("div");
      el.className = "cell empty";
      grid.appendChild(el);
    }
    for (const day of days) grid.appendChild(renderCell(day));
    card.appendChild(grid);
    return card;
  }

  function renderCell(day) {
    const el = document.createElement("div");
    const cls = ["cell"];
    if (day.wd === 0) cls.push("sun");
    if (day.wd === 6) cls.push("sat");
    if (day.holiday) cls.push("holiday");
    const now = new Date();
    if (day.date === `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`) cls.push("today");
    el.className = cls.join(" ");
    el.dataset.date = day.date;

    const row1 = document.createElement("div");
    row1.className = "row1";
    const dnum = document.createElement("span");
    dnum.className = "dnum";
    dnum.textContent = Number(day.date.slice(8, 10));
    const ro = document.createElement("span");
    ro.className = "rokuyo" + (day.rokuyo === "大安" ? " taian" : "");
    ro.textContent = day.rokuyo;
    row1.append(dnum, ro);
    el.appendChild(row1);

    const lines = [];
    if (day.holiday) lines.push({ text: day.holiday, cls: "holiday" });
    if (day.sekki) lines.push({ text: day.sekki, cls: "sekki" });
    if (day.kou) lines.push({ text: day.kou.name, cls: "kou" });
    for (const ev of day.events || []) lines.push({ text: ev, cls: "event" });

    const shown = lines.slice(0, 3);
    for (const l of shown) {
      const ev = document.createElement("div");
      ev.className = "ev " + l.cls;
      ev.textContent = l.text;
      el.appendChild(ev);
    }
    if (lines.length > shown.length) {
      const more = document.createElement("div");
      more.className = "ev more";
      more.textContent = `ほか${lines.length - shown.length}件`;
      el.appendChild(more);
    }

    const ky = document.createElement("div");
    ky.className = "kyureki";
    ky.textContent = `旧${day.kyureki.leap ? "閏" : ""}${day.kyureki.m}/${day.kyureki.d}`;
    el.appendChild(ky);
    return el;
  }

  function renderSummaries(d) {
    const hl = $("holidayList");
    hl.innerHTML = "";
    for (const h of d.holidays) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="dt">${mdw(h.date)}</span><span class="nm">${h.name}</span>`;
      hl.appendChild(li);
    }

    const sl = $("sekkiList");
    sl.innerHTML = "";
    for (const s of d.sekki) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="dt">${mdw(s.date)} ${s.time}</span><span class="nm">${s.name}</span>`;
      sl.appendChild(li);
    }

    const zl = $("zassetsuList");
    zl.innerHTML = "";
    const seen = new Set();
    const rows = [];
    for (const z of d.zassetsu) {
      rows.push({ date: z.date, name: z.name });
    }
    for (const day of d.days) {
      for (const ev of day.events || []) {
        const key = `${day.date}|${ev}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (["十五夜", "十三夜"].includes(ev)) rows.push({ date: day.date, name: ev });
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    for (const r of rows) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="dt">${mdw(r.date)}</span><span class="nm">${r.name}</span>`;
      zl.appendChild(li);
    }
  }

  function renderKou(d) {
    const t = $("kouTable");
    t.innerHTML = "";
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>期間</th><th>候</th><th>節気</th></tr>";
    t.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const k of d.kou) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${md(k.from)}〜${md(k.to)}</td><td class="nm">${k.name}（${k.part}）</td><td>${k.sekki}</td>`;
      tbody.appendChild(tr);
    }
    t.appendChild(tbody);
  }

  function renderFooter(d) {
    const f = $("siteFooter");
    f.innerHTML = `祝日: 内閣府「国民の祝日」CSV ／ 二十四節気・雑節: 国立天文台暦要項（天文計算による） ／ 旧暦・六曜・干支: 天保暦による計算 ／ 七十二候: 慣用表<br>` +
      `令和8年(2026)・令和9年(2027)は国立天文台暦要項と照合済み。2033年以降の旧暦は「2033年問題」により参考値です。`;
  }

  function closeDetail() {
    $("detail").hidden = true;
  }

  async function openDetail(date) {
    const day = state.data.days.find((x) => x.date === date);
    if (!day) return;
    const [y, m, d] = date.split("-").map(Number);
    const title = $("detailTitle");
    title.textContent = `${state.data.era}${m}月${d}日（${WD[day.wd]}曜日）`;

    const rows = [];
    rows.push(["西暦", `${y}年${m}月${d}日`]);
    rows.push(["干支", `${state.data.etojun}年 ${day.eto}の日`]);
    rows.push(["六曜", day.rokuyo, day.rokuyo === "大安" ? "hl" : ""]);
    rows.push(["旧暦", `${day.kyureki.leap ? "閏" : ""}${day.kyureki.m}月${day.kyureki.d}日`]);
    if (day.holiday) rows.push(["祝日", day.holiday, "hl"]);
    if (day.sekki) {
      const s = state.data.sekki.find((x) => x.name === day.sekki && x.date === day.date);
      rows.push(["二十四節気", `${day.sekki}（${s ? s.time : ""}）`, "sg"]);
    }
    const kouNow = state.data.kou.find((k) => {
      const from = new Date(k.from + "T00:00:00Z").getTime();
      const to = new Date(k.to + "T00:00:00Z").getTime();
      const cur = new Date(date + "T00:00:00Z").getTime();
      return from <= cur && cur <= to;
    });
    if (kouNow) rows.push(["七十二候", `${kouNow.name}（${kouNow.part}・${md(kouNow.from)}〜${md(kouNow.to)}）`]);
    if (day.events && day.events.length) rows.push(["行事・雑節", day.events.join("、")]);

    const table = $("detailTable");
    table.innerHTML = "";
    for (const [k, v, cls] of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<th>${k}</th><td class="${cls || ""}">${v}</td>`;
      table.appendChild(tr);
    }
    $("detail").hidden = false;
  }

  $("months").addEventListener("click", (e) => {
    const cell = e.target.closest(".cell[data-date]");
    if (cell) openDetail(cell.dataset.date);
  });
  $("todayCard").addEventListener("click", async () => {
    if (!state.today) return;
    const t = state.today;
    const now = new Date();
    const dateStr = `${t.year}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    if (state.year !== t.year) await loadYear(t.year);
    const cell = document.querySelector(`.cell[data-date="${dateStr}"]`);
    if (cell) cell.scrollIntoView({ behavior: "smooth", block: "center" });
    openDetail(dateStr);
  });
  $("detailClose").addEventListener("click", closeDetail);
  $("detail").addEventListener("click", (e) => {
    if (e.target === $("detail")) closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDetail();
    if (e.key === "ArrowLeft") changeYear(-1);
    if (e.key === "ArrowRight") changeYear(1);
  });
  $("prevYear").addEventListener("click", () => changeYear(-1));
  $("nextYear").addEventListener("click", () => changeYear(1));
  $("thisYear").addEventListener("click", () => {
    const y = new Date().getFullYear();
    if (state.years.includes(y)) loadYear(y);
  });
  $("yearSelect").addEventListener("change", (e) => loadYear(Number(e.target.value)));

  function changeYear(delta) {
    const i = state.years.indexOf(state.year);
    const ni = Math.min(Math.max(i + delta, 0), state.years.length - 1);
    if (ni !== i) loadYear(state.years[ni]);
  }

  init();
})();
