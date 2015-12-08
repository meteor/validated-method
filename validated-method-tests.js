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

const methodThrowsImmediately = new ValidatedMethod({
  name: 'methodThrowsImmediately',
  validate: null,
  run() {
    throw new Meteor.Error('error');
  }
});

const methodReturnsName = new ValidatedMethod({
  name: 'methodReturnsName',
  validate: null,
  run() {
    return this.name;
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

  it('throws error if no callback passed', (done) => {
    methodThrowsImmediately.call({}, (err) => {
      // If you pass a callback, you get the error in the callback
      assert.ok(err);

      // If no callback, the error is thrown
      assert.throws(() => {
        methodThrowsImmediately.call({});
      }, /error/);

      done();
    });
  });

  it('has access to the name on this.name', (done) => {
    const ret = methodReturnsName._execute();
    assert.equal(ret, 'methodReturnsName');

    methodReturnsName.call({}, (err, res) => {
      // The Method knows its own name
      assert.equal(res, 'methodReturnsName');

      done();
    });
  });
});
