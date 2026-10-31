Package.describe({
  name: 'mdg:validated-method',
  summary: 'A simple wrapper for Meteor.methods',
  version: '1.3.0',
  documentation: 'README.md',
});

Package.onUse(function (api) {
  api.versionsFrom(['2.3', '3.0']);

  api.use([
    'ecmascript',
    'check',
    'ddp',
  ]);

  api.mainModule(process.env.VALIDATED_METHOD_COVERAGE
    ? 'coverage-source/validated-method.js'
    : 'validated-method.js');
  api.export('ValidatedMethod');
});

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'meteortesting:mocha@2.0.0 || 3.0.0',
    'aldeed:simple-schema@2.0.0 || 3.0.0', // modern support
    'mdg:validated-method',
    'random'
  ]);

  if (process.env.VALIDATED_METHOD_COVERAGE) {
    api.addFiles('coverage-support/collect.js');
  }
  api.mainModule('validated-method-tests.js');
});
