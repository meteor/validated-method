import { check, Match } from 'meteor/check';

export class ValidatedMethod {
  constructor(options) {
    // Default to no mixins
    options.mixins = options.mixins || [];
    check(options.mixins, [Function]);
    check(options.name, String);
    options = applyMixins(options, options.mixins);

    if(options.connection) {
      // Make sure we have a valid connection object
      if(typeof options.connection !== 'object'
      || !options.connection.methods) throw new Error('Invalid connection type');
    } else {
      // connection argument defaults to Meteor, which is where Methods are defined on client and
      // server
      options.connection = Meteor;
    }

    // Allow validate: null shorthand for methods that take no arguments
    if (options.validate === null) {
      options.validate = function () {};
    }

    // If this is null/undefined, make it an empty object
    options.applyOptions = options.applyOptions || {};

    check(options, Match.ObjectIncluding({
      name: String,
      validate: Function,
      run: Function,
      mixins: [Function],
      applyOptions: Object,
    }));

    // Default options passed to Meteor.apply, can be overridden with applyOptions
    const defaultApplyOptions = {
      // Make it possible to get the ID of an inserted item
      returnStubValue: true,

      // Don't call the server method if the client stub throws an error, so that we don't end
      // up doing validations twice
      throwStubExceptions: true,
    };

    options.applyOptions = {
      ...defaultApplyOptions,
      ...options.applyOptions
    };

    // Attach all options to the ValidatedMethod instance
    Object.assign(this, options);

    const method = this;
    this.connection.methods({
      [options.name](args) {
        // Silence audit-argument-checks since arguments are always checked when using this package
        check(args, Match.Any);
        const methodInvocation = this;

        return method._execute(methodInvocation, args);
      }
    });
  }

  call(args, callback) {
    // Accept calling with just a callback
    if ( typeof args === 'function' ) {
      callback = args;
      args = {};
    }

    try {
      return this.connection.apply(this.name, [args], this.applyOptions, callback);
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

  callAsync(args) {
		//taken from the callAsync method internals which will use applyAsync with a isFromCallAsync param
		//which will flag methods as running on DDP
		//reset current method invocation and mark it as running
		if (Meteor.isClient) {
			DDP._CurrentMethodInvocation._set();
			DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(true);

			return new Promise((resolve, reject) => {
				const clientResultOrThenable = this.connection.applyAsync(
					this.name,
					[args],
					//ensure throwStubExceptions which we need in order
					//to catch client exceptions and re-throw them as promise rejections
					//mimic callAsync through isFromCallAsync
					//merge with this.applyOptions
					Object.assign(this.applyOptions, { throwStubExceptions: true, isFromCallAsync: true }),
					(err, serverResult) => {
						//set the current invocation running to false as soon as server returned its
						//promise so that subsequent methods in .then's of the first method run in their
						//own context instead of thinking they are a stub for the first method
						//MethodOne.call(params)
						//.then(() => MethodTwo.call())
						//.catch(err => log(err));

						DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(false);

						if (err) reject(err);
						resolve(serverResult);
					}
				),
				isThenable = clientResultOrThenable && typeof clientResultOrThenable.then === 'function';

				//catch exceptions on the stub and re-route them to the promise wrapper
				if (isThenable) clientResultOrThenable.catch(err => reject(err));
			});
		}

		//when called from server, just return the promise as returned by the method
		return this.connection.applyAsync(this.name, [args], this.applyOptions);
  }

  _execute(methodInvocation = {}, args) {
    // Add `this.name` to reference the Method name
    methodInvocation.name = this.name;

    const validateResult = this.validate.bind(methodInvocation)(args);

    if (typeof validateResult !== 'undefined') {
      throw new Error(`Returning from validate doesn't do anything; \
perhaps you meant to throw an error?`);
    }

    return this.run.bind(methodInvocation)(args);
  }

  _executeAsync(methodInvocation = {}, args) {
	//Add `this.name` to reference the Method name
	methodInvocation.name = this.name;

	try {
		const validateResult = this.validate.bind(methodInvocation)(args);

		if (typeof validateResult !== 'undefined') {
			throw new Error('Returning from validate doesn\'t do anything; Perhaps you meant to throw an error?');
		}

		return this.run.bind(methodInvocation)(args);
	} catch (err) {
		return Promise.reject(err);
	}
  }
};

// Mixins get a chance to transform the arguments before they are passed to the actual Method
function applyMixins(args, mixins) {
  // Save name of the method here, so we can attach it to potential error messages
  const { name } = args;

  mixins.forEach((mixin) => {
    args = mixin(args);

    if(!Match.test(args, Object)) {
      const functionName = mixin.toString().match(/function\s(\w+)/);
      let msg = 'One of the mixins';

      if(functionName) {
        msg = `The function '${functionName[1]}'`;
      }

      throw new Error(`Error in ${name} method: ${msg} didn't return the options object.`);
    }
  });

  return args;
}
