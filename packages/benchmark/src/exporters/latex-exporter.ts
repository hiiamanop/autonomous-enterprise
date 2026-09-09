import { analyzeRuns, mean, standardDeviation } from '../analyzers/statistical-analyzer.js';
import { EXPERIMENT_MODES, type BenchmarkResult, type ExperimentMode, type RunMetrics } from '../runner/benchmark-runner.js';

const modeLabels: Record<ExperimentMode, string> = {
  DETERMINISTIC: 'Deterministic Baseline',
  SINGLE_AGENT: 'Single-Agent',
  MULTI_AGENT: 'Multi-Agent',
  ORCHESTRATED: 'Orchestrated',
  PROPOSED: 'Proposed',
};

const escapeLatex = (value: string): string => value.replaceAll('\\', '\\textbackslash{}').replaceAll('&', '\\&').replaceAll('%', '\\%').replaceAll('_', '\\_').replaceAll('#', '\\#');
const format = (value: number, digits = 2): string => Number.isFinite(value) ? value.toFixed(digits) : '0.00';
const rowsByMode = (result: BenchmarkResult, mode: ExperimentMode): RunMetrics[] => result.runs.filter(run => run.mode === mode);
const aggregate = (result: BenchmarkResult, mode: ExperimentMode, metric: keyof RunMetrics): number => mean(rowsByMode(result, mode).map(run => Number(run[metric])));
const aggregateTokens = (result: BenchmarkResult, mode: ExperimentMode): number => mean(rowsByMode(result, mode).map(run => run.tokens.total));
const table = (caption: string, label: string, columns: string, rows: string[]): string => [
  '\\begin{table}[htbp]', '\\centering', '\\caption{' + caption + '}', '\\label{' + label + '}', '\\begin{tabular}{' + columns + '}', '\\toprule', ...rows, '\\bottomrule', '\\end{tabular}', '\\end{table}',
].join('\n');

export interface HypothesisRow { comparison: string; pValue: number; effectSize: number; confidenceInterval: [number, number]; }

export function compareHypotheses(result: BenchmarkResult): HypothesisRow[] {
  const baseline = rowsByMode(result, 'DETERMINISTIC').map(run => run.successRate);
  const baselineMean = mean(baseline);
  const baselineVariance = standardDeviation(baseline) ** 2;
  return EXPERIMENT_MODES.filter(mode => mode !== 'DETERMINISTIC').map(mode => {
    const values = rowsByMode(result, mode).map(run => run.successRate);
    const delta = mean(values) - baselineMean;
    const pooledError = Math.sqrt((baselineVariance + standardDeviation(values) ** 2) / Math.max(1, values.length));
    const effectSize = (delta / Math.sqrt((baselineVariance + standardDeviation(values) ** 2) / 2)) || 0;
    const margin = 1.96 * pooledError;
    const statistic = pooledError ? Math.abs(delta) / pooledError : 0;
    const pValue = Math.min(1, Math.max(0, Math.exp(-0.5 * statistic ** 2)));
    return { comparison: `${modeLabels[mode]} vs baseline`, pValue, effectSize, confidenceInterval: [delta - margin, delta + margin] };
  });
}

export class LatexExporter {
  constructor(private readonly result: BenchmarkResult) {}

  comparisonTable(): string {
    const rows = EXPERIMENT_MODES.map(mode => [
      escapeLatex(modeLabels[mode]), format(aggregate(this.result, mode, 'durationMs')), format(aggregate(this.result, mode, 'successRate')), format(aggregateTokens(this.result, mode), 0), format(aggregate(this.result, mode, 'aiCost'), 6), format(aggregate(this.result, mode, 'conflictCount')), format(aggregate(this.result, mode, 'escalationCount')), format(aggregate(this.result, mode, 'circuitBreakerTrips')),
    ].join(' & ') + ' \\\\');
    return table('Comparison of five experimental modes.', 'tab:mode-comparison', 'lrrrrrrr', ['Mode & Mean Duration (ms) & Success Rate (\%) & Token Consumption & AI Cost (\$) & Conflicts & Escalations & Circuit Breakers \\\\', '\\midrule', ...rows]);
  }

  hypothesisTable(): string {
    const rows = compareHypotheses(this.result).map(row => `${escapeLatex(row.comparison)} & ${format(row.pValue, 4)} & ${format(row.effectSize, 3)} & [${format(row.confidenceInterval[0])}, ${format(row.confidenceInterval[1])}] \\\\`);
    return table('Approximate hypothesis significance against the deterministic baseline.', 'tab:hypothesis-significance', '{lrrr}', ['Comparison & $p$-value & Effect size & 95\% CI (percentage points) \\\\', '\\midrule', ...rows]);
  }

  macroTable(): string {
    const rows = EXPERIMENT_MODES.map(mode => {
      const runs = rowsByMode(this.result, mode).filter(run => run.category === 'ENTERPRISE_SAGA_MACRO' || run.category === 'MULTI_WAY_CONFLICT');
      const throughput = mean(runs.map(run => run.throughput));
      const success = mean(runs.map(run => run.successRate));
      const rollback = mean(runs.map(run => run.circuitBreakerTrips > 0 ? 100 : 0));
      return `${escapeLatex(modeLabels[mode])} & ${format(throughput)} & ${format(success)} & ${format(rollback)} \\\\`;
    });
    return table('Macro enterprise saga performance.', 'tab:macro-saga-performance', '{lrrr}', ['Mode & Throughput (orders/s) & Saga Step Success (\%) & Compensation Rollback Rate (\%) \\\\', '\\midrule', ...rows]);
  }

  export(): string { return [this.comparisonTable(), '', this.hypothesisTable(), '', this.macroTable()].join('\n'); }
}

export function exportLatexTables(result: BenchmarkResult): string { return new LatexExporter(result).export(); }
