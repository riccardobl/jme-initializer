import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: false,
        lib: {
            entry: 'src/embed.ts',
            name: 'JmeInitializerEmbed',
            formats: ['iife'],
            fileName: () => 'embed.js'
        },
        minify: 'esbuild',
        sourcemap: true
    }
});
