# Contributing to searoute-ts

Thanks for helping out! Bug reports, fixes, and data corrections are all welcome.

## Getting started

```bash
git clone https://github.com/mayurrawte/searoute-ts.git
cd searoute-ts
npm ci
npm test        # builds and runs the AVA suite
```

The library source lives in `src/`; the interactive demo in `examples/web-demo`
(its own npm project — `npm ci && npm run dev` inside that folder).

## Before you open a PR

- `npm run lint` and `npm run format:check` must pass (`npm run format` fixes style).
- `npm test` must pass. New behavior needs a test — routes are validated
  against published port-to-port distances in `src/index.spec.ts`, so include
  a realistic case if you touch routing logic.
- Keep PRs focused: one fix or feature per PR.

## Reporting bugs

Open an issue with the origin/destination coordinates, the options you passed,
what you expected, and what you got. A link to a reproduction on the
[demo](https://mayurrawte.github.io/searoute-ts/) (the URL encodes the full
state) is the fastest way to show a routing problem.

## The network data

`src/lib/marnet.ts` is generated — don't edit it by hand. It's built from the
Eurostat/GISCO maritime network by `scripts/build-marnet.cjs`. If a route is
wrong because the underlying network is wrong, open an issue so it can be fixed
at the source.
