# Harmonifold

Continuous Harmony Research Tools — a canvas for continuous sound transformations.

Create nodes containing arrays of tones, connect them with directed arrows, and play multiple independent graphs simultaneously. Each graph has its own starting node and cursor. Cursor travel time is geometric edge length divided by global speed; corresponding frequencies and gains interpolate linearly along each edge.

## Use the canvas

- Double-click blank canvas to add a node. Click to select, drag to move, and press Delete to remove it with its incident arrows.
- Drag blank space to pan. Use **显示全部** (Show all) to recover offscreen nodes and **重置视图** (Reset view) to return to the initial view. Nodes can move beyond the initial bounds. View navigation also works during playback and never changes musical geometry or timing.
- Hold Ctrl and click nodes in sequence to create directed connections. Release Ctrl to end the chain. Double-click an arrow to remove it.
- Click an arrow to choose its interpolation mapping: `y = x`, `y = floor(x)`, or `y = smoothstep(x, 0.95, 1)`. The mapping affects frequency and gain together; cursor speed and travel time stay unchanged. Settings persist per arrow; older files default to linear.
- Edit the selected node's sound array in the inspector. Each tone retains direct-frequency and equal-division modes, sine/square/sawtooth/triangle waveform, and gain controls.
- Each connected graph needs one start node. The first connection initializes it; select any node with outgoing arrows to change it.
- Press Space or Play to start all graphs together. Editing is locked during playback. Space stops; the next run restarts every graph and resets its outgoing-arrow counters.
- Each node selects outgoing arrows in creation order on successive visits, cycling back to its first arrow after the last. Terminal graphs finish individually; loops run until stopped. There is no automatic backtracking.
- In each graph, all sound arrays must be nonempty and equal in size, with matching waveforms at corresponding indices. Separate graphs may use different sizes and waveforms. Isolated nodes are editable drafts.
- Edits save locally in this browser. Export/import JSON to save or share a complete work. Old single-tone URLs import as a draft node. Opening a page never starts playback automatically; hiding it stops playback.

Import [the independent loops example](docs/examples/independent-loops.json) to try two loops with different periods and voice counts.

## Development

Use Node.js 24 LTS and npm.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

The dev server prints the local URL; production output is `dist/`.

## Modules and tests

The project separates frequency mathematics (`core`), graph editing/validation/storage (`graph`), time-based traversal and interpolation (`playback`), Web Audio scheduling (`audio`), and canvas/inspector interactions (`ui`). `App.tsx` coordinates these modules.

Every behavior module has unit tests. New modules and behavior changes must include matching tests. See [the architecture and testing guide](docs/architecture.md) for module-to-test mapping, graph split/merge rules, playback semantics, validation boundaries, and scheduling limits. Tests cover graph algorithms, sound math, audio automation/cancellation, persistence, and rendered UI interactions.

## Frequency mathematics

The existing pure functions remain available:

```ts
ratioToFrequency(baseHz, ratio)
centsToFrequency(baseHz, cents)
equalDivisionFrequency(baseHz, step, divisions, periodRatio = 2)
```

Equal division uses `f = baseHz × periodRatio^(step / divisions)`. Arbitrary positive periods, fractional frequencies and negative integer steps are supported. Audio frequencies must remain below half the active browser sample rate. Per-tone gain is 0–0.2, with a fixed session-level mixing scale for multiple voices.

Interpolation is linear in Hz and gain after applying the selected edge mapping. With the default `y = x`, halfway from 440 to 880 Hz is 660 Hz. `floor` holds the starting sound until the endpoint; fixed smoothstep transitions during the last 5% of the edge. Graph layout is musically meaningful: moving a node changes transition duration.

## Deployment

The existing GitHub Actions workflow checks types, tests and production build on pull requests and pushes to `main`. Successful main builds deploy the Pages artifact. Set repository **Settings → Pages → Build and deployment → GitHub Actions** when enabling deployment.

Target repository: [EricSolshkov/Harmonifold](https://github.com/EricSolshkov/Harmonifold). Vite uses relative asset URLs to support project-path hosting. This change does not itself push or deploy the app.
