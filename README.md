# Harmonifold

Continuous Harmony Research Tools — **Arbitrary Frequency & Equal Division Explorer**.

Harmonifold is a browser-based research workspace for frequency relationships. The first milestone plays one tone and explores equal logarithmic divisions of arbitrary positive frequency periods. Researchers open a URL, change parameters, and listen; no local installation is required for the deployed app.

## Current implementation

- Direct fractional frequency input or equal-division calculation, including negative steps and non-octave periods.
- Sine, square, sawtooth and triangle oscillators; Play, Stop, and gain control.
- Smooth frequency/gain changes with Web Audio scheduling and short attack/release envelopes.
- Validation feedback; invalid active parameters stop playback. Audio frequencies must lie below half the browser's sample rate. Mathematics has no audio-band restriction.
- Reproducible URL state, including mode, direct frequency, tuning parameters, waveform and gain. Opening a link never starts audio automatically.
- Playback stops when the tab is hidden. Default gain is 0.05; allowed range is 0–0.2. Device volume still determines loudness.

Long-term research may explore continuous pitch spaces, collections of tones, transformations, symmetry and perceptual models. This version does **not** define harmonicity, tension, harmonic distance, or a canonical harmonic manifold.

## Development

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm run test
npm run build
npm run preview
```

`dev` prints the local URL. Production files are written to `dist/`. `test` runs Vitest once. The committed npm lockfile makes installs reproducible.

## Mathematical model

The foundation is `f = baseHz × ratio`, with positive finite frequencies and ratios.

```ts
ratioToFrequency(baseHz, ratio)
centsToFrequency(baseHz, cents) // baseHz × 2^(cents / 1200)
equalDivisionFrequency(baseHz, step, divisions, periodRatio = 2)
// baseHz × periodRatio^(step / divisions)
```

`step` is a signed safe integer; `divisions` is a positive safe integer. Period 2 is a convenience default, not an assumption of octave equivalence. Periods below 1 are valid descending constructions. Period 1 is mathematically valid but degenerate; the UI explains it. Non-finite inputs and results, including underflow to zero, are rejected. Results use ordinary JavaScript floating-point numbers.

Examples: `(440, 12, 12, 2)` gives 880 Hz; `(440, -12, 12, 2)` gives 220 Hz; `(440, 13, 13, 3)` gives 1320 Hz.

URL example: `?base=440&period=3&divisions=13&step=13&wave=sine`.

## Architecture

```text
src/
  core/                 Pure frequency, ratio, cents and equal-division functions
  audio/                Frequency-only Web Audio player and validation
  ui/state.ts           Experiment state, validation and URL serialization
  App.tsx               Parameter controls and player coordination
  main.tsx              React entry point
  style.css             Responsive interface
tests/
  core/frequency.test.ts Mathematical examples and boundary cases
  audio.test.ts         Audio scheduling, validation and resume cancellation
  state.test.ts         URL round trips and malformed input
.github/workflows/pages.yml
```

`core` imports no browser, React or audio APIs. `audio` knows nothing about tuning systems. The UI connects both. The current single-oscillator scope leaves future multiple-tone work open without introducing speculative theory types.

## GitHub and deployment

Target repository: [EricSolshkov/Harmonifold](https://github.com/EricSolshkov/Harmonifold).

The workflow validates pull requests and pushes to `main` with `npm ci`, type checking, tests and production build. Successful main-branch builds upload the Pages artifact and deploy using GitHub's Pages actions.

In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**. Then push to `main` or manually run **Validate and deploy**. Pages must be enabled and available for the repository's visibility/account plan.

Vite uses relative asset URLs (`base: './'`) so the static build works under `/Harmonifold/` as well as a domain root. State uses query parameters, with no client-side path routes requiring server rewrites.

Expected address once deployment succeeds: `https://ericsolshkov.github.io/Harmonifold/`. Configuration alone does not establish that the site has been deployed; check the Actions run and its deployment URL.

## Validation and next step

See [the initialization report](docs/initialization.md) for checks and remaining activation steps. Next, perform a listening pass with the intended browsers/devices and collect researcher feedback before expanding scope to multiple simultaneous tones.

Implementation references: [Vite documentation](https://vite.dev/guide/) and [Web Audio parameter smoothing](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/setTargetAtTime).
