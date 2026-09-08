import {InitializerConfig, type AllocatorDefinition, type EngineModuleDefinition,
    type JavaVersionDefinition, type RendererDefinition} from './config';
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

export function launcherModules(config: InitializerConfig, platforms: readonly string[]): string[] {
    return [...new Set(platforms.map((platform: string): string => config.platform(platform).launcher))];
}

export function supportsRenderer(config: InitializerConfig, rendererId: string, platforms: readonly string[]): boolean {
    const renderer: RendererDefinition = config.renderer(rendererId);
    return compatiblePlatforms(renderer.platforms, platforms)
        && (renderer.requiresAnyPlatform.length === 0
            || renderer.requiresAnyPlatform.some((platform: string): boolean => platforms.includes(platform)));
}

export function supportsJavaVersion(config: InitializerConfig, version: number, platforms: readonly string[]): boolean {
    const definition: JavaVersionDefinition = config.javaVersion(version);
    return compatiblePlatforms(definition.platforms, platforms);
}

export function supportsCoreModule(module: EngineModuleDefinition, platforms: readonly string[]): boolean {
    return compatiblePlatforms(module.platforms, platforms);
}

export function defaultCoreModules(modules: readonly EngineModuleDefinition[], platforms: readonly string[]): string[] {
    return modules.filter((module: EngineModuleDefinition): boolean => module.selectedByDefault
        && supportsCoreModule(module, platforms)).map((module: EngineModuleDefinition): string => module.id);
}

export function supportsAllocator(allocator: AllocatorDefinition, platforms: readonly string[]): boolean {
    return compatiblePlatforms(allocator.platforms, platforms);
}

export function compatiblePlatforms(supported: readonly string[] | undefined, selected: readonly string[]): boolean {
    return supported === undefined || selected.every((platform: string): boolean => supported.includes(platform));
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

export function moduleAuthor(module: LibraryModule): {name: string; url: string | null} {
    const login: string | undefined = module.owner ?? module.author?.githubAccount;
    return {
        name: module.author?.name ?? module.author?.githubAccount ?? module.owner ?? 'Unknown author',
        url: login === undefined ? null : `https://jmonkeyengine.org/library/?q=${encodeURIComponent(`author:${login}`)}`
    };
}
