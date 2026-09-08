import {readFile} from 'node:fs/promises';
import {beforeAll, describe, expect, test} from 'vitest';
import {InitializerConfig} from './config';

describe('InitializerConfig', () => {
    let document: Record<string, unknown>;

    beforeAll(async () => {
        document = JSON.parse(await readFile(new URL('../public/config.json', import.meta.url), 'utf8')) as Record<string, unknown>;
    });

    test('loads the committed JSON as the complete client-side configuration', () => {
        const config: InitializerConfig = new InitializerConfig(structuredClone(document), new URL('https://initializer.example/project/config.json'));

        expect(config.libraryApiBase).toBe('https://library.jmonkeyengine.org/');
        expect(config.templateArchiveUrl.href).toBe('https://initializer.example/project/template.zip');
        expect(config.jmeVersion).toBe('3.10.0-beta2');
        expect(config.libJgliosPluginVersion).toBe('0.10');
        expect(config.recommendedJavaVersion().version).toBe(11);
        expect(config.recommendedRenderer().id).toBe('GLES3');
        expect(config.recommendedAllocator().id).toBe('safer');
        expect(config.coreModule('jme3-effects').selectedByDefault).toBe(true);
        expect(config.coreModule('jme3-testdata').selectedByDefault).toBe(false);
        expect(config.coreModule('jme3-awt-dialogs').platforms).toEqual(['windows', 'linux']);
    });

    test('accepts a new selectable module using JSON metadata only', () => {
        const changed: Record<string, unknown> = structuredClone(document);
        (changed.coreModules as unknown[]).push({id: 'jme3-future', name: 'Future module', description: 'Added without a code change.'});
        const config: InitializerConfig = new InitializerConfig(changed, new URL('https://initializer.example/config.json'));

        expect(config.coreModule('jme3-future').description).toBe('Added without a code change.');
        expect(config.coreModule('jme3-future').platforms).toBeUndefined();
        expect(config.coreModule('jme3-future').selectedByDefault).toBe(false);
    });

    test('rejects unsafe URLs, unknown platforms and duplicate IDs', () => {
        const unsafe: Record<string, unknown> = structuredClone(document);
        unsafe.libraryApiBase = 'javascript:alert(1)';
        expect(() => new InitializerConfig(unsafe, new URL('https://initializer.example/config.json'))).toThrow('Library API');

        const unknownPlatform: Record<string, unknown> = structuredClone(document);
        ((unknownPlatform.coreModules as Record<string, unknown>[])[0] as Record<string, unknown>).platforms = ['dreamcast'];
        expect(() => new InitializerConfig(unknownPlatform, new URL('https://initializer.example/config.json'))).toThrow('unknown platform');

        const duplicate: Record<string, unknown> = structuredClone(document);
        (duplicate.coreModules as unknown[]).push(structuredClone((duplicate.coreModules as unknown[])[0]));
        expect(() => new InitializerConfig(duplicate, new URL('https://initializer.example/config.json'))).toThrow('engine module IDs');
    });
});
