export * from './generators/scenario-generator.js';
export * from './runner/benchmark-runner.js';
export * from './analyzers/statistical-analyzer.js';
export * from './exporters/report-exporter.js';
export * from './exporters/latex-exporter.js';
export * from './exporters/thesis-chapter-exporter.js';

import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateScenarios } from './generators/scenario-generator.js';
import { runBenchmark } from './runner/benchmark-runner.js';
import { exportCsv, exportJson } from './exporters/report-exporter.js';
import { exportThesisArtifacts } from './exporters/thesis-chapter-exporter.js';

export async function writeThesisArtifacts(result: ReturnType<typeof runBenchmark>, directory = resolve(process.cwd(), 'reports')): Promise<void> {
  const artifacts = exportThesisArtifacts(result);
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(resolve(directory, 'thesis-tables.tex'), artifacts.latex, 'utf8'),
    writeFile(resolve(directory, 'thesis-evaluation-chapter.md'), artifacts.markdown, 'utf8'),
  ]);
}

if (process.argv[1]?.endsWith('index.ts')) {
  const result = runBenchmark(generateScenarios(3));
  writeThesisArtifacts(result).then(() => process.stdout.write(`${exportCsv(result)}\n\n${exportJson(result)}\n`));
}
