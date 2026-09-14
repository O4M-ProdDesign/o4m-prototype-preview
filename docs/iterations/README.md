# Iteration previews

Each subfolder here is a self-contained preview build, published by GitHub Pages at:

    https://<user>.github.io/<repo-A>/iterations/<folder-name>/

**How it works**
- Drop a built, inlined `index.html` into `iterations/<name>/` to publish that redesign iteration at its own URL.
- The current app stays at the repo root (`docs/index.html`) → `…github.io/<repo-A>/`.
- Builds are fully self-contained (all CSS, JS, and fonts inlined), so an `index.html` runs correctly at any path — no `vite.config.js` base-path changes needed.

**Lifecycle**
- **Add** an iteration: create `iterations/<name>/` and upload its `index.html`.
- **Retire** an iteration: delete its folder on the next upload.
- **Promote** a winner: replace `docs/index.html` with it (and fold its source into `src/`).

The shared repo (Repo B) is intentionally left flat — it is not affected by anything in this folder.
