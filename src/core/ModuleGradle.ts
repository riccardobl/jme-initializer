import type {ArtifactCoordinate, LibraryModule} from './types';

class Dependency {
    public readonly configuration: string;
    public readonly exclusions: Set<string>;

    public constructor(configuration: string, exclusions: Iterable<string>) {
        this.configuration = configuration;
        this.exclusions = new Set(exclusions);
    }
}

/** Java-like port of the server-side structured Gradle metadata integrator. */
export class ModuleGradle {
    private static readonly PLATFORM_ENGINE_MODULES: Set<string> = new Set([
        'jme3-desktop', 'jme3-lwjgl', 'jme3-lwjgl3', 'jme3-android', 'jme3-android-native',
        'jme3-ios', 'jme3-jogl', 'jme3-jogg', 'jme3-awt-dialogs'
    ]);

    private readonly github: Map<string, Set<string>> = new Map();
    private readonly jitpack: Set<string> = new Set();
    private readonly dependencyMap: Map<string, Dependency> = new Map();
    private readonly sharedEngineModules: Set<string> = new Set();
    private readonly jmeVersion: string;

    public constructor(modules: readonly LibraryModule[], jmeVersion: string) {
        this.jmeVersion = jmeVersion;
        for (const module of modules) {
            const exclusions: Set<string> = new Set(['org.jmonkeyengine']);
            for (const dependency of module.engineDependencies ?? []) {
                const group: string = ModuleGradle.required(dependency, 'groupId');
                const artifact: string = ModuleGradle.required(dependency, 'artifactId');
                exclusions.add(group);
                if (group === 'org.jmonkeyengine' && !ModuleGradle.PLATFORM_ENGINE_MODULES.has(artifact)
                    && !['jme3-core', 'jme3-effects', 'jme3-plugins'].includes(artifact)) {
                    this.sharedEngineModules.add(`${group}:${artifact}:${this.jmeVersion}`);
                }
            }
            const roots: ArtifactCoordinate[] = [...(module.artifacts ?? [])];
            if (roots.length === 0 && module.rootArtifact !== undefined) roots.push(module.rootArtifact);
            if (roots.length === 0) throw new Error('A selected module has no published artifacts.');
            for (const root of roots) this.add(root, 'implementation', exclusions);
            for (const dependency of module.recommendedRuntimeDependencies ?? []) {
                this.add(dependency, 'runtimeOnly', exclusions);
            }
            for (const dependency of module.dependencies ?? []) this.register(dependency);
        }
    }

    private add(coordinate: ArtifactCoordinate, configuration: string, exclusions: Set<string>): void {
        let notation: string = `${ModuleGradle.required(coordinate, 'groupId')}:${ModuleGradle.required(coordinate, 'artifactId')}:${ModuleGradle.required(coordinate, 'version')}`;
        const classifier: string = coordinate.classifier ?? '';
        if (classifier.trim().length > 0) notation += `:${classifier}`;
        const previous: Dependency | undefined = this.dependencyMap.get(notation);
        const merged: Set<string> = new Set(exclusions);
        if (previous !== undefined) {
            for (const exclusion of previous.exclusions) merged.add(exclusion);
            if (previous.configuration === 'implementation') configuration = 'implementation';
        }
        this.dependencyMap.set(notation, new Dependency(configuration, merged));
        this.register(coordinate);
    }

    private register(coordinate: ArtifactCoordinate): void {
        switch (coordinate.registry ?? 'MAVEN_CENTRAL') {
            case 'MAVEN_CENTRAL':
                return;
            case 'JITPACK':
                this.jitpack.add(ModuleGradle.required(coordinate, 'groupId'));
                return;
            case 'GITHUB_PACKAGES': {
                const owner: string = ModuleGradle.required(coordinate, 'registryOwner');
                const repository: string = ModuleGradle.required(coordinate, 'registryRepository');
                if (!/^[A-Za-z0-9_-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repository)) {
                    throw new Error('Invalid GitHub Packages repository metadata.');
                }
                const key: string = `${owner}/${repository}`;
                const modules: Set<string> = this.github.get(key) ?? new Set<string>();
                modules.add(`${ModuleGradle.required(coordinate, 'groupId')}:${ModuleGradle.required(coordinate, 'artifactId')}`);
                this.github.set(key, modules);
                return;
            }
            default:
                throw new Error('Unsupported module artifact registry.');
        }
    }

    public repositories(): string {
        let script: string = '        google()\n        mavenCentral()\n';
        for (const repository of [...this.github.keys()].sort()) {
            const modules: Set<string> = this.github.get(repository) ?? new Set();
            script += `        maven {\n            name = ${ModuleGradle.quote(`GitHubPackages_${repository.replace(/[^A-Za-z0-9]/g, '_')}`)}\n`;
            script += `            url = uri(${ModuleGradle.quote(`https://maven.pkg.github.com/${repository}`)})\n`;
            script += '            credentials {\n                username = providers.environmentVariable("GITHUB_PACKAGES_USERNAME").orNull\n';
            script += '                password = providers.environmentVariable("GITHUB_PACKAGES_TOKEN").orNull\n            }\n            content {\n';
            for (const module of [...modules].sort()) {
                const separator: number = module.indexOf(':');
                script += `                includeModule(${ModuleGradle.quote(module.slice(0, separator))}, ${ModuleGradle.quote(module.slice(separator + 1))})\n`;
            }
            script += '            }\n        }\n';
        }
        if (this.jitpack.size > 0) {
            script += '        maven {\n            name = "JitPack"\n            url = uri("https://jitpack.io")\n            content {\n';
            for (const group of [...this.jitpack].sort()) script += `                includeGroup(${ModuleGradle.quote(group)})\n`;
            script += '            }\n        }\n';
        }
        return script;
    }

    public dependencies(): string {
        let script: string = '';
        for (const notation of [...this.sharedEngineModules].sort()) {
            script += `    implementation(${ModuleGradle.quote(notation)})\n`;
        }
        for (const [notation, dependency] of this.dependencyMap.entries()) {
            script += `    ${dependency.configuration}(${ModuleGradle.quote(notation)}) {\n`;
            for (const group of [...dependency.exclusions].sort()) {
                script += `        exclude(group = ${ModuleGradle.quote(group)})\n`;
            }
            script += '    }\n';
        }
        return script;
    }

    public static required(coordinate: ArtifactCoordinate, field: keyof ArtifactCoordinate): string {
        const value: unknown = coordinate[field];
        if (typeof value !== 'string' || value.trim().length === 0 || value.length > 512 || /[\u0000-\u001f\u007f]/.test(value)) {
            throw new Error(`Incomplete module publication metadata: ${String(field)}`);
        }
        return value;
    }

    public static quote(value: string): string {
        return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('$', '\\$').replaceAll('\n', '\\n').replaceAll('\r', '\\r')}"`;
    }
}
