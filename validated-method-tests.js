const plainMethod = new ValidatedMethod({
  name: 'plainMethod',
  validate: new SimpleSchema({}).validator(),
  run() {
    return 'result';
  }
});

const noArgsMethod = new ValidatedMethod({
  name: 'noArgsMethod',
  validate: null,
  run() {
    return 'result';
  }
});

const methodWithArgs = new ValidatedMethod({
  name: 'methodWithArgs',
  validate: new SimpleSchema({
    int: { type: Number },
    string: { type: String },
  }).validator(),
  run() {
    return 'result';
  }
});

describe('mdg:method', () => {
  it('defines a method that can be called', (done) => {
    plainMethod.call({}, (error, result) => {
      assert.equal(result, 'result');

      Meteor.call(plainMethod.name, {}, (error, result) => {
        assert.equal(result, 'result');
        done();
      });
    });
  });

  it('allows methods that take no arguments', (done) => {
    noArgsMethod.call((error, result) => {
      assert.equal(result, 'result');

      Meteor.call(noArgsMethod.name, (error, result) => {
        assert.equal(result, 'result');
        done();
      });
    });
  });

  it('checks schema', (done) => {
    methodWithArgs.call({}, (error, result) => {
      // 2 invalid fields
      assert.equal(error.errors.length, 2);

      methodWithArgs.call({
        int: 5,
        string: "what",
      }, (error, result) => {
        // All good!
        assert.equal(result, 'result');

        done();
      });
    });
  });
});
