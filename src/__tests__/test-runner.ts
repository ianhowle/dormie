// =============================================================
// Tiny test runner — shared across the wizard stress-test suite
// =============================================================
// No Jest in this project. Existing tests under src/data/__tests__
// and src/services/__tests__ run as ts-node scripts using inline
// describe/it/expect helpers; this module factors that pattern out
// so all wizard tests share the same harness.
//
// Run a single file:
//   ts-node --skip-project --compiler-options \
//     '{"module":"commonjs","target":"es2020","esModuleInterop":true,"moduleResolution":"node"}' \
//     <path-to-test-file>
//
// process.exit() codes: 0 on full pass, 1 on any failure.
// =============================================================

interface RunnerState {
  passed: number;
  failed: number;
  failures: string[];
  results: Array<{
    suite: string;
    name: string;
    pass: boolean;
    error?: string;
  }>;
  currentSuite: string;
}

const state: RunnerState = {
  passed: 0,
  failed: 0,
  failures: [],
  results: [],
  currentSuite: '',
};

export function describe(name: string, fn: () => void): void {
  state.currentSuite = name;
  fn();
  state.currentSuite = '';
}

export function it(name: string, fn: () => void): void {
  const suite = state.currentSuite;
  try {
    fn();
    state.passed += 1;
    state.results.push({ suite, name, pass: true });
  } catch (err) {
    state.failed += 1;
    const msg = err instanceof Error ? err.message : String(err);
    state.failures.push(`✗ ${suite} > ${name}: ${msg}`);
    state.results.push({ suite, name, pass: false, error: msg });
  }
}

export function expect<T>(actual: T) {
  return {
    toBe(expected: T) {
      if (actual !== expected) {
        throw new Error(
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },
    toEqual(expected: T) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
        );
      }
    },
    toBeTruthy() {
      if (!actual) throw new Error(`Expected truthy, got ${JSON.stringify(actual)}`);
    },
    toBeFalsy() {
      if (actual) throw new Error(`Expected falsy, got ${JSON.stringify(actual)}`);
    },
    toBeNull() {
      if (actual !== null) throw new Error(`Expected null, got ${JSON.stringify(actual)}`);
    },
    toBeUndefined() {
      if (actual !== undefined)
        throw new Error(`Expected undefined, got ${JSON.stringify(actual)}`);
    },
    toContain(substr: string) {
      if (typeof actual !== 'string' || !actual.includes(substr)) {
        throw new Error(
          `Expected string to contain "${substr}", got ${JSON.stringify(actual)}`,
        );
      }
    },
    toMatch(re: RegExp) {
      if (typeof actual !== 'string' || !re.test(actual)) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} to match ${re}`,
        );
      }
    },
    toBeGreaterThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual < n) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} >= ${n}`,
        );
      }
    },
    toBeLessThanOrEqual(n: number) {
      if (typeof actual !== 'number' || actual > n) {
        throw new Error(
          `Expected ${JSON.stringify(actual)} <= ${n}`,
        );
      }
    },
  };
}

export function summary(label: string): void {
  /* eslint-disable no-console */
  console.log(`\n=== ${label} ===`);
  console.log(`  Results: ${state.passed} passed, ${state.failed} failed`);
  if (state.failures.length > 0) {
    console.log('\n  Failures:');
    for (const f of state.failures) console.log(`    ${f}`);
  }
  console.log('');
  /* eslint-enable no-console */
}

export function exitWithStatus(): never {
  process.exit(state.failed > 0 ? 1 : 0);
}

export function getCounts(): { passed: number; failed: number } {
  return { passed: state.passed, failed: state.failed };
}

export function resetRunner(): void {
  state.passed = 0;
  state.failed = 0;
  state.failures = [];
  state.results = [];
  state.currentSuite = '';
}
