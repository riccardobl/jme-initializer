const JAVA_KEYWORDS: Set<string> = new Set('abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null'.split(' '));

/** One supported engine release and an explicitly validated platform matrix. */
export class ProjectOptions {
    public static readonly JME_VERSION: string = '3.10.0-beta2';
    public static readonly RENDERERS: readonly string[] = ['GLES3', 'GL32', 'GL41', 'GL43', 'GL45'];
    public static readonly PLATFORM_KEYS: readonly string[] = ['windows', 'linux', 'macos', 'android', 'ios'];

    public readonly gameName: string;
    public readonly packageName: string;
    public readonly platforms: readonly string[];
    public readonly javaVersion: number;
    public readonly renderer: string;
    public readonly modules: readonly number[];

    public constructor(gameName: string, packageName: string, platforms: readonly string[],
                       javaVersion: number, renderer: string, modules: readonly number[]) {
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
            const values: string[] = platform === 'desktop' ? ['windows', 'linux', 'macos'] : [platform];
            for (const value of values) if (!expandedPlatforms.includes(value)) expandedPlatforms.push(value);
        }
        if (expandedPlatforms.length === 0 || expandedPlatforms.some((value: string): boolean => !ProjectOptions.PLATFORM_KEYS.includes(value))) {
            throw new Error('Select Windows, Linux, macOS, Android, or iOS.');
        }
        if (![11, 21, 25].includes(javaVersion)) throw new Error('Unsupported Java version.');
        if (javaVersion === 25 && (expandedPlatforms.includes('ios') || expandedPlatforms.includes('android'))) {
            throw new Error('Android and iOS templates support Java 11 or 21. Java 25 is desktop-only.');
        }
        if (!ProjectOptions.RENDERERS.includes(renderer)) throw new Error('Unsupported renderer.');
        if (!expandedPlatforms.some((value: string): boolean => ['windows', 'linux', 'macos'].includes(value)) && renderer !== 'GLES3') {
            throw new Error('Native OpenGL requires a desktop platform.');
        }
        if (expandedPlatforms.includes('macos') && ['GL43', 'GL45'].includes(renderer)) {
            throw new Error('macOS supports native OpenGL up to 4.1.');
        }

        const distinctModules: number[] = [...new Set(modules)];
        if (distinctModules.length > 64 || distinctModules.some((id: number): boolean => !Number.isSafeInteger(id) || id <= 0)) {
            throw new Error('Select at most 64 valid modules.');
        }
        this.platforms = expandedPlatforms;
        this.javaVersion = javaVersion;
        this.renderer = renderer;
        this.modules = distinctModules;
    }

    public androidMinSdk(): number {
        return this.javaVersion === 11 ? 30 : 35;
    }

    public launcherModules(): string[] {
        const modules: string[] = [];
        for (const platform of this.platforms) {
            const module: string = ['windows', 'linux', 'macos'].includes(platform) ? 'desktop' : platform;
            if (!modules.includes(module)) modules.push(module);
        }
        return modules;
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

    private static isJavaPackage(value: string): boolean {
        const parts: string[] = value.split('.');
        return parts.length > 0 && parts.every((part: string): boolean =>
            /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(part) && !JAVA_KEYWORDS.has(part));
    }
}
