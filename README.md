# jMonkeyEngine Project Initializer

A client-side TypeScript initializer that generates downloadable jMonkeyEngine projects in the browser.

`template-src/` contains the project templates. Build-time configuration is in `.env`.

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
