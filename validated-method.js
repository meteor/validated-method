/* global ValidatedMethod:true */

ValidatedMethod = class ValidatedMethod {
  constructor({
    name,
    validate,
    run,
    connection = Meteor
  }) {
    check(name, String);
    check(run, Function);

    // Allow validate: null shorthand for methods that take no arguments
    if (validate === null) validate = function () {};

    check(validate, Function);

    _.extend(this, {
      name,
      validate,
      run,
      connection
    });

    const method = this;
    this.connection.methods({
      [name](args) {
        // Silence audit-argument-checks since arguments are always checked when using this package
        check(args, Match.Any);
        const methodInvocation = this;

        return method._execute(methodInvocation, args);
      }
    });
  }

  call(args, callback) {
    // Accept calling with just a callback
    if (_.isFunction(args)) {
      callback = args;
      args = {};
    }

    const options = {
      // Make it possible to get the ID of an inserted item
      returnStubValue: true,

      // Don't call the server method if the client stub throws an error, so that we don't end
      // up doing validations twice
      // XXX needs option to disable, in cases where the client might have incomplete information to
      // make a decision
      throwStubExceptions: true
    };

    try {
      return this.connection.apply(this.name, [args], options, callback);
    } catch (err) {
      if (callback) {
        // Get errors from the stub in the same way as from the server-side method
        callback(err);
      } else {
        // No callback passed, throw instead of silently failing; this is what
        // "normal" Methods do if you don't pass a callback.
        throw err;
      }
    }
  }

  _execute(methodInvocation, args) {
    methodInvocation = methodInvocation || {};

    // Add `this.name` to reference the Method name
    methodInvocation.name = this.name;

    const validateResult = this.validate.bind(methodInvocation)(args);

    if (typeof validateResult !== 'undefined') {
      throw new Error(`Returning from validate doesn't do anything; \
perhaps you meant to throw an error?`);
    }

    return this.run.bind(methodInvocation)(args);
  }
};
