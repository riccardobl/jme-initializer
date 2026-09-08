import {expect, test} from 'vitest';
import type {LibraryModule} from './core/types';
import {catalogTopics, compatible, launcherModules, safeImage, supportsJava25, supportsRenderer} from './selection';

const desktop: LibraryModule = {platforms: ['WINDOWS', 'LINUX', 'MACOS'].map(operatingSystem => ({operatingSystem}))};

test('renderer and Java choices respect the platform matrix', () => {
    expect(supportsRenderer('GL41', ['windows', 'macos'])).toBe(true);
    expect(supportsRenderer('GL43', ['windows', 'macos'])).toBe(false);
    expect(supportsRenderer('GL32', ['android'])).toBe(false);
    expect(supportsJava25(['windows', 'linux'])).toBe(true);
    expect(supportsJava25(['windows', 'ios'])).toBe(false);
});

test('compatibility and launcher selection are per operating system', () => {
    expect(compatible(desktop, ['desktop'])).toBe(true);
    expect(compatible(desktop, ['desktop', 'android'])).toBe(false);
    expect(launcherModules(['windows', 'linux', 'android'])).toEqual(['desktop', 'android']);
});

test('catalog topics preserve backend order and images are restricted', () => {
    expect(catalogTopics(['java', 'z-popular', 'a-less-popular', 'z-popular'])).toEqual(['z-popular', 'a-less-popular']);
    expect(safeImage('javascript:alert(1)')).toBe('');
    expect(safeImage('https://unrelated.example/image.png')).toBe('');
    expect(safeImage('https://raw.githubusercontent.com/a/b/main/image.png')).toBe('https://raw.githubusercontent.com/a/b/main/image.png');
});
