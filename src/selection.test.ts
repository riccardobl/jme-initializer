import {readFile} from 'node:fs/promises';
import {beforeAll, expect, test} from 'vitest';
import {InitializerConfig} from './config';
import type {LibraryModule} from './core/types';
import {catalogTopics, compatible, defaultCoreModules, launcherModules, safeImage, supportsCoreModule,
    supportsJavaVersion, supportsRenderer} from './selection';

const desktop: LibraryModule = {platforms: ['WINDOWS', 'LINUX', 'MACOS'].map(operatingSystem => ({operatingSystem}))};
let config: InitializerConfig;

beforeAll(async () => {
    const document: unknown = JSON.parse(await readFile(new URL('../public/config.json', import.meta.url), 'utf8'));
    config = new InitializerConfig(document, new URL('https://initializer.example/config.json'));
});

test('renderer and Java choices respect the platform matrix', () => {
    expect(supportsRenderer(config, 'GL41', ['windows', 'macos'])).toBe(true);
    expect(supportsRenderer(config, 'GL43', ['macos'])).toBe(false);
    expect(supportsRenderer(config, 'GL45', ['windows', 'macos', 'ios'])).toBe(false);
    expect(supportsRenderer(config, 'GL32', ['android'])).toBe(false);
    expect(supportsJavaVersion(config, 25, ['windows', 'linux'])).toBe(true);
    expect(supportsJavaVersion(config, 25, ['windows', 'ios'])).toBe(false);
    expect(supportsCoreModule(config.coreModule('jme3-awt-dialogs'), ['windows', 'linux'])).toBe(true);
    expect(supportsCoreModule(config.coreModule('jme3-awt-dialogs'), ['windows', 'macos'])).toBe(false);
});

test('compatibility and launcher selection are per operating system', () => {
    expect(compatible(desktop, ['desktop'])).toBe(true);
    expect(compatible(desktop, ['desktop', 'android'])).toBe(false);
    expect(launcherModules(config, ['windows', 'linux', 'android'])).toEqual(['desktop', 'android']);
});

test('default core modules come entirely from compatible JSON metadata', () => {
    expect(defaultCoreModules(config.coreModules, ['windows', 'linux', 'macos'])).toEqual([
        'jme3-effects', 'jme3-jbullet', 'jme3-networking', 'jme3-niftygui', 'jme3-plugins', 'jme3-terrain'
    ]);
});

test('catalog topics preserve backend order and images are restricted', () => {
    expect(catalogTopics(['java', 'z-popular', 'a-less-popular', 'z-popular'])).toEqual(['z-popular', 'a-less-popular']);
    expect(safeImage('javascript:alert(1)')).toBe('');
    expect(safeImage('https://unrelated.example/image.png')).toBe('');
    expect(safeImage('https://raw.githubusercontent.com/a/b/main/image.png')).toBe('https://raw.githubusercontent.com/a/b/main/image.png');
});
