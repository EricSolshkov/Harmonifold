# Harmonifold — Workspace Startup Guide

## 0. Project Identity

Project name:

```text
Harmonifold
```

Harmonifold is a research workspace for exploring continuous harmony over potentially infinite pitch spaces.

The long-term research direction includes:

- arbitrary pitch collections
- microtonality
- infinite or continuous pitch spaces
- harmonicity
- tension
- continuous transformations between harmonic states
- transformation paths
- group actions
- equivalence relations
- symmetry
- invariants
- mathematical structures related to harmony
- audible and visual research tools for exploring these structures

The project is interdisciplinary and may be used by musicians, mathematics students, music-theory researchers, and software developers.

Harmonifold is not intended to encode one fixed theory of harmony.

It should instead provide a clean experimental platform in which multiple mathematical and perceptual models may eventually coexist and be compared.

---

# 1. Immediate Goal

The first milestone is intentionally small.

Do not attempt to implement the long-term Harmonifold theory yet.

The first tool should:

1. generate arbitrary frequencies
2. play them in the browser
3. support several basic oscillator waveforms
4. calculate frequencies from equal divisions of arbitrary frequency periods
5. provide a clean mathematical foundation for future pitch-space work
6. deploy as a static web application

This is the first experimental instrument of Harmonifold.

It is not the final scope of Harmonifold.

---

# 2. Product Principle

The intended operational model is:

```text
researcher
    ↓
open URL
    ↓
change parameters
    ↓
hear / inspect result
```

Researchers should not need to:

- install a desktop application
- configure an audio environment
- install Node.js
- compile native code
- manage dependencies
- pull repository updates
- run local CI

The repository maintainer handles development, CI, deployment, and maintenance.

Users should normally only need to refresh the page to receive the newest deployed version.

---

# 3. Initial Technology Stack

Use:

- TypeScript
- Vite
- React
- Web Audio API
- Vitest
- GitHub Actions
- GitHub Pages

Prefer browser-native functionality.

Avoid introducing unnecessary dependencies.

Do not introduce:

- Electron
- JUCE
- Qt
- C++
- Rust
- WebAssembly
- backend services
- databases
- server-side rendering

unless a future requirement explicitly justifies them.

The first version must remain a static website.

---

# 4. Architectural Philosophy

The long-term conceptual architecture is:

```text
Harmonic Theory
      ↓
Pitch / Frequency Mathematics
      ↓
Harmonic States
      ↓
Audio / Visualization
```

However, only the lower layers should be implemented during initialization.

For the first milestone:

```text
Pitch / Frequency Mathematics
          ↓
      frequencyHz
          ↓
        Audio
          ↓
      Web Audio
```

Do not prematurely implement theoretical abstractions whose definitions are still research questions.

In particular, do not invent concrete definitions for:

- harmonicity
- tension
- harmonic manifolds
- harmonic distance
- transformation groups
- invariants
- chord similarity
- perceptual consonance
- continuous harmonic paths

These concepts belong to later research milestones.

---

# 5. Core Mathematical Principle

The most fundamental representation should be frequency and frequency ratio.

Do not make:

```text
12-TET
```

the base abstraction.

Do not make:

```text
EDO
```

the base abstraction.

Do not make:

```text
note names
```

the base abstraction.

Do not assume octave equivalence.

The fundamental relationship is:

```text
frequency = referenceFrequency * ratio
```

Mathematically:

```text
f = f0 * r
```

where:

```text
f0 > 0
r  > 0
```

This allows later support for:

- just intonation
- arbitrary ratios
- cents
- EDO
- EDx
- non-octave scales
- continuous pitch values
- mathematically generated pitch spaces

---

# 6. Equal Division Model

Equal division should mean:

> equal logarithmic division of an arbitrary positive frequency period.

For:

```text
base frequency = f0
period ratio   = R
divisions      = N
step index     = k
```

define:

```text
f(k) = f0 * R^(k / N)
```

Examples:

```text
12-EDO

R = 2
N = 12
```

```text
31-EDO

R = 2
N = 31
```

```text
53-EDO

R = 2
N = 53
```

```text
13-EDT

R = 3
N = 13
```

Octave division is therefore only the special case:

```text
R = 2
```

Do not hard-code octave equivalence into the architecture.

---

# 7. Initial Mathematical API

Create small pure functions.

Conceptually:

```ts
ratioToFrequency(
  baseHz: number,
  ratio: number
): number
```

```ts
centsToFrequency(
  baseHz: number,
  cents: number
): number
```

```ts
equalDivisionFrequency(
  baseHz: number,
  step: number,
  divisions: number,
  periodRatio?: number
): number
```

The convenience default may be:

```text
periodRatio = 2
```

but this must not be treated as a fundamental assumption.

Use JavaScript `number` initially.

Do not introduce arbitrary-precision arithmetic unless future experiments demonstrate that ordinary floating-point precision is insufficient.

---

# 8. Domain Separation

Maintain strong boundaries between:

```text
mathematics
audio
UI
```

The mathematical layer must not import:

- React
- DOM APIs
- Web Audio APIs

The audio layer must not understand:

- EDO
- cents
- temperaments
- ratios
- note names
- harmonic theory

The audio layer should consume frequencies.

For example:

```ts
interface Tone {
  frequencyHz: number;
  gain: number;
  waveform: OscillatorType;
}
```

The UI may coordinate mathematical and audio modules.

---

# 9. Future Harmonic-State Boundary

Harmonifold will eventually operate on collections of pitches rather than isolated tones.

The future conceptual object is something like:

```ts
interface HarmonicState {
  tones: Tone[];
}
```

Do not build a full HarmonicState system during initialization.

Do not build polyphony unless it is trivial and does not expand scope.

However, avoid architectural decisions that make multi-tone harmonic states difficult to introduce later.

The single-tone player is an implementation milestone, not a permanent conceptual limitation.

---

# 10. Suggested Repository Structure

Use a structure similar to:

```text
src/
  core/
    frequency.ts
    ratio.ts
    cents.ts
    equalDivision.ts
    index.ts

  audio/
    oscillator.ts
    player.ts
    index.ts

  ui/
    components/

  App.tsx
  main.tsx

tests/
  core/

.github/
  workflows/
```

`core/` contains mathematically pure foundations.

Do not place speculative future harmony theory inside `core/`.

Future research areas may later become separate modules such as:

```text
theory/
  harmonicity/
  tension/
  transformations/
  groups/
  invariants/
```

but these should not be created until corresponding research definitions exist.

---

# 11. Audio Layer

Use the Web Audio API.

Support these oscillator waveforms initially:

- sine
- square
- sawtooth
- triangle

Use:

```text
AudioContext
OscillatorNode
GainNode
```

Basic signal flow:

```text
OscillatorNode
      ↓
   GainNode
      ↓
AudioContext.destination
```

The player should support:

```text
play
stop
```

Only one active oscillator is required initially.

Avoid audible clicks when starting or stopping.

Use short gain ramps rather than abrupt amplitude changes.

Handle browser autoplay restrictions correctly.

Resume a suspended `AudioContext` after explicit user interaction when required.

---

# 12. Frequency Updates

When the user modifies parameters while a tone is playing:

- prefer smooth frequency updates
- avoid recreating the oscillator unless necessary
- use Web Audio parameter scheduling where appropriate

Do not over-engineer modulation systems.

The only requirement is that interactive parameter changes sound reasonably smooth.

---

# 13. Initial User Interface

Create a compact research-oriented interface.

Expose at least:

```text
Base Frequency
Period Ratio
Divisions
Step Index
Waveform
Gain
Calculated Frequency
Play / Stop
```

Recommended defaults:

```text
Base Frequency = 440 Hz
Period Ratio   = 2
Divisions      = 12
Step Index     = 0
Waveform       = sine
```

Allow:

```text
negative step index
zero step index
positive step index
```

Use integer step indices initially.

Parameter changes should immediately update the displayed frequency.

Do not spend excessive effort on styling.

Clarity and correctness are more important than visual polish during initialization.

---

# 14. Direct Frequency Mode

The project must also support arbitrary direct frequency playback.

The user should be able to specify a frequency such as:

```text
440
432
440.5
523.2511306
```

and hear it directly.

Equal-division calculation is one frequency-generation method, not the only source of frequencies.

Conceptually:

```text
Direct Frequency
        ↓
      Audio
```

and:

```text
Equal Division
        ↓
   calculated Hz
        ↓
      Audio
```

should converge into the same player.

---

# 15. Input Validation

Validate mathematically invalid input.

At minimum:

```text
baseFrequency > 0
directFrequency > 0
periodRatio > 0
divisions > 0
gain within a safe range
```

Normally:

```text
periodRatio != 1
```

for meaningful equal division.

Do not silently replace invalid values with unrelated defaults.

Show validation feedback.

Prevent invalid values from reaching the audio layer.

---

# 16. URL State

Design user-facing parameters so they can be serialized to the URL.

Target form:

```text
/?base=440&period=2&divisions=31&step=18&wave=sine
```

or an equivalent clean representation.

The purpose is reproducible research sharing.

A researcher should eventually be able to send another researcher a URL representing the exact experiment being discussed.

If URL synchronization is straightforward during initialization, implement it.

If not, keep application state structured so that URL serialization can be added easily.

Do not introduce a state-management framework solely for this feature.

---

# 17. Tests

Use Vitest.

The mathematical core must have unit tests.

Test at minimum:

## Ratio

```text
440 * 2 = 880
440 * 0.5 = 220
440 * 3/2 = 660
```

## Cents

```text
440 + 0 cents = 440
440 + 1200 cents = 880
440 - 1200 cents = 220
```

## Equal Division

```text
12-EDO
base = 440
step = 0
result = 440
```

```text
12-EDO
base = 440
step = 12
result = 880
```

```text
12-EDO
base = 440
step = -12
result = 220
```

## Non-octave division

```text
base = 440
periodRatio = 3
divisions = 13
step = 13

result = 1320
```

## Equivalent constructions

Verify numerical agreement between:

```text
ratio 2
1200 cents
12/12 division of period 2
```

Use floating-point tolerance where necessary.

Do not use exact equality for computations where rounding error is expected.

---

# 18. TypeScript Rules

Use strict TypeScript.

Prefer:

- clear types
- explicit names
- small functions
- pure functions
- immutable values where convenient
- readable code over clever abstractions

Avoid:

- unnecessary classes
- generic abstraction layers without concrete use cases
- reflection-heavy designs
- dependency injection frameworks
- speculative plugin architectures
- global mutable state scattered across components

React components must not contain tuning mathematics directly.

Move mathematical formulas into `core/`.

---

# 19. Development Commands

Provide standard scripts:

```text
npm run dev
npm run build
npm run test
npm run typecheck
```

Add linting only if useful.

If linting is introduced:

```text
npm run lint
```

Do not add excessive tooling simply because it is conventional.

---

# 20. Package Management

Use npm unless the existing repository clearly uses another package manager.

Commit the lockfile.

CI should use:

```text
npm ci
```

for reproducible installs.

---

# 21. GitHub Actions

Create CI workflows.

On pull requests and pushes to the main branch, run:

```text
install
typecheck
test
build
```

The build should fail if:

- TypeScript errors occur
- unit tests fail
- production build fails

Keep CI simple.

---

# 22. GitHub Pages

Configure deployment to GitHub Pages.

Target workflow:

```text
push
  ↓
GitHub Actions
  ↓
validation
  ↓
production build
  ↓
GitHub Pages deployment
```

The deployed application must work as a static site.

Pay attention to Vite base-path handling for repository-based GitHub Pages URLs.

Do not require manual file copying for normal deployment.

If GitHub repository metadata is not available locally, prepare the configuration as far as possible and document what remains.

---

# 23. README

Create a concise README.

It should explain:

- what Harmonifold is
- long-term research direction
- what the first milestone currently supports
- local development
- tests
- build
- deployment
- basic mathematical model
- repository architecture

Clearly distinguish:

```text
current implementation
```

from:

```text
long-term research ambitions
```

Do not imply that unresolved concepts such as tension or harmonicity already have canonical definitions.

---

# 24. Naming

Use the project name consistently:

```text
Harmonifold
```

Recommended package/repository identity:

```text
harmonifold
```

Recommended page title:

```text
Harmonifold
```

Recommended subtitle:

```text
Continuous Harmony Research Tools
```

The first tool may be described as:

```text
Arbitrary Frequency & Equal Division Explorer
```

Do not name the entire project after EDO, microtonality, or the first player.

---

# 25. Long-Term Research Context

The broader research problem can be thought of conceptually as studying a space of harmonic states.

A future harmonic state may be represented abstractly as:

```text
H ∈ ℋ
```

A continuous transformation between harmonic states may eventually be modeled as a path:

```text
γ : [0, 1] → ℋ
```

Future research may investigate functions such as:

```text
T : ℋ → ℝ
```

for tension, or:

```text
Q : ℋ → ℝ
```

for harmonicity.

Research may also involve transformation groups:

```text
G ↷ ℋ
```

and the search for quantities that remain invariant under relevant transformations.

These expressions are research motivation only.

Do not implement them during initialization.

Do not assume that the eventual state space is literally a differentiable manifold.

The name Harmonifold is a research identity, not a requirement that the final mathematical structure must be a manifold.

---

# 26. Explicit Non-Goals for Initialization

Do not implement:

- chord recognition
- harmony recommendation
- MIDI sequencing
- notation
- DAW functionality
- piano-roll editing
- VST plugins
- native desktop applications
- sample playback
- physical modeling
- additive synthesis systems
- arbitrary polyphonic synthesizer architectures
- Scala file parsing
- MPE
- MIDI device input
- spectral analysis
- harmonicity models
- psychoacoustic roughness models
- tension models
- graph-theoretic harmony
- group-theory engines
- topology systems
- manifold learning
- symbolic algebra
- invariant search
- machine learning
- databases
- user accounts
- collaboration servers

These may become future experiments.

They are outside the first milestone.

---

# 27. Avoid Premature Theory

Do not create abstractions merely because the long-term research description mentions advanced mathematics.

In particular, do not invent classes such as:

```text
HarmonyManifold
TensionTensor
HarmonicGroup
InvariantAnalyzer
PitchTopology
TransformationFunctor
```

unless a concrete future research task defines what they mean.

Harmonifold is intended to discover theory experimentally.

The software architecture must not pretend that unresolved theory has already been solved.

---

# 28. Reversibility Principle

When a design decision is uncertain:

> choose the smallest reversible implementation.

Examples:

Prefer:

```text
plain functions
```

over:

```text
large inheritance hierarchies
```

Prefer:

```text
simple structured state
```

over:

```text
custom application frameworks
```

Prefer:

```text
browser APIs
```

over:

```text
custom infrastructure
```

Prefer:

```text
well-tested mathematical primitives
```

over:

```text
speculative general theory engines
```

---

# 29. Initialization Procedure

Begin by inspecting the current workspace.

If the repository is empty:

1. initialize a Vite + React + TypeScript project
2. configure strict TypeScript
3. establish the directory structure
4. implement mathematical core functions
5. add mathematical tests
6. implement arbitrary-frequency playback
7. implement equal-division frequency generation
8. build the minimal UI
9. verify smooth playback behavior
10. add URL-state support if straightforward
11. configure CI
12. configure GitHub Pages deployment
13. write README
14. run full verification

If files already exist:

- inspect them first
- preserve useful work
- adapt rather than blindly overwrite

---

# 30. Verification Checklist

Initialization is complete when:

- dependencies install successfully
- `npm run dev` starts the application
- direct arbitrary-frequency playback works
- sine playback works
- square playback works
- sawtooth playback works
- triangle playback works
- gain control works
- equal-division frequency generation works
- negative steps work
- non-octave period ratios work
- theory code is independent from React
- theory code is independent from Web Audio
- audio code consumes frequencies rather than tuning concepts
- unit tests pass
- TypeScript type checking passes
- production build succeeds
- GitHub Actions workflow exists
- GitHub Pages configuration exists or is ready to activate
- README explains the architecture and current scope

Run all available validation commands before considering initialization finished.

---

# 31. Expected Final Report

After completing workspace initialization, report:

1. files created
2. files significantly modified
3. final repository structure
4. implemented features
5. mathematical APIs implemented
6. tests added
7. commands executed
8. test result
9. typecheck result
10. production build result
11. GitHub Actions status
12. GitHub Pages readiness
13. assumptions made
14. unresolved issues
15. recommended next development step

Do not claim deployment succeeded unless it was actually possible to verify.

---

# 32. First Milestone Summary

The first Harmonifold milestone is:

```text
arbitrary frequency
        +
basic oscillator
        +
general equal division
        +
clean mathematical core
        +
browser UI
        +
tests
        +
CI
        +
static deployment
```

Nothing more is required for workspace initialization.

The purpose of this milestone is to establish a reliable experimental foundation on which future Harmonifold research tools can be built.

Correctness, simplicity, testability, and reversibility are more important than feature count.