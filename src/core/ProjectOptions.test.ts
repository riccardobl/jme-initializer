import {describe, expect, test} from 'vitest';
import {ModuleGradle} from './ModuleGradle';
import {ProjectOptions} from './ProjectOptions';
import type {LibraryModule} from './types';

describe('ProjectOptions', () => {
    test('desktop shorthand preserves all operating systems in one launcher', () => {
        const options: ProjectOptions = new ProjectOptions('Space Racer', '', ['desktop', 'android'], 11, 'GLES3', []);
        expect(options.packageName).toBe('com.spaceracer');
        expect(options.platforms).toEqual(['windows', 'linux', 'macos', 'android']);
        expect(options.launcherModules()).toEqual(['desktop', 'android']);
        expect(new ProjectOptions('Game', 'game', ['windows'], 11, 'GLES3', []).packageName).toBe('game');
    });

    test('rejects invalid platform, Java, renderer, package and module input', () => {
        expect(() => new ProjectOptions('../game', 'com.game', ['desktop'], 11, 'GLES3', [])).toThrow();
        expect(() => new ProjectOptions('Game', 'com.class', ['desktop'], 11, 'GLES3', [])).toThrow();
        expect(() => new ProjectOptions('Game', 'com.game', ['ios'], 25, 'GLES3', [])).toThrow();
        expect(() => new ProjectOptions('Game', 'com.game', ['ios'], 21, 'GL32', [])).toThrow();
        expect(() => new ProjectOptions('Game', 'com.game', [], 11, 'GLES3', [])).toThrow();
        expect(() => new ProjectOptions('Game', 'com.game', ['desktop'], 11, 'GL50', [])).toThrow();
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
        const gradle: ModuleGradle = new ModuleGradle([module]);
        expect(gradle.repositories()).toContain('https://maven.pkg.github.com/author/project');
        expect(gradle.repositories()).toContain('includeGroup("com.github.author")');
        expect(gradle.dependencies()).toContain('runtimeOnly("com.example:native:1.0:natives-linux")');
        expect(gradle.dependencies()).toContain('org.jmonkeyengine:jme3-terrain:3.10.0-beta2');
        expect(gradle.dependencies()).not.toContain('jme3-desktop');
        expect(ModuleGradle.quote('$value"')).toBe('"\\$value\\""');
    });
});
