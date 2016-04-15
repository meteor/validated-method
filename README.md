# mdg:validated-method

### Define Meteor methods in a structured way, with mixins

```js
// Method definition
const method = new ValidatedMethod({
  name, // DDP method name
  mixins, // Method extensions
  validate, // argument validation
  applyOptions, // options passed to Meteor.apply
  run // Method body
});

// Method call
method.call({ arg1, arg2 });
```

This is a simple wrapper package for `Meteor.methods`. The need for such a package came
when the Meteor Guide was being written and we realized there was a lot of best-practices
boilerplate around methods that could be easily abstracted away.

### Benefits of ValidatedMethod

1. Have an object that represents your method. Refer to it through JavaScript scope rather than
by a magic string name.
1. Built-in validation of arguments through `aldeed:simple-schema`, or roll your own argument validation.
1. Easily call your method from tests or server-side code, passing in any user ID you want. No need for [two-tiered methods](https://www.discovermeteor.com/blog/meteor-pattern-two-tiered-methods/) anymore!
1. [Throw errors from the client-side method simulation](#validation-and-throwstubexceptions) to prevent execution of the server-side
method - this means you can do complex client-side validation in the body on the client, and not
waste server-side resources.
1. Get the return value of the stub by default, to take advantage of [consistent ID generation](#id-generation-and-returnstubvalue). This
way you can implement a custom insert method with optimistic UI.
1. Install Method extensions via mixins.

See extensive code samples in the [Todos example app](https://github.com/meteor/todos).

### Defining a method

#### Using SimpleSchema

Let's examine a method from the new [Todos example app](https://github.com/meteor/todos/blob/b890fc2ac8846051031370035421893fa4145b86/packages/lists/methods.js#L17) which makes a list private and takes the `listId` as an argument. The method also does permissions checks based on the currently logged-in user. Note this code uses new [ES2015 JavaScript syntax features](http://info.meteor.com/blog/es2015-get-started).

```js
// Attach your method to a namespace
Lists.methods.makePrivate = new ValidatedMethod({
  // The name of the method, sent over the wire. Same as the key provided
  // when calling Meteor.methods
  name: 'Lists.methods.makePrivate',

  // Validation function for the arguments. Only keyword arguments are accepted,
  // so the arguments are an object rather than an array. The SimpleSchema validator
  // throws a ValidationError from the mdg:validation-error package if the args don't
  // match the schema
  validate: new SimpleSchema({
    listId: { type: String }
  }).validator(),

  // This is optional, but you can use this to pass options into Meteor.apply every
  // time this method is called.  This can be used, for instance, to ask meteor not
  // to retry this method if it fails.
  applyOptions: {
    noRetry: true,
  },

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

The `validator` function called in the example requires SimpleSchema version 1.4+.

#### Using your own argument validation function

If `aldeed:simple-schema` doesn't work for your validation needs, just define a custom `validate`
method that throws a [`ValidationError`](https://github.com/meteor/validation-error) instead:

```js
const method = new ValidatedMethod({
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
      throw new ValidationError(errors);
    }
  },

  ...
});
```

#### Using `check` to validate arguments

You can use `check` in your validate function if you don't want to pass `ValidationError` objects to the client, like so:

```js
const method = new ValidatedMethod({
  name: 'methodName',

  validate(args) {
    check(args, {
      myArgument: String
    });
  },

  ...
});
```

#### Skipping argument validation

If your method does not need argument validation, perhaps because it does not take any arguments, you can use `validate: null` to skip argument validation.

#### Defining a method on a non-default connection

You can define a method on a non-default DDP connection by passing an extra `connection` option to the constructor.

#### Options to Meteor.apply

The validated method, when called, executes itself via `Meteor.apply`.  The `apply` method also takes a few [options](http://docs.meteor.com/#/full/meteor_apply) which can be used to alter the way Meteor handles the method.  If you want to use those options you can supply them to the validated method when it is created, using the `applyOptions` member.  Pass it an object that will be used with `Meteor.apply`.

#### Secret server code

If you want to keep some of your method code secret on the server, check out [Served Files](http://guide.meteor.com/security.html#served-files) from the Meteor Guide.

### Using a ValidatedMethod

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

### Mixins

Every `ValidatedMethod` can optionally take an array of _mixins_. A mixin is simply a function that takes the options argument from the constructor, and returns a new object of options. For example, a mixin that enables a `schema` property and fills in `validate` for you would look like this:

```js
function schemaMixin(methodOptions) {
  methodOptions.validate = methodOptions.schema.validator();
  return methodOptions;
}
```

Then, you could use it like this:

```js
const methodWithSchemaMixin = new ValidatedMethod({
  name: 'methodWithSchemaMixin',
  mixins: [schemaMixin],
  schema: new SimpleSchema({
    int: { type: Number },
    string: { type: String },
  }),
  run() {
    return 'result';
  }
});
```

### Community mixins

If you write a helpful `ValidatedMethod` mixin, please file an issue so that it can be listed here!.

- [tunifight:loggedin-mixin](https://atmospherejs.com/tunifight/loggedin-mixin) : Simple mixin to check if the user is logged in before calling the `run` function.
- [didericis:permissions-mixin](https://atmospherejs.com/didericis/permissions-mixin) : A permissions mixin to use with mdg:validated-method package.
- [didericis:callpromise-mixin](https://atmospherejs.com/didericis/callpromise-mixin) : A mixin for the mdg:validated-method package that adds `callPromise`.
- [lacosta:method-hooks](https://atmospherejs.com/lacosta/method-hooks) : A mixin that adds before and after hooks

- [ziarno:restrict-mixin](https://atmospherejs.com/ziarno/restrict-mixin) : A mixin to throw errors if condition pass

- [ziarno:provide-mixin](https://atmospherejs.com/ziarno/provide-mixin) : A mixin to add arguments to the run function


### Ideas

- It could be nice to have a `SimpleSchemaMethod` which just lets you specify a `schema` option rather than having to pass a `validator` function into the `validate` option. This would enable the below.
- With a little bit of work, this package could be improved to allow easily generating a form from a method, based on the schema of the arguments it takes. We just need a way of specifying some of the arguments programmatically - for example, if you want to make a form to add a comment to a post, you need to pass the post ID somehow - you don't want to just have a text field called "Post ID".

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
Lists.methods.insert = new ValidatedMethod({
  name: 'Lists.methods.insert',
  validate: new SimpleSchema({}).validator(),
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
