Package.describe({
  name: 'mdg:method',
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
  ]);

  api.addFiles('method.js');
  api.export('Method');
});

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'practicalmeteor:mocha@2.1.0_5',
    'practicalmeteor:chai@2.1.0_1',
    'aldeed:simple-schema@1.4.0',
    'mdg:method',
    'random'
  ]);

  api.addFiles('method-tests.js');
});
