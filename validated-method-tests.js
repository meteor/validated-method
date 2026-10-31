import { Meteor } from 'meteor/meteor';
import { ValidatedMethod } from 'meteor/mdg:validated-method';
import SimpleSchema from 'simpl-schema';
import AsyncSimpleSchema from 'meteor/aldeed:simple-schema';
import { assert } from 'chai';

// 2.x releases < 2.8 do not support async methods
const supportsAsyncMethods =
    typeof Meteor.callAsync === 'function' &&
    typeof Meteor.applyAsync === 'function';

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

let resultReceived = false;
const methodWithApplyOptions = new ValidatedMethod({
  name: 'methodWithApplyOptions',
  validate: new SimpleSchema({}).validator(),
  applyOptions: {
    onResultReceived: function() {
      resultReceived = true;
    }
  },
  run() {
    return 'result';
  }
});

const asyncMethod = new ValidatedMethod({
  name: 'asyncMethod',
  validate: new SimpleSchema({
    param: { type: Number },
  }).validator(),
  async run({ param }) {
    return new Promise(resolve => {
		setTimeout(() => {
			resolve(['result', 'result2', param]);
		}, 1000);
	})
		.then(result => {
			return result.join(',');
		});
  }
});

// setTimeout cannot be used in async method stubs so
// we create one that uses no timeout
const asyncMethodNoTimeout = new ValidatedMethod({
  name: 'asyncMethodNoTimeout',
  validate: new SimpleSchema({
    param: { type: Number },
  }).validator(),
  async run({ param }) {
    return new Promise(resolve => {
      resolve(['result', 'result2', param]);
    })
        .then(result => {
          return result.join(',');
        });
  }
});

const assertThrows = async ({ fn, message }) => {
  try {
    await fn();
    assert.fail('Should have thrown');
  } catch (e) {
    if (message) {
      assert.match(e.message, new RegExp(message));
    }
  }
}

function schemaMixin(methodOptions) {
  methodOptions.validate = methodOptions.schema.validator();
  return methodOptions;
}

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

  if (supportsAsyncMethods) {
    it('allows methods to be called asynchronously', async () => {
      const result = await asyncMethodNoTimeout.callAsync({ param: 3000 });
      assert.equal(result, 'result,result2,3000');
    });
  }

  it('rejects callAsync when the Meteor release has no async methods', () => {
    // 2.x < 2.8 lacks these already; on newer releases remove them temporarily
    const { callAsync, applyAsync } = Meteor;
    Meteor.callAsync = undefined;
    Meteor.applyAsync = undefined;
    try {
      assert.throws(() => {
        asyncMethodNoTimeout.callAsync({ param: 1 });
      }, 'Async methods are not supported in this version of Meteor');
    } finally {
      Meteor.callAsync = callAsync;
      Meteor.applyAsync = applyAsync;
    }
  });


  [methodWithArgs, methodWithSchemaMixin].forEach((method) => {
    it('checks schema ' + method.name, async () => {
      const error = await new Promise(resolve => {
        method.call({}, error => resolve(error));
      });
      // 2 invalid fields
      assert.equal(error.details.length, 2);

      const result = await new Promise((resolve, reject) => {
        method.call({
          int: 5,
          string: "what",
        }, (error, result) => {
          if (error) return reject(error);
          resolve(result);
        });
      });
      // All good!
      assert.equal(result, 'result');
    });
  });

  it('passes errors to callbacks', async () => {
    const error = await new Promise(resolve => {
      methodThrowsImmediately.call({}, error => resolve(error));
    });
    assert.instanceOf(error, Meteor.Error);
    assert.equal(error.error, 'error');
  });

  it('propagates errors if no callback is passed', async () => {
    if (Meteor.isServer) {
      // Meteor 3 server calls reject their returned promise, while
      // Fibers-based 2.x server calls throw synchronously.
      await (async () => methodThrowsImmediately.call({}))().then(
        () => assert.fail('Expected the method call to reject'),
        error => {
          assert.instanceOf(error, Meteor.Error);
          assert.equal(error.error, 'error');
        }
      );
    } else {
      // Client stub errors still throw synchronously.
      assert.throws(() => {
        methodThrowsImmediately.call({});
      }, /error/);
    }
  });

  it('throws error if a mixin does not return the options object', () => {
    assert.throws(() => {
      new ValidatedMethod({
        name: 'methodWithFaultySchemaMixin',
        mixins: [function nonReturningFunction() {}],
        schema: null,
        run() {
          return 'result';
        }
      });
    }, /Error in methodWithFaultySchemaMixin method: The function 'nonReturningFunction' didn't return the options object/);

    assert.throws(() => {
      new ValidatedMethod({
        name: 'methodWithFaultySchemaMixin',
        mixins: [args => args, function () {}],
        schema: null,
        run() {
          return 'result';
        }
      });
    }, /Error in methodWithFaultySchemaMixin method: One of the mixins didn't return the options object/);
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

  it('can accept Meteor.apply options', (done) => {
    if (Meteor.isServer) {
      // the only apply option that I can think of to test is client side only
      return done();
    }

    resultReceived = false;
    methodWithApplyOptions.call({}, (err, res) => {
      // The Method knows its own name
      assert.equal(resultReceived, true);

      done();
    });
  });
});

if (Meteor.isServer) {
  describe('ValidatedMethod server contracts', () => {
    function fixture(overrides = {}) {
      const registrations = [];
      const connection = {
        methods(methods) { registrations.push(methods); },
      };
      const options = {
        name: 'serverContract',
        validate: null,
        run() { return 'result'; },
        connection,
        ...overrides,
      };
      return { options, connection, registrations };
    }

    async function rejectsWith(promise, expected) {
      await promise.then(
        () => assert.fail('Expected rejection'),
        error => assert.strictEqual(error, expected)
      );
    }

    it('registers once on a custom connection and preserves invocation context', () => {
      const args = { value: 42 };
      const context = { userId: 'user', name: 'oldName' };
      const result = {};
      const calls = [];
      const f = fixture({
        validate(received) {
          assert.strictEqual(this, context);
          assert.strictEqual(received, args);
          assert.equal(this.name, 'serverContract');
          assert.equal(this.userId, 'user');
          calls.push('validate');
        },
        run(received) {
          assert.strictEqual(this, context);
          assert.strictEqual(received, args);
          assert.equal(this.name, 'serverContract');
          assert.equal(this.userId, 'user');
          calls.push('run');
          return result;
        },
      });
      new ValidatedMethod(f.options);
      assert.lengthOf(f.registrations, 1);
      assert.deepEqual(Object.keys(f.registrations[0]), ['serverContract']);
      assert.strictEqual(f.registrations[0].serverContract.call(context, args), result);
      assert.deepEqual(calls, ['validate', 'run']);
    });

    for (const [label, connection] of [
      ['primitive', true], ['function', function () {}], ['missing methods', {}],
    ]) {
      it('rejects an invalid connection: ' + label, () => {
        const f = fixture({ connection });
        assert.throws(() => new ValidatedMethod(f.options), /Invalid connection type/);
        assert.isEmpty(f.registrations);
      });
    }

    for (const [label, applyOptions, expected] of [
      ['defaults', undefined, { returnStubValue: true, throwStubExceptions: true }],
      ['overrides', { returnStubValue: false, throwStubExceptions: false, wait: true },
        { returnStubValue: false, throwStubExceptions: false, wait: true }],
    ]) {
      it('forwards call arguments, callback, result and option ' + label, () => {
        const f = fixture({ applyOptions });
        const args = { value: 1 };
        const callback = () => {};
        const result = {};
        let captured;
        f.connection.apply = function (...received) {
          assert.strictEqual(this, f.connection);
          captured = received;
          return result;
        };
        const method = new ValidatedMethod(f.options);
        assert.strictEqual(method.call(args, callback), result);
        assert.deepEqual(captured, [method.name, [args], expected, callback]);
        assert.strictEqual(captured[1][0], args);
        assert.strictEqual(captured[2], method.applyOptions);
        assert.strictEqual(captured[3], callback);
      });
    }

    it('forwards callback-only calls with an empty argument object', () => {
      const f = fixture();
      const callback = () => {};
      let captured;
      f.connection.apply = (...args) => { captured = args; };
      const method = new ValidatedMethod(f.options);
      method.call(callback);
      assert.deepEqual(captured, [method.name, [{}], method.applyOptions, callback]);
    });

    it('delivers a synchronous transport error to the callback exactly once', () => {
      const f = fixture();
      const error = new Error('transport');
      f.connection.apply = () => { throw error; };
      const method = new ValidatedMethod(f.options);
      const received = [];
      assert.doesNotThrow(() => method.call({}, err => received.push(err)));
      assert.lengthOf(received, 1);
      assert.strictEqual(received[0], error);
    });

    it('rethrows the identical synchronous transport error without a callback', () => {
      const f = fixture();
      const error = new Error('transport');
      f.connection.apply = () => { throw error; };
      const method = new ValidatedMethod(f.options);
      assert.strictEqual(assert.throws(() => method.call({})), error);
    });

    for (const [label, value] of [
      ['false', false], ['null', null], ['zero', 0], ['object', {}],
      ['promise', Promise.resolve('fail')],
    ]) {
      it('rejects a validator returning ' + label + ' before running', async () => {
        let runs = 0;
        const f = fixture({ validate() { return value; }, run() { runs++; } });
        const method = new ValidatedMethod(f.options);
        await assertThrows({
          fn: () => method._execute({}, {}),
          message: /Returning from validate/
        })
        assert.equal(runs, 0);
      });
    }

    it('preserves a validation exception and does not run', () => {
      const error = new Error('validation');
      let runs = 0;
      const f = fixture({ validate() { throw error; }, run() { runs++; } });
      const method = new ValidatedMethod(f.options);
      assert.strictEqual(assert.throws(() => method._execute({}, {})), error);
      assert.equal(runs, 0);
    });

    for (const [label, result] of [['value', {}], ['promise', Promise.resolve('result')]]) {
      it('returns the identical run ' + label + ' after undefined validation', async () => {
        const calls = [];
        const f = fixture({
          validate() { calls.push('validate'); },
          run() { calls.push('run'); return result; },
        });
        const method = new ValidatedMethod(f.options);
        const actual = method._execute();
        assert.strictEqual(actual, result);
        assert.deepEqual(calls, ['validate', 'run']);
        await actual;
      });
    }

    for (const [label, overrides] of [
      ['missing name', { name: undefined }], ['invalid name', { name: 5 }],
      ['non-array mixins', { mixins: {} }], ['non-function mixin', { mixins: [1] }],
      ['missing validate', { validate: undefined }], ['invalid validate', { validate: true }],
      ['missing run', { run: undefined }], ['invalid run', { run: true }],
      ['invalid applyOptions', { applyOptions: true }],
    ]) {
      it('rejects ' + label + ' before registration', () => {
        const f = fixture(overrides);
        const error = assert.throws(() => new ValidatedMethod(f.options));
        assert.equal(error.errorType, 'Match.Error');
        assert.isEmpty(f.registrations);
      });
    }

    it('accepts validate: null and executes the registered method', () => {
      const f = fixture();
      new ValidatedMethod(f.options);
      assert.lengthOf(f.registrations, 1);
      assert.equal(f.registrations[0].serverContract.call({}), 'result');
    });

    it('passes replacement options through mixins in order', () => {
      const calls = [];
      let replacement;
      const custom = {};
      const f = fixture({
        custom,
        mixins: [
          options => {
            calls.push('first');
            replacement = { ...options, name: 'transformedContract' };
            return replacement;
          },
          options => {
            calls.push('second');
            assert.strictEqual(options, replacement);
            options.validate = function () { calls.push('validate'); };
            options.run = function () { calls.push('run'); return this.custom; };
            return options;
          },
        ],
      });
      const method = new ValidatedMethod(f.options);
      assert.strictEqual(method.custom, custom);
      assert.deepEqual(Object.keys(f.registrations[0]), ['transformedContract']);
      assert.strictEqual(method._execute({ custom }), custom);
      assert.deepEqual(calls, ['first', 'second', 'validate', 'run']);
    });

    it('stops mixin processing and registration after an invalid return', () => {
      let laterCalls = 0;
      const f = fixture({ mixins: [
        () => {},
        options => { laterCalls++; return options; },
      ] });
      assert.throws(() => new ValidatedMethod(f.options), /didn't return the options object/);
      assert.equal(laterCalls, 0);
      assert.isEmpty(f.registrations);
    });

    for (const field of ['validate', 'run']) {
      it('validates ' + field + ' after mixin transformation', () => {
        const f = fixture({ mixins: [options => ({ ...options, [field]: true })] });
        const error = assert.throws(() => new ValidatedMethod(f.options));
        assert.equal(error.errorType, 'Match.Error');
        assert.isEmpty(f.registrations);
      });
    }

    for (const rejects of supportsAsyncMethods ? [false, true] : []) {
      it('forwards server callAsync and preserves its ' + (rejects ? 'rejected' : 'resolved') + ' promise', async () => {
        const f = fixture({ applyOptions: { wait: true } });
        const args = { value: 1 };
        const value = rejects ? new Error('async transport') : {};
        const promise = rejects ? Promise.reject(value) : Promise.resolve(value);
        let captured;
        f.connection.applyAsync = function (...received) {
          assert.strictEqual(this, f.connection);
          captured = received;
          return promise;
        };
        const method = new ValidatedMethod(f.options);
        const actual = method.callAsync(args);
        assert.strictEqual(actual, promise);
        assert.deepEqual(captured, [method.name, [args], method.applyOptions]);
        assert.strictEqual(captured[1][0], args);
        assert.strictEqual(captured[2], method.applyOptions);
        if (rejects) await rejectsWith(actual, value);
        else assert.strictEqual(await actual, value);
      });
    }

    if (!supportsAsyncMethods) {
      it('throws synchronously from server callAsync without forwarding when async methods are unsupported', () => {
        const f = fixture();
        let forwarded = false;
        f.connection.applyAsync = function () {
          forwarded = true;
          return Promise.resolve();
        };
        const method = new ValidatedMethod(f.options);
        let returned;
        assert.throws(() => {
          returned = method.callAsync({ value: 1 });
        }, Error, 'Async methods are not supported in this version of Meteor');
        assert.isUndefined(returned);
        assert.isFalse(forwarded);
      });
    }

    const rejectingMethod = new ValidatedMethod({
      name: 'validatedMethod.serverContracts.asyncRejection',
      validate: null,
      async run() { throw new Meteor.Error('server-contract-rejection'); },
    });

    if (supportsAsyncMethods) {
      it('propagates a real server async run rejection', async () => {
        await rejectingMethod.callAsync({}).then(
          () => assert.fail('Expected rejection'),
          error => {
            assert.instanceOf(error, Meteor.Error);
            assert.equal(error.error, 'server-contract-rejection');
          }
        );
      });
    }
  });
}


// Keep the synchronous-schema suite above intact while specifying the async contract.
describe('mdg:method with AsyncSimpleSchema', () => {
  const plainMethod = new ValidatedMethod({
    name: 'asyncSchema.plainMethod',
    validate: new AsyncSimpleSchema({}).validator(),
    run() { return 'result'; },
  });
  const noArgsMethod = new ValidatedMethod({
    name: 'asyncSchema.noArgsMethod',
    validate: new AsyncSimpleSchema({}).validator(),
    run() { return 'result'; },
  });
  const methodWithArgs = new ValidatedMethod({
    name: 'asyncSchema.methodWithArgs',
    validate: new AsyncSimpleSchema({
      int: { type: Number },
      string: { type: String },
    }).validator(),
    run() { return 'result'; },
  });
  const methodWithSchemaMixin = new ValidatedMethod({
    name: 'asyncSchema.methodWithSchemaMixin',
    mixins: [schemaMixin],
    schema: new AsyncSimpleSchema({
      int: { type: Number },
      string: { type: String },
    }),
    run() { return 'result'; },
  });
  const methodThrowsImmediately = new ValidatedMethod({
    name: 'asyncSchema.methodThrowsImmediately',
    validate: new AsyncSimpleSchema({}).validator(),
    run() { throw new Meteor.Error('async-schema-run-error'); },
  });
  const methodReturnsName = new ValidatedMethod({
    name: 'asyncSchema.methodReturnsName',
    validate: new AsyncSimpleSchema({}).validator(),
    run() { return this.name; },
  });
  let resultReceived = false;
  const methodWithApplyOptions = new ValidatedMethod({
    name: 'asyncSchema.methodWithApplyOptions',
    validate: new AsyncSimpleSchema({}).validator(),
    applyOptions: {
      onResultReceived() { resultReceived = true; },
    },
    run() { return 'result'; },
  });
  const asyncMethod = new ValidatedMethod({
    name: 'asyncSchema.asyncMethod',
    validate: new AsyncSimpleSchema({ param: { type: Number } }).validator(),
    async run({ param }) {
      await Promise.resolve();
      return ['result', 'result2', param].join(',');
    },
  });

  function callWithCallback(method, args) {
    return new Promise((resolve, reject) => {
      method.call(args, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  async function expectRejection(invoke, checkError) {
    let error;
    try {
      await invoke();
    } catch (caught) {
      error = caught;
    }
    assert.exists(error, 'Expected the method to reject');
    checkError(error);
  }

  it('defines a method callable through its callback and Meteor.call', async () => {
    assert.equal(await callWithCallback(plainMethod, {}), 'result');
    const result = await new Promise((resolve, reject) => {
      Meteor.call(plainMethod.name, {}, (error, value) => {
        if (error) return reject(error);
        resolve(value);
      });
    });
    assert.equal(result, 'result');
  });

  it('allows callback-only calls with an empty schema', async () => {
    const result = await new Promise((resolve, reject) => {
      noArgsMethod.call((error, value) => {
        if (error) return reject(error);
        resolve(value);
      });
    });
    assert.equal(result, 'result');
  });

  if (supportsAsyncMethods) {
    it('allows callAsync with a synchronous run function', async () => {
      assert.equal(await plainMethod.callAsync({}), 'result');
    });

    it('allows callAsync with an asynchronous run function', async () => {
      assert.equal(await asyncMethod.callAsync({ param: 3000 }), 'result,result2,3000');
    });
  }

  for (const method of [methodWithArgs, methodWithSchemaMixin]) {
    for (const [label, invoke] of [
      ['callback', args => callWithCallback(method, args)],
      ['callAsync', args => method.callAsync(args)],
      ['_execute', args => method._execute({}, args)],
    ]) {
      if (label === 'callAsync' && !supportsAsyncMethods) continue;

      it('accepts valid arguments through ' + label + ': ' + method.name, async () => {
        assert.equal(await invoke({ int: 5, string: 'what' }), 'result');
      });

      it('rejects invalid arguments through ' + label + ': ' + method.name, async () => {
        await expectRejection(() => invoke({}), error => {
          assert.lengthOf(error.details, 2);
          assert.sameMembers(error.details.map(detail => detail.name), ['int', 'string']);
        });
      });
    }
  }

  for (const [label, invoke] of [
    ['callback', () => callWithCallback(methodThrowsImmediately, {})],
    ['callAsync', () => methodThrowsImmediately.callAsync({})],
    ['_execute', () => methodThrowsImmediately._execute({}, {})],
  ]) {
    if (label === 'callAsync' && !supportsAsyncMethods) continue;

    it('propagates run errors after validation through ' + label, async () => {
      await expectRejection(invoke, error => {
        assert.instanceOf(error, Meteor.Error);
        assert.equal(error.error, 'async-schema-run-error');
      });
    });
  }

  it('has access to this.name during direct execution and callback calls', async () => {
    assert.equal(await methodReturnsName._execute({}, {}), methodReturnsName.name);
    assert.equal(await callWithCallback(methodReturnsName, {}), methodReturnsName.name);
  });

  if (Meteor.isClient) {
    it('accepts Meteor.apply options', async () => {
      resultReceived = false;
      assert.equal(await callWithCallback(methodWithApplyOptions, {}), 'result');
      assert.isTrue(resultReceived);
    });
  }

  it('awaits validation before running and preserves invocation context', async () => {
    const args = { int: 5 };
    const context = { userId: 'user' };
    const calls = [];
    const schema = new AsyncSimpleSchema({ int: { type: Number } });
    const registrations = [];
    const method = new ValidatedMethod({
      name: 'asyncSchema.contextAndOrder',
      connection: { methods(methods) { registrations.push(methods); } },
      async validate(received) {
        assert.strictEqual(this, context);
        assert.strictEqual(received, args);
        await schema.validate(received);
        calls.push('validated');
      },
      run(received) {
        assert.strictEqual(this, context);
        assert.strictEqual(received, args);
        assert.equal(this.name, 'asyncSchema.contextAndOrder');
        assert.equal(this.userId, 'user');
        assert.deepEqual(calls, ['validated']);
        calls.push('run');
        return 'result';
      },
    });
    assert.lengthOf(registrations, 1);
    assert.equal(await registrations[0][method.name].call(context, args), 'result');
    assert.deepEqual(calls, ['validated', 'run']);
  });

  it('preserves the schema rejection and never runs on invalid arguments', async () => {
    const schema = new AsyncSimpleSchema({ int: { type: Number } });
    let validationError;
    let runs = 0;
    const method = new ValidatedMethod({
      name: 'asyncSchema.validationRejection',
      connection: { methods() {} },
      async validate(args) {
        try {
          await schema.validate(args);
        } catch (error) {
          validationError = error;
          throw error;
        }
      },
      run() { runs++; },
    });
    await expectRejection(() => method._execute({}, {}), error => {
      assert.strictEqual(error, validationError);
      assert.lengthOf(error.details, 1);
      assert.equal(error.details[0].name, 'int');
    });
    assert.equal(runs, 0);
  });
});

import { DDP } from 'meteor/ddp-client';

// Exercise promise/thenable contracts independently of a particular schema library.
describe('ValidatedMethod async validation contracts', () => {
  function fixture(validate, run) {
    return new ValidatedMethod({
      name: 'asyncValidationContract',
      connection: { methods() {} },
      validate,
      run,
    });
  }

  async function rejectsWith(invoke, expected) {
    let caught;
    try {
      await invoke();
    } catch (error) {
      caught = error;
    }
    assert.strictEqual(caught, expected);
  }

  it('does not run until pending validation resolves', async () => {
    let finishValidation;
    const validation = new Promise(resolve => { finishValidation = resolve; });
    const args = { value: 42 };
    const context = { userId: 'user' };
    const result = {};
    let runs = 0;
    const method = fixture(() => validation, function (received) {
      runs++;
      assert.strictEqual(this, context);
      assert.strictEqual(received, args);
      return result;
    });
    const execution = method._execute(context, args);
    assert.equal(runs, 0);
    finishValidation();
    assert.strictEqual(await execution, result);
    assert.equal(runs, 1);
  });

  it('preserves a delayed validation rejection without running', async () => {
    let rejectValidation;
    const validation = new Promise((resolve, reject) => { rejectValidation = reject; });
    const error = new Error('delayed validation');
    let runs = 0;
    const method = fixture(() => validation, () => { runs++; });
    const execution = method._execute({}, {});
    const assertion = rejectsWith(() => execution, error);
    rejectValidation(error);
    await assertion;
    assert.equal(runs, 0);
  });

  for (const [label, value] of [['false', false], ['null', null], ['zero', 0], ['object', {}]]) {
    it('rejects async validation resolving to ' + label + ' without running', async () => {
      let runs = 0;
      const method = fixture(async () => value, () => { runs++; });
      let caught;
      try {
        await method._execute({}, {});
      } catch (error) {
        caught = error;
      }
      assert.instanceOf(caught, Error);
      assert.match(caught.message, /Returning from validate/);
      assert.equal(runs, 0);
    });
  }

  it('awaits a custom validation thenable with no catch method', async () => {
    const calls = [];
    const validation = {
      then(resolve) {
        assert.strictEqual(this, validation);
        calls.push('validate');
        resolve();
      },
    };
    const result = {};
    const method = fixture(() => validation, () => {
      calls.push('run');
      return result;
    });
    assert.strictEqual(await method._execute({}, {}), result);
    assert.deepEqual(calls, ['validate', 'run']);
  });

  it('preserves rejection from a custom validation thenable', async () => {
    const error = new Error('thenable validation');
    let runs = 0;
    const method = fixture(() => ({ then(resolve, reject) { reject(error); } }),
      () => { runs++; });
    await rejectsWith(() => method._execute({}, {}), error);
    assert.equal(runs, 0);
  });

  it('rejects a validation result whose then property is not callable', () => {
    let runs = 0;
    const method = fixture(() => ({ then: true }), () => { runs++; });
    assert.throws(() => method._execute({}, {}), /Returning from validate/);
    assert.equal(runs, 0);
  });

  it('preserves an async run rejection after successful async validation', async () => {
    const error = new Error('async run');
    const method = fixture(async () => {}, async () => { throw error; });
    await rejectsWith(() => method._execute({}, {}), error);
  });
});

if (Meteor.isClient && supportsAsyncMethods) {
  describe('ValidatedMethod client callAsync contracts', () => {
    let previousInvocation;
    let previousRunning;

    beforeEach(() => {
      previousInvocation = DDP._CurrentMethodInvocation.get();
      previousRunning = DDP._CurrentMethodInvocation._isCallAsyncMethodRunning();
    });

    afterEach(() => {
      DDP._CurrentMethodInvocation._set(previousInvocation);
      DDP._CurrentMethodInvocation._setCallAsyncMethodRunning(previousRunning);
    });

    function fixture(applyAsync) {
      const connection = { methods() {}, applyAsync };
      return new ValidatedMethod({
        name: 'clientCallAsyncContract',
        connection,
        validate: null,
        applyOptions: { wait: true, throwStubExceptions: false },
        run() {},
      });
    }

    for (const [label, transportResult] of [
      ['undefined', undefined],
      ['plain object', {}],
      ['non-callable then', { then: true }],
      ['resolved promise', Promise.resolve('stub result')],
    ]) {
      it('uses the callback result when applyAsync returns ' + label, async () => {
        const args = { value: 1 };
        const serverResult = {};
        let callback;
        let captured;
        let receiver;
        const method = fixture(function (...received) {
          receiver = this;
          captured = received;
          callback = received[3];
          return transportResult;
        });
        const execution = method.callAsync(args);
        assert.strictEqual(receiver, method.connection);
        assert.equal(captured[0], method.name);
        assert.strictEqual(captured[1][0], args);
        assert.strictEqual(captured[2], method.applyOptions);
        assert.deepEqual(captured[2], {
          returnStubValue: true,
          throwStubExceptions: true,
          wait: true,
          isFromCallAsync: true,
        });
        assert.isUndefined(DDP._CurrentMethodInvocation.get());
        assert.isTrue(DDP._CurrentMethodInvocation._isCallAsyncMethodRunning());
        callback(null, serverResult);
        assert.strictEqual(await execution, serverResult);
        assert.isFalse(DDP._CurrentMethodInvocation._isCallAsyncMethodRunning());
      });
    }

    it('preserves callback errors and clears the callAsync flag', async () => {
      const error = new Meteor.Error('client-callback-error');
      const method = fixture((name, args, options, callback) => {
        callback(error);
      });
      await method.callAsync({}).then(
        () => assert.fail('Expected rejection'),
        caught => assert.strictEqual(caught, error)
      );
      assert.isFalse(DDP._CurrentMethodInvocation._isCallAsyncMethodRunning());
    });

    it('preserves a rejected stub promise before the server callback', async () => {
      const error = new Error('client stub');
      let callback;
      const method = fixture((name, args, options, received) => {
        callback = received;
        return Promise.reject(error);
      });
      const execution = method.callAsync({});
      try {
        await execution.then(
          () => assert.fail('Expected rejection'),
          caught => assert.strictEqual(caught, error)
        );
      } finally {
        // Complete the simulated transport even when an assertion fails.
        callback(null, 'later server result');
      }
      await execution.then(
        () => assert.fail('A late callback must not replace the rejection'),
        caught => assert.strictEqual(caught, error)
      );
    });

    it('rejects when applyAsync throws synchronously', async () => {
      const error = new Error('client transport');
      const method = fixture(() => { throw error; });
      await method.callAsync({}).then(
        () => assert.fail('Expected rejection'),
        caught => assert.strictEqual(caught, error)
      );
    });
  });
}
