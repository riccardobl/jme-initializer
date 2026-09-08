# jMonkeyEngine Project Initializer

A static React and TypeScript application that creates jMonkeyEngine 3.10 projects
entirely in the browser. The generated ZIP keeps shared game code in `app/` and uses
separate desktop, Android, and iOS launcher modules.

The merge engine is a deliberately Java-like TypeScript port of Richard Tingle's
original `Merger`. It preserves the established merge fields, `[IF=...]`,
`[NOT=...]`, OR conditions, fragments, `.jmetemplate`, `[DOT]`, path filtering, and
multiline-indentation behavior.

## Run locally

Install Node.js 24 and run:

```sh
npm ci
npm run dev
```

The app defaults to `https://library.jmonkeyengine.org/`. Override it for local work:

```sh
VITE_LIBRARY_API_BASE=http://localhost:8080/ npm run dev
```

The browser reads only the Library's public `/api/extensions` endpoints. It refetches
selected modules before generation, validates publication and platform compatibility,
and consumes structured publication metadata. Remote Gradle snippets are never run;
they are included in the generated project only as text references.

## Template and browser generation

Editable project sources live in `template-src/`. `npm run build:template` sorts them
and creates a deterministic `public/template.zip` with fixed timestamps and Unix
permissions. Vite then copies that archive into the static site.

At runtime `InitializerZipService` loads `template.zip` relative to the initializer
document, applies `Merger`, adds selected Library snippets, and creates the download
with JSZip. The service rejects traversal, duplicate paths, unresolved instructions,
oversized archives, and unsupported publication metadata.

## Standalone page and website embed

The same GitHub Pages deployment provides both:

- `/` — the complete standalone initializer;
- `/embed.js` — an embeddable script that inserts the initializer in sandboxed mode.

Example:

```html
<div id="jme-initializer"></div>
<script src="https://start.jmonkeyengine.org/embed.js"
        data-target="#jme-initializer"></script>
```

`embed.js` resolves `./?embed=1` from its own `document.currentScript.src`, not from
the parent page. The iframe loads `template.zip` and hashed application assets relative
to its own URL. Consequently the same artifact works under a GitHub repository path or
a custom domain without compiling either URL into the application. Resize messages are
accepted only from the created iframe and its exact origin.

## GitHub Pages releases

The workflow type-checks, tests, builds, and checks reproducibility on pushes and pull
requests. It uploads and deploys a Pages artifact only for a published GitHub release
or a manual run. `actions/configure-pages` reads the repository's configured Pages
metadata (`base_url`, `origin`, `host`, and `base_path`), while runtime asset discovery
remains relative and independent of those values.

Configure GitHub Pages to use **GitHub Actions**, then associate and verify the custom
domain in repository settings. The included `CNAME` records the intended
`start.jmonkeyengine.org` host but does not replace the GitHub settings or DNS change.

## Verify

```sh
npm run check
```

This runs strict TypeScript checking, the faithful merge-engine regression suite,
project/catalog tests, deterministic template generation, and both production bundles.
