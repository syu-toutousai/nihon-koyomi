# 日本の暦（nihon-koyomi）

祝日・二十四節気・七十二候・雑節・六曜・旧暦（天保暦）・干支・節句などの年中行事をまとめた、日本本土の暦です。

- **閲覧用**: GitHub Pages でそのまま公開できる静的サイト（`site/`）
- **印刷用**: A4縦14ページの独立PDF（`site/pdf/koyomi-YYYY.pdf`）と、PDF化もできる単体HTML（`site/print/koyomi-YYYY.html`）

## 構成

```
site/                      GitHub Pages の公開ディレクトリ
  index.html, style.css, app.js   閲覧用サイト（フレームワーク不使用）
  data/koyomi-YYYY.json           年ごとの計算済みデータ（2020〜2045）
  print/koyomi-YYYY.html          印刷用の独立HTML（単体で開ける）
  pdf/koyomi-YYYY.pdf             印刷用PDF（表紙+12ヶ月+七十二候一覧）
scripts/
  lib/koyomi.mjs                  暦の計算（天文計算・旧暦・六曜・雑節・七十二候）
  lib/tables.mjs                  七十二候名・干支・年中行事などのテーブル
  build-data.mjs                  データ生成（祝日CSV取り込み・年指定可）
  build-print.mjs                 印刷用HTML/PDF生成（Chromeが必要）
  verify.mjs                      国立天文台暦要項・こよみのページとの突合検証
.github/workflows/deploy.yml      push時にPagesへ自動配備、毎年3月に祝日CSV更新
```

## ローカルでの使い方

```sh
npm ci
npm run build     # 2020〜2045を生成（例: node scripts/build-data.mjs 2026 2027 で年指定）
npm run verify    # 2026/2027年は暦要項と全突合、旧暦・六曜・干支も検証
npm run serve     # http://localhost:8137 で閲覧
npm run pdf       # site/print/*.html と site/pdf/*.pdf を生成（要 Google Chrome）
```

## GitHub Pages への公開

```sh
git init
git add .
git commit -m "日本の暦"
git branch -M main
git remote add origin git@github.com:<ユーザー名>/<リポジトリ名>.git
git push -u origin main
```

1. リポジトリの Settings → Pages → Build and deployment → Source を **GitHub Actions** に変更
2. 以後は push のたびに自動でデータ生成→検証→PDF生成→配備
3. 毎年3月1日（UTC 15:00）に祝日CSVを取り直して自動再配備（祝日の官報公示は2月のため）

## データと計算法

| 項目 | 出典・方法 |
|---|---|
| 国民の祝日 | 内閣府「国民の祝日」CSV（政府標準利用規約）。CSVに無い年は法令の規則（ハッピーマンデー・振替休日・国民の休日）から計算 |
| 二十四節気・雑節 | astronomy-engine（MIT）による天文計算。日付・時刻は中央標準時（JST）。土用・入梅・半夏生は太陽黄経、節分・彼岸・八十八夜・二百十日は立春起点、社日は戊の日 |
| 旧暦・六曜 | 天保暦を天文計算から構成（冬至を含む月を11月、中気を含まない月を閏月、新月を含む日が朔日）。六曜は（旧暦月+日）%6 |
| 七十二候 | 日本で慣用される候名表を、節気日から5日刻みで割当 |
| 干支 | 日干支はユリウス日から、年干支は西暦から |

**検証**: `npm run verify` で、2026年・2027年の二十四節気24個（日付・時刻±2分）と雑節11種が国立天文台「暦要項」と、旧暦（閏月含む）・六曜・日干支が「こよみのページ」と全一致することを確認済みです。

## 注意事項

- 2033〜2034年の旧暦は「2033年問題」のため参考値です（データに注記あり）。
- 印刷PDFはA4縦・14ページ（表紙 / 1〜12月 / 七十二候一覧）。100%等倍で印刷してください。
- 祝日CSVは政府標準利用規約（出典記載で利用可）、astronomy-engine は MIT ライセンスです。

## ライセンス

本リポジトリのコードは MIT。データは上記の各出典に従います。
