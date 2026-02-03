#!/usr/bin/env node

/**
 * Test Iteration Runner
 * 
 * Runs tests with V8 coverage and iterates until all tests pass
 * with coverage thresholds met.
 */

import { spawn } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const CONFIG = {
  maxIterations: 5,
  coverageThreshold: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80
  }
};

/**
 * Runs Jest with coverage
 * @returns {Promise<{exitCode: number, output: string, coverage: Object|null}>}
 */
function runTests() {
  return new Promise((resolve) => {
    const args = [
      '--experimental-vm-modules',
      'node_modules/jest/bin/jest.js',
      '--coverage',
      '--coverageProvider=v8',
      '--json',
      '--outputFile=coverage/test-results.json'
    ];

    const proc = spawn('node', args, {
      cwd: projectRoot,
      env: { ...process.env, NODE_OPTIONS: '--experimental-vm-modules' }
    });

    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      // Try to read coverage summary
      let coverage = null;
      const coveragePath = join(projectRoot, 'coverage', 'coverage-summary.json');
      if (existsSync(coveragePath)) {
        try {
          coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'));
        } catch (e) {
          // Coverage file not readable
        }
      }

      resolve({
        exitCode: code,
        output: output + errorOutput,
        coverage
      });
    });
  });
}

/**
 * Parses test results from output
 * @param {string} output - Test output
 * @returns {Object} Parsed results
 */
function parseTestResults(output) {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    failures: []
  };

  // Look for test summary
  const summaryMatch = output.match(/Tests:\s+(\d+)\s+passed/);
  if (summaryMatch) {
    results.passed = parseInt(summaryMatch[1], 10);
  }

  const failedMatch = output.match(/(\d+)\s+failed/);
  if (failedMatch) {
    results.failed = parseInt(failedMatch[1], 10);
  }

  const totalMatch = output.match(/(\d+)\s+total/);
  if (totalMatch) {
    results.total = parseInt(totalMatch[1], 10);
  }

  // Extract failure details
  const failureRegex = /✕\s+(.+)/g;
  let match;
  while ((match = failureRegex.exec(output)) !== null) {
    results.failures.push(match[1]);
  }

  return results;
}

/**
 * Checks if coverage meets thresholds
 * @param {Object} coverage - Coverage data
 * @returns {Object} Coverage check result
 */
function checkCoverage(coverage) {
  if (!coverage || !coverage.total) {
    return { met: false, details: 'No coverage data available' };
  }

  const total = coverage.total;
  const results = {
    lines: total.lines?.pct || 0,
    statements: total.statements?.pct || 0,
    functions: total.functions?.pct || 0,
    branches: total.branches?.pct || 0
  };

  const met = 
    results.lines >= CONFIG.coverageThreshold.lines &&
    results.statements >= CONFIG.coverageThreshold.statements &&
    results.functions >= CONFIG.coverageThreshold.functions &&
    results.branches >= CONFIG.coverageThreshold.branches;

  return { met, details: results };
}

/**
 * Prints a formatted report
 * @param {Object} testResults - Test results
 * @param {Object} coverageCheck - Coverage check results
 * @param {number} iteration - Current iteration
 */
function printReport(testResults, coverageCheck, iteration) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ITERATION ${iteration} REPORT`);
  console.log('='.repeat(60));
  
  console.log('\n📊 TEST RESULTS:');
  console.log(`   ✅ Passed: ${testResults.passed}`);
  console.log(`   ❌ Failed: ${testResults.failed}`);
  console.log(`   📝 Total:  ${testResults.total}`);

  if (testResults.failures.length > 0) {
    console.log('\n❌ FAILED TESTS:');
    testResults.failures.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f}`);
    });
  }

  console.log('\n📈 COVERAGE:');
  if (coverageCheck.details && typeof coverageCheck.details === 'object') {
    const { lines, statements, functions, branches } = coverageCheck.details;
    const checkMark = (val, threshold) => val >= threshold ? '✅' : '❌';
    
    console.log(`   ${checkMark(lines, CONFIG.coverageThreshold.lines)} Lines:      ${lines.toFixed(2)}% (threshold: ${CONFIG.coverageThreshold.lines}%)`);
    console.log(`   ${checkMark(statements, CONFIG.coverageThreshold.statements)} Statements: ${statements.toFixed(2)}% (threshold: ${CONFIG.coverageThreshold.statements}%)`);
    console.log(`   ${checkMark(functions, CONFIG.coverageThreshold.functions)} Functions:  ${functions.toFixed(2)}% (threshold: ${CONFIG.coverageThreshold.functions}%)`);
    console.log(`   ${checkMark(branches, CONFIG.coverageThreshold.branches)} Branches:   ${branches.toFixed(2)}% (threshold: ${CONFIG.coverageThreshold.branches}%)`);
  } else {
    console.log(`   ${coverageCheck.details}`);
  }

  console.log('\n' + '='.repeat(60));
}

/**
 * Main iteration loop
 */
async function main() {
  console.log('🚀 P2P LLM Stream - Test Iteration Runner');
  console.log('=========================================\n');
  console.log(`Target Coverage: ${CONFIG.coverageThreshold.lines}%`);
  console.log(`Max Iterations: ${CONFIG.maxIterations}\n`);

  let iteration = 1;
  let allTestsPassed = false;
  let coverageMet = false;

  while (iteration <= CONFIG.maxIterations && (!allTestsPassed || !coverageMet)) {
    console.log(`\n🔄 Running iteration ${iteration}...`);
    
    const { exitCode, output, coverage } = await runTests();
    const testResults = parseTestResults(output);
    const coverageCheck = checkCoverage(coverage);

    allTestsPassed = testResults.failed === 0 && exitCode === 0;
    coverageMet = coverageCheck.met;

    printReport(testResults, coverageCheck, iteration);

    if (allTestsPassed && coverageMet) {
      console.log('\n✨ SUCCESS! All tests pass and coverage thresholds met!\n');
      process.exit(0);
    }

    if (iteration < CONFIG.maxIterations) {
      console.log('\n⏳ Issues detected. Review the output above.');
      console.log('   Fix the failing tests or add more test coverage.');
      console.log('   The next iteration will run automatically...\n');
      
      // In a real scenario, you might want to wait for user input
      // or automatically apply fixes. For now, we'll just report.
    }

    iteration++;
  }

  if (!allTestsPassed || !coverageMet) {
    console.log('\n❌ ITERATION LIMIT REACHED');
    console.log('   Not all issues were resolved within the iteration limit.');
    console.log('   Please review the test output and fix remaining issues manually.\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error running test iteration:', err);
  process.exit(1);
});
