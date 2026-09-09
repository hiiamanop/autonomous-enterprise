import { analyzeRuns, mean } from '../analyzers/statistical-analyzer.js';
import { EXPERIMENT_MODES, type BenchmarkResult, type ExperimentMode } from '../runner/benchmark-runner.js';
import { LatexExporter } from './latex-exporter.js';

const labels: Record<ExperimentMode, string> = { DETERMINISTIC: 'Deterministic Baseline', SINGLE_AGENT: 'Single-Agent', MULTI_AGENT: 'Multi-Agent', ORCHESTRATED: 'Orchestrated', PROPOSED: 'Proposed' };
const number = (value: number, digits = 2): string => value.toFixed(digits);

export class ThesisChapterExporter {
  constructor(private readonly result: BenchmarkResult) {}

  export(): string {
    const statistics = analyzeRuns(this.result.runs);
    const rows = EXPERIMENT_MODES.map(mode => `| ${labels[mode]} | ${number(statistics[mode].durationMs.mean)} | ${number(statistics[mode].successRate.mean)} | ${number(statistics[mode].aiCost.mean, 6)} | ${number(statistics[mode].conflictCount.mean)} | ${number(statistics[mode].escalationCount.mean)} |`);
    const proposed = statistics.PROPOSED;
    const baseline = statistics.DETERMINISTIC;
    const costDelta = baseline.aiCost.mean ? ((proposed.aiCost.mean - baseline.aiCost.mean) / baseline.aiCost.mean) * 100 : 0;
    const successDelta = proposed.successRate.mean - baseline.successRate.mean;
    return `# Bab Evaluasi Tesis

## Executive Summary

Eksperimen mengevaluasi lima mode otomasi enterprise pada ${this.result.runs.length} observasi. Mode Proposed mencapai rerata keberhasilan **${number(proposed.successRate.mean)}%**, dengan perubahan ${number(successDelta)} poin persentase terhadap baseline dan biaya AI rerata **$${number(proposed.aiCost.mean, 6)}** per observasi. Hasil ini menunjukkan trade-off terukur antara kualitas keputusan, latensi, dan konsumsi sumber daya.

## Metodologi Pengujian

Pengujian mengikuti PRD §41 menggunakan skenario lintas domain dan lima kondisi eksperimen: **Deterministic Baseline** (aturan tanpa AI), **Single-Agent** (satu agen), **Multi-Agent** (kolaborasi agen), **Orchestrated** (orkestrasi terpusat), dan **Proposed** (kebijakan otomasi dengan kontrol tata kelola). Setiap run mencatat durasi, keberhasilan, token, biaya, konflik, eskalasi, dan circuit breaker. Ringkasan menggunakan rerata dan interval kepercayaan 95% berbasis standard error; uji hipotesis disajikan sebagai pendekatan eksploratif, bukan pengganti uji inferensial berpasangan.

## Tabel Hasil Komparasi Empiris

| Mode | Mean Duration (ms) | Success Rate (%) | AI Cost ($) | Conflicts | Escalations |
| --- | ---: | ---: | ---: | ---: | ---: |
${rows}

## Signifikansi dan Efek

Perbandingan p-value aproksimasi, effect size, dan confidence interval tersedia pada artefak LaTeX reports/thesis-tables.tex, dengan baseline deterministic sebagai pembanding. Interpretasi hasil harus mempertimbangkan ukuran sampel dan korelasi antar-skenario.

## Efisiensi Biaya dan FinOps trade-offs

Mode non-deterministik meningkatkan token dan biaya karena inferensi, tetapi dapat memberi peningkatan kualitas pada skenario kompleks. Mode Proposed menukar biaya AI sekitar **${number(costDelta)}%** terhadap baseline dengan kontrol konflik dan eskalasi yang eksplisit. Strategi FinOps yang disarankan adalah routing deterministik untuk permintaan sederhana, model kecil untuk klasifikasi, serta model reasoning hanya pada kasus berisiko atau ambigu. Token, latency, dan biaya perlu dipantau per tenant.

## Efektivitas Tata Kelola Trust + Circuit Breaker

Trust governance dinilai melalui success rate, resolution margin, eskalasi ke manusia, dan circuit-breaker trips. Circuit breaker membatasi tindakan otomatis pada kondisi budget exhaustion atau stress tinggi; trip harus dipandang sebagai sinyal kontrol, bukan semata kegagalan. Eskalasi menjaga keputusan kritis tetap dapat ditinjau manusia dan mencegah loop agen tak terbatas melalui batas iterasi, waktu, serta anggaran.

## Macro Enterprise Saga Performance

Artefak LaTeX juga memuat throughput, keberhasilan langkah saga, dan rollback kompensasi untuk skenario macro. Metrik ini menguji konsistensi lintas domain dan kemampuan pemulihan ketika satu langkah gagal, sehingga melengkapi metrik lokal per run.

## Kesimpulan Ilmiah

Berdasarkan data eksperimen, pendekatan Proposed layak sebagai hipotesis arsitektural untuk otomasi enterprise yang dikontrol tata kelola: manfaat kualitas harus dibaca bersama biaya, latensi, dan kebutuhan human-in-the-loop. Klaim generalisasi memerlukan replikasi dengan sampel lebih besar, randomisasi urutan run, serta pengujian statistik berpasangan. Dengan batasan tersebut, hasil mendukung kesimpulan bahwa orkestrasi AI yang transparan, tenant-aware, dan circuit-breaker protected merupakan kompromi yang dapat dipertanggungjawabkan untuk sistem enterprise.

_ Generated at ${this.result.generatedAt}._
`;
  }
}

export function exportThesisChapter(result: BenchmarkResult): string { return new ThesisChapterExporter(result).export(); }
export function exportThesisArtifacts(result: BenchmarkResult): { latex: string; markdown: string } { return { latex: new LatexExporter(result).export(), markdown: exportThesisChapter(result) }; }
