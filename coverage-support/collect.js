import { Meteor } from 'meteor/meteor';

// Loaded only into the local test package during an instrumented run.
const methodName = '__validatedMethodCoverageReport';
if (Meteor.isServer) {
  const fs = Npm.require('fs');
  const path = Npm.require('path');
  const write = (name, coverage) => {
    if (!coverage || !Object.keys(coverage).length) {
      throw new Error(`Missing ${name} coverage counters`);
    }
    fs.writeFileSync(
      path.join(process.env.VALIDATED_METHOD_COVERAGE, `${name}.json`),
      JSON.stringify(coverage),
    );
  };
  Meteor.methods({
    [methodName](coverage) {
      write('client', coverage);
      // Include server execution caused by client tests, regardless of suite order.
      write('server', globalThis.__validatedMethodCoverage__);
    },
  });
  after(function () {
    write('server', globalThis.__validatedMethodCoverage__);
  });
} else {
  after(async function () {
    this.timeout(10000);
    const coverage = globalThis.__validatedMethodCoverage__;
    // Meteor.callAsync only exists since Meteor 2.8
    await (Meteor.callAsync
      ? Meteor.callAsync(methodName, coverage)
      : new Promise((resolve, reject) => Meteor.call(methodName, coverage,
        (error, result) => (error ? reject(error) : resolve(result)))));
  });
}
