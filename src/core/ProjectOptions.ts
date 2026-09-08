import {InitializerConfig, type EngineModuleDefinition, type RendererDefinition} from '../config';

const JAVA_KEYWORDS: Set<string> = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(' '));

/** A validated selection against the repository-provided initializer configuration. */
export class ProjectOptions {
    public readonly config: InitializerConfig;
    public readonly gameName: string;
    public readonly packageName: string;
    public readonly platforms: readonly string[];
    public readonly javaVersion: number;
    public readonly renderer: string;
    public readonly modules: readonly number[];
    public readonly coreModules: readonly string[];
    public readonly allocator: string;
    public readonly iosLegacy: boolean;

    public constructor(config: InitializerConfig, gameName: string, packageName: string, platforms: readonly string[],
                       javaVersion: number, renderer: string, modules: readonly number[], coreModules: readonly string[],
                       allocator: string, iosLegacy: boolean) {
        this.config = config;
        if (!/^[A-Za-z][A-Za-z0-9 _-]{0,63}$/.test(gameName)) {
            throw new Error('Use a project name starting with a letter, up to 64 characters.');
        }
        this.gameName = gameName;
        this.packageName = packageName.trim().length === 0 ? ProjectOptions.suggestedPackage(gameName) : packageName;
        if (this.packageName.length > 160 || !ProjectOptions.isJavaPackage(this.packageName)) {
            throw new Error('Enter a valid Java package name.');
        }

        const expandedPlatforms: string[] = [];
        for (const platform of platforms) {
            const values: string[] = platform === 'desktop'
                ? config.platforms.filter(item => item.launcher === 'desktop').map(item => item.id) : [platform];
            for (const value of values) if (!expandedPlatforms.includes(value)) expandedPlatforms.push(value);
        }
        if (expandedPlatforms.length === 0 || expandedPlatforms.some((value: string): boolean =>
            !config.platforms.some(item => item.id === value))) {
            throw new Error(`Select one of the configured platforms: ${config.platforms.map(item => item.name).join(', ')}.`);
        }
        const java = config.javaVersion(javaVersion);
        if (!ProjectOptions.compatiblePlatforms(java.platforms, expandedPlatforms)) {
            throw new Error(`${java.name} is not compatible with every selected platform.`);
        }
        const rendererDefinition: RendererDefinition = config.renderer(renderer);
        if (!ProjectOptions.compatiblePlatforms(rendererDefinition.platforms, expandedPlatforms)
            || (rendererDefinition.requiresAnyPlatform.length > 0
                && !rendererDefinition.requiresAnyPlatform.some((platform: string): boolean => expandedPlatforms.includes(platform)))) {
            throw new Error(`${config.renderer(renderer).name} is not compatible with the selected platform combination.`);
        }

        const distinctModules: number[] = [...new Set(modules)];
        if (distinctModules.length > 64 || distinctModules.some((id: number): boolean => !Number.isSafeInteger(id) || id <= 0)) {
            throw new Error('Select at most 64 valid community modules.');
        }
        const distinctCoreModules: string[] = [...new Set(coreModules)];
        if (distinctCoreModules.length > config.coreModules.length) throw new Error('Too many core modules were selected.');
        for (const identifier of distinctCoreModules) {
            const module: EngineModuleDefinition = config.coreModule(identifier);
            if (!ProjectOptions.compatiblePlatforms(module.platforms, expandedPlatforms)) {
                throw new Error(`${module.name ?? module.id} is not compatible with every selected platform.`);
            }
        }
        const selectedAllocator = config.allocator(allocator);
        if (!ProjectOptions.compatiblePlatforms(selectedAllocator.platforms, expandedPlatforms)) {
            throw new Error(`${selectedAllocator.name} is not compatible with every selected platform.`);
        }
        if (iosLegacy && !expandedPlatforms.some((platform: string): boolean => config.platform(platform).legacyOption)) {
            throw new Error('The legacy iOS backend requires the iOS platform.');
        }

        this.platforms = expandedPlatforms;
        this.javaVersion = javaVersion;
        this.renderer = renderer;
        this.modules = distinctModules;
        this.coreModules = distinctCoreModules;
        this.allocator = allocator;
        this.iosLegacy = iosLegacy;
    }

    public androidMinSdk(): number {
        return this.config.javaVersion(this.javaVersion).androidMinSdk ?? this.config.androidTargetSdk;
    }

    public launcherModules(): string[] {
        const modules: string[] = [];
        for (const platform of this.platforms) {
            const launcher: string = this.config.platform(platform).launcher;
            if (!modules.includes(launcher)) modules.push(launcher);
        }
        return modules;
    }

    public profiles(): Set<string> {
        const profiles: Set<string> = new Set(this.launcherModules().map((module: string): string => module.toUpperCase()));
        for (const platform of this.platforms) profiles.add(platform.toUpperCase());
        for (const identifier of this.coreModules) {
            for (const profile of this.config.coreModule(identifier).profiles) profiles.add(profile);
        }
        if (this.iosLegacy) profiles.add('IOS_LEGACY');
        return profiles;
    }

    public rendererSettingExpression(): string {
        const renderer: RendererDefinition = this.config.renderer(this.renderer);
        const desktopPlatforms: string[] = this.platforms.filter((platform: string): boolean =>
            this.config.platform(platform).launcher === 'desktop');
        const mappings: {platform: string; setting: string}[] = desktopPlatforms.map((platform: string) => {
            const setting: string | undefined = renderer.settingsByPlatform[platform];
            if (setting === undefined) throw new Error(`${renderer.name} does not define a desktop setting for ${platform}.`);
            return {platform, setting};
        });
        if (mappings.length === 0) return 'AppSettings.ANGLE_GLES3';
        if (mappings.every(item => item.setting === mappings[0]?.setting)) return `AppSettings.${mappings[0]?.setting}`;
        const fallback: {platform: string; setting: string} = mappings[mappings.length - 1] as {platform: string; setting: string};
        let expression: string = `AppSettings.${fallback.setting}`;
        for (let index: number = mappings.length - 2; index >= 0; index--) {
            const mapping: {platform: string; setting: string} = mappings[index] as {platform: string; setting: string};
            expression = `platform.equals(${ProjectOptions.javaString(mapping.platform)}) ? AppSettings.${mapping.setting} : ${expression}`;
        }
        return expression;
    }

    public directoryName(): string {
        return this.gameName.replace(/[^A-Za-z0-9_-]/g, '');
    }

    public static suggestedPackage(name: string): string {
        let segment: string = name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mygame';
        if (/^[0-9]/.test(segment)) segment = `game${segment}`;
        if (JAVA_KEYWORDS.has(segment)) segment += 'game';
        return `com.${segment}`;
    }

    private static javaString(value: string): string {
        return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
    }

    private static compatiblePlatforms(supported: readonly string[] | undefined, selected: readonly string[]): boolean {
        return supported === undefined || selected.every((platform: string): boolean => supported.includes(platform));
    }

    private static isJavaPackage(value: string): boolean {
        const parts: string[] = value.split('.');
        return parts.length > 0 && parts.every((part: string): boolean =>
            /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) && !JAVA_KEYWORDS.has(part));
    }
}
