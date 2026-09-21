# Contributing

Contributions to the Casper CBC research track should be deterministic, inspectable, and narrowly scoped.

## Evidence requirements

When upstream behavior is involved, include:

- the exact upstream commit;
- the relevant upstream function path;
- a minimal deterministic reproducer;
- the observed result;
- the strongest claim actually supported by the result.

Do not turn a synthetic scenario into a protocol claim without an upstream reachability argument.

## Preferred workflow

~~~text
model
  |
minimize
  |
reachability screen
  |
upstream reproducer
  |
full-path validation
  |
documented result
~~~

## Quality gates

~~~bash
npm run typecheck
npm run lint
npm test
npm run build
~~~

Keep consensus-specific experiments isolated under src/lib/cbc/ or scripts/upstream/ unless a broader architectural change is required.

## Research language

Prefer precise terms such as:

- observation;
- candidate discrepancy;
- confirmed implementation behavior;
- controlled integration result;
- protocol hypothesis.

Avoid calling something a vulnerability until the relevant protocol-level consequence is actually demonstrated.
