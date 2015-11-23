# mdg:method

> Development stage: looking for feedback and ideas before solidifying the initial API

### Define Meteor methods in a structured way

```js
const method = new Method({
  name, // DDP method name
  schema, // SimpleSchema for arguments
  run // method body
});
```

This is a simple wrapper package for `Meteor.methods`. The need for such a package came
when the Meteor Guide was being written and we realized there was a lot of best-practices
boilerplate around methods that could be easily abstracted away. Here are some of the advantages of
declaring methods using this package:

1. Have an object that represents your method. Refer to it through JavaScript scope rather than
by a magic string name
2. Built-in validation of arguments through `aldeed:simple-schema`
4. Easily call your method from tests or server-side code, passing in any user ID you want. No need for [two-tiered methods](https://www.discovermeteor.com/blog/meteor-pattern-two-tiered-methods/) anymore!
5. [Throw errors from the client-side method simulation](#validation-and-throwstubexceptions) to prevent execution of the server-side
method - this means you can do complex client-side validation in the body on the client, and not
waste server-side resources.
6. Get the return value of the stub by default, to take advantage of [consistent ID generation](#id-generation-and-returnstubvalue). This
way you can implement a custom insert method with optimistic UI.

See extensive code samples in the Todos example app below:

1. [Todos](https://github.com/meteor/todos/blob/master/packages/todos/methods.js) and [Lists](https://github.com/meteor/todos/blob/master/packages/lists/methods.js) method definitions
2. [Lists method tests](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/lists/lists-tests.js#L55)
3. Some call sites: [1](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/lists-show/lists-show.js#L19), [2](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/lists-show/lists-show.js#L63), [3](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/todos-main/app-body.js#L108)


### Defining a method

#### new Method({ name, schema, run })

Let's examine a method from the new [Todos example app](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/lists/methods.js#L17) which makes a list private and takes the `listId` as an argument. The method also does permissions checks based on the currently logged-in user. Note this code uses new [ES2015 JavaScript syntax features](http://info.meteor.com/blog/es2015-get-started).

```js
// Attach your method to a namespace
Lists.methods.makePrivate = new Method({
  // The name of the method, sent over the wire. Same as the key provided
  // when calling Meteor.methods
  name: 'Lists.methods.makePrivate',

  // Schema for the arguments. Only keyword arguments are accepted, so the
  // arguments are an object rather than an array. Method throws a
  // ValidationError from the mdg:validation-error package if the args don't
  // match the schema
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
method that throws a [`Meteor.ValidationError`](https://github.com/meteor/validation-error) instead:

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
callback.

#### method#\_execute(context: Object, args: Object)

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

### Ideas

- With a little bit of work, this package could be improved to allow easily generating a form from a method, based on the arguments it takes. We just need a way of specifying some of the arguments programmatically - for example, if you want to make a form to add a comment to a post, you need to pass the post ID somehow - you don't want to just have a text field called "Post ID".

### Discussion and in-depth info

#### Validation and throwStubExceptions

By default, using `Meteor.call` to call a Meteor method invokes the client-side simulation and the server-side implementation. If the simulation fails or throws an error, the server-side implementation happens anyway. However, we believe that it is likely that an error in the simulation is a good indicator that an error will happen on the server as well. For example, if there is a validation error in the arguments, or the user doesn't have adequate permissions to call that method, it's often easy to identify that ahead of time on the client.

If you already know the method will fail, why call it on the server at all? That's why this package turns on a [hidden option](https://forums.meteor.com/t/exception-handling-best-practices/4301) to `Meteor.apply` called `throwStubExceptions`.

With this option enabled, an error thrown by the client simulation will stop the server-side method from being called at all.

Watch out - while this behavior is good for conserving server resources in the case where you know the call will fail, you need to make sure the simulation doesn't throw errors in the case where the server call would have succeeded. This means that if you have some permission logic that relies on data only available on the server, you should wrap it in an `if (!this.isSimulation) { ... }` statement.

#### ID generation and returnStubValue

One big benefit of the built-in client-side `Collection#insert` call is that you can get the ID of
the newly inserted document on the client right away. This is sometimes listed as a benefit of
using allow/deny over custom defined methods. Not anymore!

For a while now, Meteor has had a [hard-to-find](https://forums.meteor.com/t/how-to-return-value-on-meteor-call-in-client/1277/9) option to `Meteor.apply` called `returnStubValue`. This lets you return a value from a client-side simulation, and use that value immediately on the client. Also, Meteor goes to great lengths to make sure that ID generation on the client and server is consistent. Now, it's easy to take advantage of this feature since this package enables `returnStubValue` by default.

Here's an example of how you could implement a custom insert method, taken from the [Todos example app](https://github.com/meteor/todos/blob/master/packages/lists/methods.js) we are working on for the Meteor Guide:

```js
Lists.methods.insert = new Method({
  name: 'Lists.methods.insert',
  schema: new SimpleSchema({}),
  run() {
    return Lists.insert({});
  }
});
```

You can get the ID generated by `insert` by reading the return value of `call`:

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

### Running tests

```
meteor test-packages --driver-package practicalmeteor:mocha ./
```
