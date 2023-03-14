# Change log

## 1.3.0

- Added `callAsync` as the counter part for `Meteor.callAsync` 
more can be seen in the [PR](https://github.com/meteor/validated-method/pull/92)

## 1.2.0

- Remove underscore and modernize
- Add direct check for Connection object and remove the check from the check call.

## 1.1.0

- Allow overriding default `Meteor.apply` options via `applyOptions` option. [#46](https://github.com/meteor/validated-method/pull/46)

## 1.0.2

- Relax `versionsFrom` constraint so that it works with 1.3 beta 16. [#42](https://github.com/meteor/validated-method/issues/42)

## 1.0.1

- Added error handling when a mixin doesn't return any options, thanks to [PR #24](https://github.com/meteor/validated-method/pull/24).

## 1.0.0

- Added mixins, which are functions that transform incoming Method options.

## 0.2.3

- `this.name` is now accessible if the Method is called via `_execute`.

## 0.2.2

- You can now access the Method name through `this.name` inside `run()`.

## 0.2.1

- Throw errors if a callback is not passed, just like normal Methods do.

## 0.2.0

- Renamed from `mdg:method` to `mdg:validated-method` and `Method` to `ValidatedMethod`
- Removed `schema` option, the way to use SimpleSchema now is by passing `SimpleSchema#validator()` into the `validate` option
- Added a special meaning to `validate: null` to allow people to intentionally skip validation if they need to, for example when a method has no arguments

## 0.1.0

Initial version
