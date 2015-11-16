# mdg:method

A simple wrapper package for `Meteor.methods` with many benefits. The need for such a package came
when the Meteor Guide was being written and we realized there was a lot of best-practices
boilerplate around methods that could be easily abstracted away. Here are some of the advantages of
declaring methods using this package:

1. Have an object that represents your method. Refer to it through JavaScript scope rather than
by a magic string name
2. Built-in validation of arguments through `aldeed:simple-schema`
3. Use the schema to generate a form to call your method in one line of code using `aldeed:autoform`
4. Easily call your method in tests, passing in any user ID you want
5. Throw errors from the client-side method simulation to prevent execution of the server-side
method
6. Get the return value of the stub by default, to take advantage of consistent ID generation

Todos:

1. Allow passing options
2. Add mixin support for simple:rest and similar

### Defining a method

#### new Method({ name, schema, run })

Code pulled from the Todos example app:

```js
// Attach your method to a namespace
Lists.methods.makePrivate = new Method({
  // The name of the method, sent over the wire. Same as the key provided
  // when calling Meteor.methods
  name: 'Lists.methods.makePrivate',

  // Schema for the arguments. Only keyword arguments are accepted, so the
  // arguments are an object rather than an array
  schema: new SimpleSchema({
    listId: { type: String }
  }),

  // This is the body of the method. Use ES2015 object destructuring to get
  // the keyword arguments
  run({ listId }) {
    // `this` is the same method invocation object you normally get inside
    // Meteor.methods
    if (!this.userId) {
      // Throw errors with a specific error code
      throw new Meteor.Error('Lists.methods.makePrivate.notLoggedIn',
        'Must be logged in to make private lists.');
    }

    const list = Lists.findOne(listId);

    if (list.isLastPublicList()) {
      throw new Meteor.Error('Lists.methods.makePrivate.lastPublicList',
        'Cannot make the last public list private.');
    }

    Lists.update(listId, {
      $set: { userId: this.userId }
    });

    Lists.userIdDenormalizer.set(listId, this.userId);
  }
});
```

#### new Method({ name, validate, run })

If `aldeed:simple-schema` doesn't work for your validation needs, just define a custom `validate`
method that throws a `Meteor.ValidationError` instead:

```js
const method = new Method({
  name: 'methodName',

  validate({ myArgument }) {
    const errors = [];

    if (myArgument % 2 !== 0) {
      errors.push({
        name: 'myArgument',
        type: 'not-even',
        details: {
          value: myArgument
        }
      });
    }

    if (errors.length) {
      throw new Meteor.ValidationError(errors);
    }
  }
});
```

### Using a Method

#### method#call(args: Object)

Call a method like so:

```js
Lists.methods.makePrivate.call({
  listId: list._id
}, (err, res) => {
  if (err) {
    handleError(err.error);
  }

  doSomethingWithResult(res);
});
```

The return value of the server-side method is available as the second argument of the method
callback. If your method stub returns a value, you can get it by reading the return value of `call`:

```js
// The return value of the stub is an ID generated on the client
const listId = Lists.methods.insert.call((err) => {
  if (err) {
    // At this point, we have already redirected to the new list page, but
    // for some reason the list didn't get created. This should almost never
    // happen, but it's good to handle it anyway.
    FlowRouter.go('home');
    alert('Could not create list.');
  }
});

FlowRouter.go('listsShow', { _id: listId });
```

#### method#_execute(context: Object, args: Object)

Call this from your test code to simulate calling a method on behalf of a particular user:

```js
it('only makes the list public if you made it private', () => {
  // Set up method arguments and context
  const context = { userId };
  const args = { listId };

  Lists.methods.makePrivate._execute(context, args);

  const otherUserContext = { userId: Random.id() };

  assert.throws(() => {
    Lists.methods.makePublic._execute(otherUserContext, args);
  }, Meteor.Error, /Lists.methods.makePublic.accessDenied/);

  // Make sure things are still private
  assertListAndTodoArePrivate();
});
```
