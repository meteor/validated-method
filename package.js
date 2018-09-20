Package.describe({
  name: 'mdg:validated-method',
  summary: 'A simple wrapper for Meteor.methods',
  version: '1.2.0',
  documentation: 'README.md',
});

Package.onUse(function (api) {
  api.versionsFrom('1.7');

  api.use([
    'ecmascript',
    'check',
    'ddp',
  ]);

  api.mainModule('validated-method.js');
  api.export('ValidatedMethod');
});

Package.onTest(function (api) {
  api.use([
    'ecmascript',
    'practicalmeteor:mocha@2.4.5_6',
    'practicalmeteor:chai@2.1.0_1',
    'aldeed:simple-schema@1.5.4',
    'mdg:validated-method',
    'random'
  ]);

  api.mainModule('validated-method-tests.js');
});
