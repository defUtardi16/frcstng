# Industrial Engineering Toolkit — Forecasting Tool

Web statis sederhana untuk membantu kebutuhan kuliah Teknik Industri, khususnya peramalan demand/produksi.

## Fitur

- Moving Average
- Weighted Moving Average
- Exponential Smoothing
- Next Forecast
- MAD, MSE, MAPE
- Grafik aktual vs forecast tanpa library eksternal
- Import CSV sederhana
- Export hasil ke CSV
- Light/dark theme
- Siap upload ke GitHub Pages

## Struktur Folder

```text
industrial-engineering-toolkit/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── icons.js
│   ├── forecasting.js
│   └── app.js
├── data/
│   └── sample-demand.csv
└── README.md
```

## Format CSV Import

Gunakan dua kolom:

```csv
Periode,Aktual
Jan,120
Feb,132
Mar,128
```

## Cara Upload ke GitHub Pages

1. Buat repository baru di GitHub.
2. Upload semua isi folder ini ke repository.
3. Masuk ke **Settings** → **Pages**.
4. Pada **Build and deployment**, pilih:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Simpan, lalu tunggu link GitHub Pages aktif.

## Catatan

Project ini sengaja dibuat tanpa build step dan tanpa framework agar bisa langsung dipakai via GitHub Pages.
