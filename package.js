Package.describe({
  name: 'method',
  summary: 'A simple wrapper for Meteor.methods',
  version: '0.1.0',
  documentation: 'README.md',
});

Package.onUse(function (api) {
  api.versionsFrom('1.2.1');

  api.use([
    'ecmascript',
    'check',
    'ddp',
    'underscore',
    'aldeed:simple-schema',
    'validation-error'
  ]);

  api.addFiles('method.js');
  api.export('Method');
});

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'tinytest',
    'method'
  ]);

  api.addFiles('method-tests.js');
});
