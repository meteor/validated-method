describe('mdg:method', () => {
  it('defines a method that can be called', (done) => {
    const methodName = 'x';//Random.id();

    const method = new Method({
      name: methodName,
      schema: new SimpleSchema({}),
      run() {
        return 'result';
      }
    });

    assert.equal(method.call({}), 'result');
    // Meteor.call(methodName, {}, (result) => {
    //   assert.equal(result, 'result');
    // });
  });
});
