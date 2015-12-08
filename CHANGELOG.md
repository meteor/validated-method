# Change log

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
