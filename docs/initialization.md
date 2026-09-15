# Initialization report

Date: 2026-09-16 (Asia/Shanghai). Specification: `StartUp.md`.

## Delivered files and structure

The original workspace contained only `StartUp.md`; it was preserved without edits. All implementation/configuration files below are new:

```text
.gitignore
.github/workflows/pages.yml
README.md
docs/initialization.md
index.html
package.json
package-lock.json
tsconfig.json
vite.config.ts
src/
  core/{frequency,ratio,cents,equalDivision,index}.ts
  audio/{player,index}.ts
  ui/state.ts
  App.tsx
  main.tsx
  style.css
tests/
  core/frequency.test.ts
  state.test.ts
  audio.test.ts
```

Local Git initialized on `main`; origin points to `https://github.com/EricSolshkov/Harmonifold.git`. Remote inspection found no existing refs.

## Implementation

Direct frequency and arbitrary-period equal division feed a shared single-tone Web Audio player. Four basic oscillator waveforms, gain, smooth frequency/gain scheduling, attack/release, explicit activation, stop, cancellation of pending activation, visibility cleanup and sample-rate validation are implemented. Structured URL state retains parameter strings and never auto-plays. Pure mathematical APIs: `ratioToFrequency`, `centsToFrequency`, `equalDivisionFrequency`.

## Executed validation

| Command/check | Result |
| --- | --- |
| `npm install react react-dom` and development dependency installation | Passed |
| `npm ci` | Passed after stopping Vite to release a Windows native-module file lock |
| `npm run typecheck` | Passed, strict TypeScript |
| `npm run test` | 31 tests passed across 3 files |
| `npm run build` | Passed, Vite production static assets generated |
| `npm run dev -- --port 5173` | Started successfully |
| `npm run preview -- --port 5173` | Started successfully; production build exercised in browser |
| Dependency audit during install | 0 reported vulnerabilities |

Tests cover ratios, cents, positive/zero/negative equal-division steps, non-octave and descending periods, degenerate period 1, equivalent constructions, invalid inputs and numeric overflow/underflow. Additional tests cover exact URL round trips, malformed URL values, gain/sample-rate boundaries, all four waveforms, gain/frequency scheduling, oscillator reuse, disconnect/close, and Stop during pending AudioContext resume.

In the Codex browser, verified Play → Playing and Stop → Stopped; -12 steps at 12 divisions displayed 220 Hz; period 3 with 13 divisions/13 steps displayed 1320 Hz. Waveform and gain updates retained playback. Setting divisions to zero displayed an error, disabled Play and stopped audio. Production preview restored 523.2511306 Hz and triangle waveform from a URL without autoplay, then played and accepted a live update to 440.5 Hz. Desktop layout was inspected visually.

Audio scheduling has automated coverage and the browser accepted playback. Human listening quality, speaker output and cross-browser/mobile behavior have not been verified.

## CI and Pages

Workflow prepared for PR/main validation and main-branch Pages deployment. Relative asset paths support the repository subpath. The initial missing Git author configuration was resolved using the user-provided identity, scoped to this repository. Remote Actions and Pages deployment results must be checked after pushing. Repository Pages must use GitHub Actions as its build source; see README.

## Assumptions and remaining work

- Initialization follows StartUp's explicit definition: it includes the functioning first experimental instrument.
- Use npm, Node 24, strict TypeScript, single oscillator, integer steps/divisions, English UI matching the supplied specification.
- Period 1 remains valid mathematics with a UI explanation; no octave equivalence or speculative theory is introduced.
- Gain defaults to 0.05 and caps at 0.2; playback is limited by the actual browser sample rate.
- Browser-use CLI was unavailable; browser verification used the available in-app browser automation.
- Next development step: human listening/cross-browser acceptance, then agree the next research experiment before expanding to multi-tone states.
