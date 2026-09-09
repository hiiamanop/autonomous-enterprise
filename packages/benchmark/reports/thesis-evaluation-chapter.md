# Bab Evaluasi Tesis

## Executive Summary

Eksperimen mengevaluasi lima mode otomasi enterprise pada 105 observasi. Mode Proposed mencapai rerata keberhasilan **83.79%**, dengan perubahan 6.03 poin persentase terhadap baseline dan biaya AI rerata **$0.003999** per observasi. Hasil ini menunjukkan trade-off terukur antara kualitas keputusan, latensi, dan konsumsi sumber daya.

## Metodologi Pengujian

Pengujian mengikuti PRD §41 menggunakan skenario lintas domain dan lima kondisi eksperimen: **Deterministic Baseline** (aturan tanpa AI), **Single-Agent** (satu agen), **Multi-Agent** (kolaborasi agen), **Orchestrated** (orkestrasi terpusat), dan **Proposed** (kebijakan otomasi dengan kontrol tata kelola). Setiap run mencatat durasi, keberhasilan, token, biaya, konflik, eskalasi, dan circuit breaker. Ringkasan menggunakan rerata dan interval kepercayaan 95% berbasis standard error; uji hipotesis disajikan sebagai pendekatan eksploratif, bukan pengganti uji inferensial berpasangan.

## Tabel Hasil Komparasi Empiris

| Mode | Mean Duration (ms) | Success Rate (%) | AI Cost ($) | Conflicts | Escalations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Deterministic Baseline | 144.95 | 77.76 | 0.000000 | 4.62 | 0.00 |,| Single-Agent | 170.95 | 73.04 | 0.004362 | 6.90 | 0.00 |,| Multi-Agent | 209.57 | 70.54 | 0.005453 | 8.57 | 0.00 |,| Orchestrated | 185.52 | 72.11 | 0.004726 | 7.52 | 0.00 |,| Proposed | 161.52 | 83.79 | 0.003999 | 2.86 | 0.57 |

## Signifikansi dan Efek

Perbandingan p-value aproksimasi, effect size, dan confidence interval tersedia pada artefak LaTeX reports/thesis-tables.tex, dengan baseline deterministic sebagai pembanding. Interpretasi hasil harus mempertimbangkan ukuran sampel dan korelasi antar-skenario.

## Efisiensi Biaya dan FinOps trade-offs

Mode non-deterministik meningkatkan token dan biaya karena inferensi, tetapi dapat memberi peningkatan kualitas pada skenario kompleks. Mode Proposed menukar biaya AI sekitar **0.00%** terhadap baseline dengan kontrol konflik dan eskalasi yang eksplisit. Strategi FinOps yang disarankan adalah routing deterministik untuk permintaan sederhana, model kecil untuk klasifikasi, serta model reasoning hanya pada kasus berisiko atau ambigu. Token, latency, dan biaya perlu dipantau per tenant.

## Efektivitas Tata Kelola Trust + Circuit Breaker

Trust governance dinilai melalui success rate, resolution margin, eskalasi ke manusia, dan circuit-breaker trips. Circuit breaker membatasi tindakan otomatis pada kondisi budget exhaustion atau stress tinggi; trip harus dipandang sebagai sinyal kontrol, bukan semata kegagalan. Eskalasi menjaga keputusan kritis tetap dapat ditinjau manusia dan mencegah loop agen tak terbatas melalui batas iterasi, waktu, serta anggaran.

## Macro Enterprise Saga Performance

Artefak LaTeX juga memuat throughput, keberhasilan langkah saga, dan rollback kompensasi untuk skenario macro. Metrik ini menguji konsistensi lintas domain dan kemampuan pemulihan ketika satu langkah gagal, sehingga melengkapi metrik lokal per run.

## Kesimpulan Ilmiah

Berdasarkan data eksperimen, pendekatan Proposed layak sebagai hipotesis arsitektural untuk otomasi enterprise yang dikontrol tata kelola: manfaat kualitas harus dibaca bersama biaya, latensi, dan kebutuhan human-in-the-loop. Klaim generalisasi memerlukan replikasi dengan sampel lebih besar, randomisasi urutan run, serta pengujian statistik berpasangan. Dengan batasan tersebut, hasil mendukung kesimpulan bahwa orkestrasi AI yang transparan, tenant-aware, dan circuit-breaker protected merupakan kompromi yang dapat dipertanggungjawabkan untuk sistem enterprise.

_ Generated at 2026-09-02T10:37:00.073Z._
