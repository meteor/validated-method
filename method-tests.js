const plainMethod = new Method({
  name: 'plainMethod',
  schema: new SimpleSchema({}),
  run() {
    return 'result';
  }
});

const methodWithArgs = new Method({
  name: 'methodWithArgs',
  schema: new SimpleSchema({
    int: { type: Number },
    string: { type: String },
  }),
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

  it('checks schema', (done) => {
    methodWithArgs.call({}, (error, result) => {
      // Never runs
      console.log(error, result);
      assert.equal(result, 'result');

      Meteor.call(methodWithArgs.name, {}, (error, result) => {
        assert.equal(result, 'result');
        done();
      });
    });
  });
});
