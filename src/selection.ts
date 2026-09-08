import {ProjectOptions} from './core/ProjectOptions';
import type {LibraryModule} from './core/types';

export const hiddenTopics: Set<string> = new Set(['jmonkey', 'jmonkeyengine', 'jmonkeyengine3', 'jme3', 'java',
    'java-library', 'jvm', 'jvm-library', 'library', 'libraries', 'open-source', 'opensource']);

export function suggestedPackage(name: string): string {
    return ProjectOptions.suggestedPackage(name);
}

export function packageForGameName(name: string, current: string, edited: boolean): string {
    return edited ? current : suggestedPackage(name);
}

export function launcherModules(platforms: readonly string[]): string[] {
    return [...new Set(platforms.map((platform: string): string =>
        ['windows', 'linux', 'macos'].includes(platform) ? 'desktop' : platform))];
}

export function supportsNativeOpenGL(platforms: readonly string[]): boolean {
    return platforms.some((platform: string): boolean => ['windows', 'linux', 'macos'].includes(platform));
}

export function supportsRenderer(renderer: string, platforms: readonly string[]): boolean {
    return renderer === 'GLES3' || (supportsNativeOpenGL(platforms)
        && !(platforms.includes('macos') && ['GL43', 'GL45'].includes(renderer)));
}

export function supportsJava25(platforms: readonly string[]): boolean {
    return !platforms.some((platform: string): boolean => platform === 'android' || platform === 'ios');
}

export function compatible(module: LibraryModule, platforms: readonly string[]): boolean {
    const supported: Set<string> = new Set((module.platforms ?? []).map(platform => platform.operatingSystem ?? ''));
    return platforms.every((platform: string): boolean => (platform === 'desktop' ? ['WINDOWS', 'LINUX', 'MACOS']
        : [platform.toUpperCase()]).every((name: string): boolean => supported.has(name)));
}

export function hiddenModules(pageModules: readonly LibraryModule[], platforms: readonly string[]): LibraryModule[] {
    return pageModules.filter((module: LibraryModule): boolean => !compatible(module, platforms));
}

export function categoryOptions(tags: readonly string[], expanded: boolean, selected: string): string[] {
    return tags.filter((topic: string, index: number): boolean => expanded || index < 8 || topic === selected);
}

export function catalogTopics(tags: readonly string[]): string[] {
    return [...new Set(tags)].filter((topic: string): boolean => !hiddenTopics.has(topic.toLowerCase()));
}

export function safeImage(value: string): string {
    try {
        const url: URL = new URL(value);
        const hosts: Set<string> = new Set(['raw.githubusercontent.com', 'user-images.githubusercontent.com',
            'private-user-images.githubusercontent.com', 'i.imgur.com', 'opengraph.githubassets.com',
            'avatars.githubusercontent.com', 'github.com']);
        return url.protocol === 'https:' && !url.username && !url.password && hosts.has(url.hostname) ? url.href : '';
    } catch {
        return '';
    }
}

export function rendererDescription(renderer: string): string {
    if (renderer === 'GLES3') return 'Modern graphics backends suited to each platform, with a unified OpenGL ES 3 API for the engine.';
    return 'Native OpenGL where available, OpenGL ES elsewhere. Can offer better performance and more advanced graphics features on some platforms.';
}

export function rendererSummary(renderer: string): string {
    if (renderer === 'GLES3') return 'Recommended for better cross-platform compatibility and easier testing.';
    return 'More flexibility, but you’ll need to spend more time testing compatibility across platforms.';
}

export function moduleAuthor(module: LibraryModule): {name: string; url: string | null} {
    const login: string | undefined = module.owner ?? module.author?.githubAccount;
    return {
        name: module.author?.name ?? module.author?.githubAccount ?? module.owner ?? 'Unknown author',
        url: login === undefined ? null : `https://jmonkeyengine.org/library/?q=${encodeURIComponent(`author:${login}`)}`
    };
}
