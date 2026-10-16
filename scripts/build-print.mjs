import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dataDir = path.join(root, "site", "data");
const printDir = path.join(root, "site", "print");
const pdfDir = path.join(root, "site", "pdf");

const MONTH_ALIAS = ["睦月", "如月", "弥生", "卯月", "皐月", "水無月", "文月", "葉月", "長月", "神無月", "霜月", "師走"];
const WD = ["日", "月", "火", "水", "木", "金", "土"];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function md(date) {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

function mdw(date) {
  const [y, m, d] = date.split("-").map(Number);
  return `${m}/${d}(${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

function cellHtml(day) {
  const cls = ["pcell"];
  if (day.wd === 0) cls.push("sun");
  if (day.wd === 6) cls.push("sat");
  if (day.holiday) cls.push("holiday");
  const lines = [];
  if (day.holiday) lines.push(`<div class="ev h">${esc(day.holiday)}</div>`);
  if (day.sekki) lines.push(`<div class="ev s">${esc(day.sekki)}</div>`);
  if (day.kou) lines.push(`<div class="ev k">${esc(day.kou.name)}</div>`);
  for (const ev of (day.events || []).slice(0, 5)) lines.push(`<div class="ev e">${esc(ev)}</div>`);
  return `<div class="${cls.join(" ")}">
  <div class="r1"><span class="dn">${Number(day.date.slice(8, 10))}</span><span class="ro">${esc(day.rokuyo)}</span></div>
  <div class="evs">${lines.join("")}</div>
  <div class="ky">旧${day.kyureki.leap ? "閏" : ""}${day.kyureki.m}/${day.kyureki.d}</div>
</div>`;
}

function coverHtml(d) {
  const sekkiRows = d.sekki.map((s) =>
    `<tr><td>${mdw(s.date)}</td><td class="sg">${esc(s.name)}</td><td class="tm">${esc(s.time)}</td></tr>`).join("");
  const zRows = d.zassetsu.map((z) =>
    `<tr><td>${mdw(z.date)}</td><td>${esc(z.name)}</td></tr>`).join("");
  const hRows = d.holidays.map((h) =>
    `<tr><td>${mdw(h.date)}</td><td class="hl">${esc(h.name)}</td></tr>`).join("");
  return `<section class="page cover">
  <div class="cover-head">
    <div class="cover-kicker">二十四節気・七十二候・雑節・六曜</div>
    <h1>日本の暦</h1>
    <div class="cover-year">${esc(d.era)}<span class="sep">｜</span>西暦 ${d.year} 年<span class="sep">｜</span><span class="hl">${esc(d.etojun)}</span>の年</div>
  </div>
  <div class="legend">
    <div class="lg"><span class="sw h"></span>祝日</div>
    <div class="lg"><span class="sw sun"></span>日曜</div>
    <div class="lg"><span class="sw sat"></span>土曜</div>
    <div class="lg"><span class="sw s"></span>二十四節気</div>
    <div class="lg"><span class="sw k"></span>七十二候</div>
    <div class="lg"><span class="sw e"></span>雑節・行事</div>
    <div class="lg"><span class="sw ro"></span>六曜</div>
    <div class="lg"><span class="sw ky"></span>旧暦（天保暦）</div>
  </div>
  <div class="cover-lists">
    <div class="cl">
      <h2>二十四節気</h2>
      <table>${sekkiRows}</table>
    </div>
    <div class="cl">
      <h2>雑節・年中行事</h2>
      <table>${zRows}</table>
    </div>
    <div class="cl">
      <h2>国民の祝日</h2>
      <table>${hRows}</table>
    </div>
  </div>
  <div class="cover-foot">
    祝日: 内閣府「国民の祝日」CSV（政令・官報告示に基づく）／二十四節気・雑節: 国立天文台暦要項に準拠した天文計算（中央標準時）<br>
    旧暦・六曜・干支: 天保暦による計算／七十二候: 日本で慣用される七十二候表（節気日から5日ごと）
  </div>
</section>`;
}

function monthHtml(d, month) {
  const days = d.days.filter((x) => Number(x.date.slice(5, 7)) === month);
  const firstWd = days[0].wd;
  const cells = [];
  for (let i = 0; i < firstWd; i++) cells.push(`<div class="pcell empty"></div>`);
  for (const day of days) cells.push(cellHtml(day));
  const rowCount = Math.ceil((firstWd + days.length) / 7);
  const sec = d.sekki.filter((s) => Number(s.date.slice(5, 7)) === month)
    .map((s) => `${esc(s.name)} ${md(s.date)} ${esc(s.time)}`).join("　／　");
  return `<section class="page month">
  <div class="month-head">
    <h2><span class="mn">${month}月</span><span class="alias">${MONTH_ALIAS[month - 1]}</span></h2>
    <div class="month-sekki">${sec}</div>
  </div>
  <div class="wdays">${WD.map((w, i) =>
    `<div class="wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("")}</div>
  <div class="pgrid" style="--rows:${rowCount}">${cells.join("")}</div>
</section>`;
}

function kouAppendix(d) {
  const half = Math.ceil(d.kou.length / 2);
  const col = (arr) => `<table>${arr.map((k) =>
    `<tr><td class="tm">${md(k.from)}〜${md(k.to)}</td><td class="sg">${esc(k.name)}</td><td class="part">${esc(k.part)}・${esc(k.sekki)}</td></tr>`).join("")}</table>`;
  return `<section class="page kou">
  <div class="month-head"><h2><span class="mn">七十二候</span><span class="alias">${d.year}年</span></h2></div>
  <div class="kou-cols">${col(d.kou.slice(0, half))}${col(d.kou.slice(half))}</div>
</section>`;
}

function renderDocument(d) {
  const pages = [coverHtml(d)];
  for (let m = 1; m <= 12; m++) pages.push(monthHtml(d, m));
  pages.push(kouAppendix(d));
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>日本の暦 ${d.year}年 印刷用</title>
<style>
@page { size: A4 portrait; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body {
  font-family: "Hiragino Mincho ProN", "Yu Mincho", "YuMincho", "Noto Serif JP", "Noto Serif CJK JP", serif;
  color: #2a2620;
  background: #fff;
}
.page {
  width: 210mm; height: 297mm;
  padding: 11mm 12mm 10mm;
  page-break-after: always;
  overflow: hidden;
  position: relative;
}
.page:last-child { page-break-after: auto; }
.hl { color: #b03a2e; } .sg { color: #3d6b4a; } .tm { color: #6b6355; font-variant-numeric: tabular-nums; }

.cover { display: flex; flex-direction: column; }
.cover-head { text-align: center; margin-top: 14mm; }
.cover-kicker { letter-spacing: 0.5em; font-size: 10pt; color: #6b6355; }
.cover h1 { font-size: 40pt; letter-spacing: 0.30em; margin: 8mm 0 6mm; font-weight: 600; }
.cover-year { font-size: 15pt; letter-spacing: 0.12em; }
.cover-year .sep { margin: 0 0.4em; color: #b7a98a; }

.legend { margin: 10mm auto 8mm; display: grid; grid-template-columns: repeat(4, auto); gap: 4mm 8mm; justify-content: center; font-size: 9pt; }
.lg { display: flex; align-items: center; gap: 2mm; }
.sw { width: 4mm; height: 4mm; border: 0.3mm solid #d8cfba; }
.sw.h { background: #f6dcd4; border-color: #b03a2e; }
.sw.sun { background: #b03a2e; }
.sw.sat { background: #2e4a7d; }
.sw.s { background: #3d6b4a; }
.sw.k { background: #9db28c; }
.sw.e { background: #96601f; }
.sw.ro { background: #6b6355; }
.sw.ky { background: #c9c0aa; }

.cover-lists { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm 7mm; margin: 0 2mm; }
.cl h2 { font-size: 11pt; letter-spacing: 0.3em; border-bottom: 0.4mm solid #d8cfba; padding-bottom: 1.5mm; margin-bottom: 2mm; }
.cl table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
.cl td { padding: 0.7mm 2mm 0.7mm 0; border-bottom: 0.2mm dashed #eee7d5; }
.cl td:first-child { width: 12mm; color: #6b6355; }

.cover-foot { margin-top: auto; font-size: 7pt; color: #6b6355; line-height: 1.7; border-top: 0.3mm solid #d8cfba; padding-top: 3mm; }

.month-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 3mm; border-bottom: 0.4mm solid #d8cfba; padding-bottom: 2mm; }
.month-head h2 { font-weight: 600; }
.month-head .mn { font-size: 17pt; letter-spacing: 0.15em; }
.month-head .alias { font-size: 9pt; color: #6b6355; letter-spacing: 0.3em; margin-left: 3mm; }
.month-sekki { font-size: 8.5pt; color: #3d6b4a; }

.wdays { display: grid; grid-template-columns: repeat(7, 1fr); font-size: 8pt; text-align: center; color: #6b6355; margin-bottom: 1mm; }
.wd.sun { color: #b03a2e; } .wd.sat { color: #2e4a7d; }

.pgrid { display: grid; grid-template-columns: repeat(7, 1fr); grid-auto-rows: calc(250mm / var(--rows, 6)); border: 0.3mm solid #d8cfba; }
.pcell { border: 0.2mm solid #e7e0cd; padding: 1mm 1.6mm; display: flex; flex-direction: column; overflow: hidden; }
.pcell.empty { background: #faf7ee; }
.pcell.holiday { background: #fdf2ee; }
.pcell .r1 { display: flex; align-items: baseline; gap: 2mm; }
.pcell .dn { font-size: 13pt; font-weight: 600; }
.pcell.sun .dn, .pcell.holiday .dn { color: #b03a2e; }
.pcell.sat .dn { color: #2e4a7d; }
.pcell .ro { font-size: 7pt; color: #6b6355; margin-left: auto; }
.pcell .evs { margin-top: 0.8mm; flex: 1; }
.pcell .ev { font-size: 7.3pt; line-height: 1.35; white-space: nowrap; overflow: hidden; }
.pcell .ev.h { color: #b03a2e; font-weight: 600; }
.pcell .ev.s { color: #3d6b4a; }
.pcell .ev.k { color: #7a8f6b; }
.pcell .ev.e { color: #96601f; }
.pcell .ky { font-size: 6.3pt; color: #a89f8a; text-align: right; }

.kou-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
.kou-cols table { width: 100%; border-collapse: collapse; font-size: 8pt; }
.kou-cols td { border-bottom: 0.2mm dashed #eee7d5; padding: 0.9mm 2mm 0.9mm 0; }
.kou-cols td.tm { width: 20mm; }
.kou-cols td.part { color: #6b6355; font-size: 7pt; }

@media screen {
  body { background: #d9d2c0; }
  .page { margin: 6mm auto; background: #fff; box-shadow: 0 0 6mm rgba(0,0,0,0.25); }
}
</style>
</head>
<body>
${pages.join("\n")}
</body>
</html>`;
}

function findChrome() {
  for (const bin of ["google-chrome-stable", "google-chrome", "chromium", "chromium-browser"]) {
    const r = spawnSync("which", [bin], { encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

const args = process.argv.slice(2).filter((a) => a !== "--pdf");
const withPdf = process.argv.includes("--pdf");
const years = args.map(Number).filter((n) => !Number.isNaN(n));
const thisYear = new Date().getFullYear();
const targetYears = years.length ? years : [thisYear, thisYear + 1];

fs.mkdirSync(printDir, { recursive: true });
fs.mkdirSync(pdfDir, { recursive: true });

const manifest = { years: [], generated: new Date().toISOString() };
for (const year of targetYears) {
  const dataPath = path.join(dataDir, `koyomi-${year}.json`);
  if (!fs.existsSync(dataPath)) {
    console.log(`skip ${year}: ${path.relative(root, dataPath)} がありません`);
    continue;
  }
  const d = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const html = renderDocument(d);
  const htmlPath = path.join(printDir, `koyomi-${year}.html`);
  fs.writeFileSync(htmlPath, html);
  console.log(`wrote ${path.relative(root, htmlPath)}`);

  if (withPdf) {
    const chrome = findChrome();
    if (!chrome) {
      console.log("chrome not found; PDF generation skipped");
      continue;
    }
    const pdfPath = path.join(pdfDir, `koyomi-${year}.pdf`);
    const r = spawnSync(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu",
      "--no-pdf-header-footer",
      "--virtual-time-budget=10000",
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ], { encoding: "utf8" });
    if (r.status === 0 && fs.existsSync(pdfPath)) {
      console.log(`wrote ${path.relative(root, pdfPath)}`);
      manifest.years.push(year);
    } else {
      console.log(`PDF generation failed for ${year}: ${r.stderr || ""}`);
    }
  }
}

if (withPdf) {
  fs.writeFileSync(path.join(pdfDir, "manifest.json"), JSON.stringify(manifest));
  console.log("wrote site/pdf/manifest.json");
}
