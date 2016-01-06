Package.describe({
  name: 'mdg:validated-method',
  summary: 'A simple wrapper for Meteor.methods',
  version: '1.0.0',
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

  api.addFiles('validated-method.js');
  api.export('ValidatedMethod');
});

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'practicalmeteor:mocha@2.1.0_5',
    'practicalmeteor:chai@2.1.0_1',
    'aldeed:simple-schema@1.4.0',
    'mdg:validated-method',
    'random'
  ]);

  api.addFiles('validated-method-tests.js');
});
