const methodName = 'method';

const method = new Method({
  name: methodName,
  schema: new SimpleSchema({}),
  run() {
    return 'result';
  }
});

describe('mdg:method', () => {
  it('defines a method that can be called', (done) => {
    method.call({}, (error, result) => {
      assert.equal(result, 'result');

      Meteor.call(methodName, {}, (error, result) => {
        assert.equal(result, 'result');
        done();
      });
    });
  });
});
