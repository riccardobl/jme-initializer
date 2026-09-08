import {readFile} from 'node:fs/promises';
import {beforeAll, describe, expect, test} from 'vitest';
import {InitializerConfig} from '../config';
import {EngineModuleGradle} from './EngineModuleGradle';
import {ModuleGradle} from './ModuleGradle';
import {ProjectOptions} from './ProjectOptions';
import type {LibraryModule} from './types';

let config: InitializerConfig;

beforeAll(async () => {
    const document: unknown = JSON.parse(await readFile(new URL('../../public/config.json', import.meta.url), 'utf8'));
    config = new InitializerConfig(document, new URL('https://initializer.example/config.json'));
});

describe('ProjectOptions', () => {
    test('desktop shorthand preserves all operating systems in one launcher', () => {
        const options: ProjectOptions = new ProjectOptions(config, 'Space Racer', '', ['desktop', 'android'], 11, 'GLES3', [], [], 'safer', false);
        expect(options.packageName).toBe('com.spaceracer');
        expect(options.platforms).toEqual(['windows', 'linux', 'macos', 'android']);
        expect(options.launcherModules()).toEqual(['desktop', 'android']);
        expect(new ProjectOptions(config, 'Game', 'game', ['windows'], 11, 'GLES3', [], [], 'safer', false).packageName).toBe('game');
    });

    test('rejects invalid platform, Java, renderer, package and module input', () => {
        expect(() => new ProjectOptions(config, '../game', 'com.game', ['desktop'], 11, 'GLES3', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.class', ['desktop'], 11, 'GLES3', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['ios'], 25, 'GLES3', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['ios'], 21, 'GL32', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', [], 11, 'GLES3', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['desktop'], 11, 'GL50', [], [], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['macos'], 11, 'GLES3', [], ['jme3-awt-dialogs'], 'safer', false)).toThrow();
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['windows'], 11, 'GLES3', [], [], 'safer', true)).toThrow();
    });

    test('core modules, allocator and legacy iOS dependencies come from configuration', () => {
        const options = new ProjectOptions(config, 'Game', 'com.game', ['windows', 'ios'], 21, 'GLES3', [],
            ['jme3-effects'], 'safer', true);
        const gradle = new EngineModuleGradle(options);

        expect(gradle.dependencies('app')).toContain('jme3-core:3.10.0-beta2');
        expect(gradle.dependencies('app')).toContain('jme3-effects:3.10.0-beta2');
        expect(gradle.dependencies('app')).toContain('jme3-saferallocator:3.10.0-beta2');
        expect(gradle.dependencies('ios')).toContain('exclude(group = "org.ngengine", module = "libjglios-angle-ios")');
        expect(gradle.dependencies('ios')).toContain('org.ngengine:libjglios-legacy-core-ios:0.10');
        expect(gradle.dependencies('ios')).toContain('org.ngengine:libjglios-sdl3-ios:0.10');
    });

    test('uses native OpenGL on macOS and rejects unsupported profiles', () => {
        const options = new ProjectOptions(config, 'Game', 'com.game', ['macos'], 21, 'GL41', [], [], 'safer', false);
        expect(options.rendererSettingExpression()).toBe('AppSettings.LWJGL_OPENGL41');
        expect(() => new ProjectOptions(config, 'Game', 'com.game', ['macos'], 21, 'GL43', [], [], 'safer', false)).toThrow();
    });
});

describe('ModuleGradle', () => {
    test('integrates the complete structured publication graph', () => {
        const module: LibraryModule = {
            githubRepositoryId: 42,
            artifacts: [
                {groupId: 'com.example', artifactId: 'one', version: '1.0', registry: 'GITHUB_PACKAGES', registryOwner: 'author', registryRepository: 'project'},
                {groupId: 'com.github.author', artifactId: 'two', version: 'v2', registry: 'JITPACK'}
            ],
            engineDependencies: [{groupId: 'org.jmonkeyengine', artifactId: 'jme3-terrain'}, {groupId: 'org.jmonkeyengine', artifactId: 'jme3-desktop'}],
            recommendedRuntimeDependencies: [{groupId: 'com.example', artifactId: 'native', version: '1.0', classifier: 'natives-linux'}],
            dependencies: [{groupId: 'another.group', artifactId: 'transitive', registry: 'GITHUB_PACKAGES', registryOwner: 'other', registryRepository: 'repo'}]
        };
        const gradle: ModuleGradle = new ModuleGradle([module], config.jmeVersion);
        expect(gradle.repositories()).toContain('https://maven.pkg.github.com/author/project');
        expect(gradle.repositories()).toContain('includeGroup("com.github.author")');
        expect(gradle.dependencies()).toContain('runtimeOnly("com.example:native:1.0:natives-linux")');
        expect(gradle.dependencies()).toContain('org.jmonkeyengine:jme3-terrain:3.10.0-beta2');
        expect(gradle.dependencies()).not.toContain('jme3-desktop');
        expect(ModuleGradle.quote('$value"')).toBe('"\\$value\\""');
    });
});
