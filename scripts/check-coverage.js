/**
 * CI coverage gate — fails if coverage drops below configured thresholds.
 * Reads jest json-summary output from coverage/coverage-summary.json
 */
const fs = require('fs');
const path = require('path');

const THRESHOLDS = {
  lines: 17,
  statements: 17,
  functions: 10,
  branches: 7,
};

const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');

if (!fs.existsSync(summaryPath)) {
  console.error('Coverage summary not found. Run tests with --coverage first.');
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const total = summary.total;

let failed = false;

for (const [metric, min] of Object.entries(THRESHOLDS)) {
  const pct = total[metric]?.pct ?? 0;
  if (pct < min) {
    console.error(`Coverage gate failed: ${metric} ${pct}% < ${min}%`);
    failed = true;
  } else {
    console.log(`Coverage OK: ${metric} ${pct}% >= ${min}%`);
  }
}

process.exit(failed ? 1 : 0);
