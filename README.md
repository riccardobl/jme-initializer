# jMonkeyEngine Project Initializer

A client-side TypeScript initializer that generates downloadable jMonkeyEngine projects in the browser.

`template-src/` contains the project templates. Runtime options are defined in
`public/config.json`; the checked-in JSON is the single source of truth for engine
and plugin versions, platform compatibility, Java versions, renderers, core modules,
native allocators and defaults.

Selectable core modules are data-driven. Add an entry with `id`, `name` and
`description`; `platforms` is optional and defaults to every platform. Required
modules are added silently from `requiredModules` and are not shown in the UI.

The generated project keeps its normalized source icon at `icon.png`. The iOS
plugin consumes that file directly, while the included
`gradle/libs/android-icon-gen.gradle` task regenerates Android launcher densities
whenever the project is built.

## Build

```sh
npm ci
npm run build
```

The static site is generated in `dist/`.

## Embed

```html
<script src="https://jmestart.rblb.it/embed.js"></script>
```
