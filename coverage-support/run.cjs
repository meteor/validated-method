const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { createInstrumenter } = require('istanbul-lib-instrument');
const { createCoverageMap } = require('istanbul-lib-coverage');
const { createContext } = require('istanbul-lib-report');
const reports = require('istanbul-reports');

const root = path.resolve(__dirname, '..');
const generated = path.join(root, 'coverage-source');
const raw = path.join(root, '.nyc_output');
const output = path.join(root, 'coverage');
const source = path.join(root, 'validated-method.js');
for (const dir of [generated, raw, output]) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}
const instrumenter = createInstrumenter({
  esModules: true,
  coverageVariable: '__validatedMethodCoverage__',
  coverageGlobalScope: 'globalThis',
  coverageGlobalScopeFunc: false,
});
fs.writeFileSync(path.join(generated, 'validated-method.js'),
  instrumenter.instrumentSync(fs.readFileSync(source, 'utf8'), source));

// test-packages bundles a separate test app and Npm.require ignores NODE_PATH,
// so the browser driver must be an npm dependency of that app. Meteor runs
// `npm install` there when the app already has a package.json.
// puppeteer 19 is the newest line that still runs on Meteor 2.x (Node 14).
const testApp = path.join(root, '.test-app');
fs.mkdirSync(testApp, { recursive: true });
fs.writeFileSync(path.join(testApp, 'package.json'), `${JSON.stringify({
  private: true,
  dependencies: {
    '@babel/runtime': '^7.23.5',
    '@swc/helpers': '^0.5.17',
    'jquery': '^3.7.1',
    'meteor-node-stubs': '^1.2.5',
    'puppeteer': '19.11.1',
  },
}, null, 2)}\n`);

try {
  const result = spawnSync('meteor',
    ['test-packages', '--once', '--driver-package', 'meteortesting:mocha',
      '--test-app-path', testApp, './'], {
      cwd: root,
      stdio: 'inherit',
      // a driver that fails after the server suite leaves `--once` running forever
      timeout: 10 * 60 * 1000,
      killSignal: 'SIGKILL',
      env: { ...process.env, VALIDATED_METHOD_COVERAGE: raw },
    });
  if (result.error) throw result.error;
  const files = fs.readdirSync(raw).filter(file => file.endsWith('.json'));
  if (!files.includes('server.json')) {
    throw new Error('No server coverage collected; the package test harness did not finish.');
  }
  const map = createCoverageMap({});
  for (const file of files) {
    map.merge(JSON.parse(fs.readFileSync(path.join(raw, file), 'utf8')));
  }
  const context = createContext({ dir: output, coverageMap: map });
  for (const reporter of ['text', 'html', 'lcovonly', 'json']) {
    reports.create(reporter).execute(context);
  }
  console.log(`Coverage reports: ${output}`);
  if (!files.includes('client.json')) {
    console.warn('Server-only coverage: no browser coverage was received.');
  }
  process.exitCode = result.status === null ? 1 : result.status;
} finally {
  fs.rmSync(generated, { recursive: true, force: true });
}
