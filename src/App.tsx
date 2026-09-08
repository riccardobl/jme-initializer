import {useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactElement} from 'react';
import logoUrl from './assets/jme-logo.webp';
import defaultGameIconUrl from './assets/default-game-icon.png';
import {InitializerConfig, type AllocatorDefinition, type EngineModuleDefinition,
    type JavaVersionDefinition, type PlatformDefinition, type RendererDefinition} from './config';
import {CatalogClient} from './core/CatalogClient';
import {GameIcon} from './core/GameIcon';
import {InitializerZipService} from './core/InitializerZipService';
import {ProjectOptions} from './core/ProjectOptions';
import type {LibraryModule} from './core/types';
import {catalogTopics, categoryOptions, compatible, defaultCoreModules, hiddenModules, launcherModules, moduleAuthor,
    packageForGameName, safeImage, suggestedPackage, supportsAllocator, supportsCoreModule,
    supportsJavaVersion, supportsRenderer} from './selection';

const OS_NAMES: Record<string, string> = {WINDOWS: 'Windows', LINUX: 'Linux', MACOS: 'macOS', ANDROID: 'Android', IOS: 'iOS'};
const embedded: boolean = window.parent !== window || new URLSearchParams(window.location.search).get('embed') === '1';
document.documentElement.classList.toggle('embedded', embedded);

function PlatformIcon({platform}: {platform: string}): ReactElement {
    const mobile: boolean = ['android', 'ios', 'ANDROID', 'IOS'].includes(platform);
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        {mobile ? <><rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 18h4M10 5h4"/></>
            : <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>}
    </svg>;
}

function ModuleCard({module, selected, toggle}: {module: LibraryModule; selected: boolean; toggle: () => void}): ReactElement {
    const author: {name: string; url: string | null} = moduleAuthor(module);
    const title: string = module.displayName ?? module.name ?? 'Community module';
    const [imageFailed, setImageFailed] = useState<boolean>(false);
    const image: string | undefined = (module.images ?? []).map(safeImage).find(Boolean);
    const id: string = String(module.githubRepositoryId);
    return <article className={`module-card ${selected ? 'selected' : ''}`}>
        <label className="module-choice" htmlFor={`module-${id}`}>
            <input id={`module-${id}`} type="checkbox" checked={selected} onChange={toggle}/>
            <span className="module-image">{image !== undefined && !imageFailed
                ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/>
                : <span aria-hidden="true">{title.slice(0, 1)}</span>}</span>
            <span className="module-copy"><strong>{title}</strong><span className="module-author">by {author.url !== null
                ? <a href={author.url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>{author.name}</a>
                : author.name}</span><span className="module-description">{module.description ?? 'A community module for jMonkeyEngine.'}</span>
                <span className="module-platforms">{(module.platforms ?? []).filter(platform => OS_NAMES[platform.operatingSystem ?? ''] !== undefined)
                    .map(platform => <span key={platform.operatingSystem} title={OS_NAMES[platform.operatingSystem ?? '']}>
                        <PlatformIcon platform={platform.operatingSystem ?? ''}/><span>{OS_NAMES[platform.operatingSystem ?? '']}</span></span>)}</span>
            </span>
        </label>
        <a className="module-details" href={`https://jmonkeyengine.org/library/?module=${encodeURIComponent(id)}`}
            target="_blank" rel="noopener noreferrer" aria-label={`Details about ${title} (opens in a new tab)`}>↗</a>
    </article>;
}

function CoreModuleCard({module, selected, enabled, toggle}: {module: EngineModuleDefinition; selected: boolean;
    enabled: boolean; toggle: () => void}): ReactElement {
    const compatibility: string = module.platforms === undefined ? 'All platforms'
        : `Compatible with ${module.platforms.join(', ')}`;
    return <label className={`core-module ${selected ? 'selected' : ''} ${enabled ? '' : 'disabled'}`}
        title={enabled ? compatibility : `${compatibility}. Disabled by the selected platforms.`}>
        <input type="checkbox" checked={selected} disabled={!enabled} onChange={toggle}/>
        <span><strong>{module.name}</strong><code>{module.id}</code><span>{module.description}</span></span>
    </label>;
}

function AllocatorCard({allocator, selected, enabled, select}: {allocator: AllocatorDefinition; selected: boolean;
    enabled: boolean; select: () => void}): ReactElement {
    return <label className={`allocator-option ${selected ? 'selected' : ''} ${enabled ? '' : 'disabled'}`}>
        <input type="radio" name="allocator" value={allocator.id} checked={selected} disabled={!enabled} onChange={select}/>
        <span><strong>{allocator.name}{allocator.recommended ? ' — recommended' : ''}</strong><span>{allocator.description}</span></span>
    </label>;
}

function HiddenModulesNotice({modules}: {modules: readonly LibraryModule[]}): ReactElement {
    const [open, setOpen] = useState<boolean>(false);
    return <div className="hidden-modules-note" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <button type="button" className="hidden-modules-trigger" aria-describedby={open ? 'hidden-modules-tooltip' : undefined}
            onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)}>
            {modules.length} module{modules.length === 1 ? '' : 's'} hidden on this page: incompatible platforms ⓘ
        </button>
        {open && <div id="hidden-modules-tooltip" role="tooltip" className="hidden-modules-tooltip"><strong>Not compatible with your selected platforms:</strong>
            <ul>{modules.map(module => <li key={module.githubRepositoryId}>{module.displayName ?? module.name ?? `Module ${module.githubRepositoryId}`}</li>)}</ul></div>}
    </div>;
}

export function App({configuration}: {configuration: InitializerConfig}): ReactElement {
    const catalog: CatalogClient = useMemo(() => new CatalogClient(configuration.libraryApiBase), [configuration]);
    const generator: InitializerZipService = useMemo(() => new InitializerZipService(configuration.templateArchiveUrl), [configuration]);
    const defaultPlatforms: string[] = configuration.platforms.filter((platform: PlatformDefinition): boolean => platform.launcher === 'desktop')
        .map((platform: PlatformDefinition): string => platform.id);
    const [gameName, setGameName] = useState<string>('My Game');
    const [packageName, setPackageName] = useState<string>(suggestedPackage('My Game'));
    const [packageEdited, setPackageEdited] = useState<boolean>(false);
    const [platforms, setPlatforms] = useState<string[]>(defaultPlatforms);
    const [javaVersion, setJavaVersion] = useState<number>(configuration.recommendedJavaVersion().version);
    const [renderer, setRenderer] = useState<string>(configuration.recommendedRenderer().id);
    const [coreModules, setCoreModules] = useState<string[]>(defaultCoreModules(configuration.coreModules, defaultPlatforms));
    const [allocator, setAllocator] = useState<string>(configuration.recommendedAllocator().id);
    const [iosLegacy, setIosLegacy] = useState<boolean>(false);
    const [gameIcon, setGameIcon] = useState<Uint8Array | undefined>();
    const [iconPreview, setIconPreview] = useState<string>(defaultGameIconUrl);
    const customIconUrl = useRef<string | null>(null);
    const [iconBusy, setIconBusy] = useState<boolean>(false);
    const [modules, setModules] = useState<LibraryModule[]>([]);
    const [selected, setSelected] = useState<number[]>([]);
    const selectedModules = useRef<Map<number, LibraryModule>>(new Map());
    const [page, setPage] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(0);
    const [retry, setRetry] = useState<number>(0);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [query, setQuery] = useState<string>('');
    const [tag, setTag] = useState<string>('');
    const [expandedTags, setExpandedTags] = useState<boolean>(false);
    const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
    const [catalogError, setCatalogError] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [notice, setNotice] = useState<string>('');
    const [busy, setBusy] = useState<boolean>(false);
    const [downloaded, setDownloaded] = useState<boolean>(false);
    const [preview, setPreview] = useState<Map<string, string> | null>(null);

    useEffect(() => {
        const abort: AbortController = new AbortController();
        catalog.tags(abort.signal).then(setAllTags).catch(() => undefined);
        return () => abort.abort();
    }, [catalog]);

    useEffect(() => {
        const abort: AbortController = new AbortController();
        setCatalogState('loading');
        const timer: number = window.setTimeout(() => {
            catalog.listed(page, query, tag, abort.signal).then(result => {
                setModules(result.items); setTotalPages(result.totalPages); setCatalogState('ready');
            }).catch((failure: unknown) => {
                if (abort.signal.aborted) return;
                setModules([]); setCatalogState('error'); setCatalogError(messageOf(failure));
            });
        }, query.length > 0 ? 250 : 0);
        return () => {window.clearTimeout(timer); abort.abort();};
    }, [catalog, page, query, tag, retry]);

    useEffect(() => {
        if (!embedded) return;
        const main: HTMLElement | null = document.querySelector('main');
        if (main === null) return;
        const reportHeight = (): void => window.parent.postMessage(JSON.stringify({
            name: 'jme-initializer-resize', height: Math.ceil(main.getBoundingClientRect().height)
        }), '*');
        const observer: ResizeObserver = new ResizeObserver(reportHeight);
        observer.observe(main); reportHeight();
        return () => observer.disconnect();
    }, []);

    useEffect(() => (): void => {
        if (customIconUrl.current !== null) URL.revokeObjectURL(customIconUrl.current);
    }, []);

    const visible: LibraryModule[] = useMemo(() => modules.filter(module => compatible(module, platforms)), [modules, platforms]);
    const hidden: LibraryModule[] = useMemo(() => hiddenModules(modules, platforms), [modules, platforms]);
    const tags: string[] = useMemo(() => catalogTopics(allTags), [allTags]);
    const rendererDefinition: RendererDefinition = configuration.renderer(renderer);

    function changePlatform(platform: string): void {
        const next: string[] = platforms.includes(platform) ? platforms.filter(value => value !== platform) : [...platforms, platform];
        const keptCommunity: number[] = selected.filter(identifier => compatible(selectedModules.current.get(identifier) ?? {}, next));
        for (const identifier of selected) if (!keptCommunity.includes(identifier)) selectedModules.current.delete(identifier);
        const keptCore: string[] = coreModules.filter(identifier => supportsCoreModule(configuration.coreModule(identifier), next));
        const removed: number = selected.length - keptCommunity.length + coreModules.length - keptCore.length;
        setNotice(removed > 0 ? `${removed} selected module(s) disabled because they do not support all selected platforms.` : '');
        setSelected(keptCommunity); setCoreModules(keptCore); setPlatforms(next);
        if (!supportsJavaVersion(configuration, javaVersion, next)) {
            const replacement: JavaVersionDefinition | undefined = configuration.javaVersions.find(value => supportsJavaVersion(configuration, value.version, next));
            if (replacement !== undefined) setJavaVersion(replacement.version);
        }
        if (!supportsRenderer(configuration, renderer, next)) {
            const replacement: RendererDefinition | undefined = configuration.renderers.find(value => supportsRenderer(configuration, value.id, next));
            if (replacement !== undefined) setRenderer(replacement.id);
        }
        if (!supportsAllocator(configuration.allocator(allocator), next)) {
            const replacement: AllocatorDefinition | undefined = configuration.allocators.find(value => supportsAllocator(value, next));
            if (replacement !== undefined) setAllocator(replacement.id);
        }
        if (!next.some(value => configuration.platform(value).legacyOption)) setIosLegacy(false);
        setTag(''); setPage(0); setPreview(null); setDownloaded(false);
    }

    async function changeGameIcon(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file: File | undefined = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file === undefined) return;
        setIconBusy(true); setError('');
        try {
            const normalized: Uint8Array = await GameIcon.normalize(file);
            if (customIconUrl.current !== null) URL.revokeObjectURL(customIconUrl.current);
            customIconUrl.current = URL.createObjectURL(new Blob([normalized.slice().buffer], {type: 'image/png'}));
            setGameIcon(normalized); setIconPreview(customIconUrl.current); setPreview(null); setDownloaded(false);
        } catch (failure: unknown) {
            setError(messageOf(failure));
        } finally {
            setIconBusy(false);
        }
    }

    function resetGameIcon(): void {
        if (customIconUrl.current !== null) URL.revokeObjectURL(customIconUrl.current);
        customIconUrl.current = null; setGameIcon(undefined); setIconPreview(defaultGameIconUrl); setPreview(null); setDownloaded(false);
    }

    async function generate(event: FormEvent, previewOnly: boolean): Promise<void> {
        event.preventDefault();
        const form: HTMLFormElement | null = document.querySelector('#project-form');
        if (form === null || !form.reportValidity()) return;
        setBusy(true); setError(''); setDownloaded(false);
        try {
            const options: ProjectOptions = new ProjectOptions(configuration, gameName, packageName, platforms, javaVersion,
                renderer, selected, coreModules, allocator, iosLegacy);
            const currentModules: LibraryModule[] = await catalog.selected(options);
            if (previewOnly) {
                setPreview(await generator.preview(options, currentModules));
            } else {
                const result = await generator.generate(options, currentModules, gameIcon);
                const url: string = URL.createObjectURL(result.blob);
                const link: HTMLAnchorElement = document.createElement('a');
                link.href = url; link.download = `${options.directoryName()}.zip`; document.body.append(link); link.click(); link.remove();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
            }
        } catch (failure: unknown) {
            setError(messageOf(failure));
        } finally {
            setBusy(false);
        }
    }

    return <main>
        {!embedded && <header className="page-header"><a className="brand" href="https://jmonkeyengine.org/" aria-label="jMonkeyEngine home">
            <img src={logoUrl} alt="jMonkeyEngine"/></a><a href="https://jmonkeyengine.org/library/" target="_blank" rel="noopener noreferrer">Explore the Library ↗</a></header>}
        <div className="heading"><div><h1>Project initializer</h1></div><span className="engine-badge">jME {configuration.jmeVersion}</span></div>
        <form id="project-form" onSubmit={event => void generate(event, false)}>
            <fieldset disabled={busy || iconBusy} className="project-layout">
                <div className="configuration">
                    <section className="panel"><h2><span>01</span> Project</h2><label htmlFor="game-name">Game name</label>
                        <input id="game-name" value={gameName} required maxLength={64} pattern="[A-Za-z][A-Za-z0-9 _\-]{0,63}"
                            onChange={event => {setGameName(event.target.value); setPackageName(packageForGameName(event.target.value, packageName, packageEdited));}}/>
                        <label htmlFor="package-name">Java package</label><input id="package-name" value={packageName} maxLength={160}
                            onChange={event => {setPackageEdited(true); setPackageName(event.target.value);}}/>
                        <div className="icon-editor"><img src={iconPreview} alt="Game icon preview"/><div><label htmlFor="game-icon">Game icon</label>
                            <input id="game-icon" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void changeGameIcon(event)}/>
                            {gameIcon !== undefined && <button type="button" className="text-button" onClick={resetGameIcon}>Use default jMonkeyEngine icon</button>}</div></div></section>
                    <section className="panel"><h2><span>02</span> Platforms & runtime</h2><div className="platform-options">
                        {configuration.platforms.map((platform: PlatformDefinition) => <div className={`platform-option ${platforms.includes(platform.id) ? 'selected' : ''}`} key={platform.id}>
                            <label className="platform-main"><input type="checkbox" checked={platforms.includes(platform.id)} onChange={() => changePlatform(platform.id)}/>
                                <strong>{platform.name}</strong></label>
                            {platform.legacyOption && <label className="legacy-toggle" title={configuration.iosLegacy.description}>
                                <input type="checkbox" checked={iosLegacy} disabled={!platforms.includes(platform.id)} onChange={event => setIosLegacy(event.target.checked)}/>
                                <span>{configuration.iosLegacy.name}</span></label>}
                        </div>)}</div>
                        <label htmlFor="java-version">Java version</label><select id="java-version" value={javaVersion} onChange={event => setJavaVersion(Number(event.target.value))}>
                            {configuration.javaVersions.filter((value: JavaVersionDefinition): boolean => supportsJavaVersion(configuration, value.version, platforms))
                                .map((value: JavaVersionDefinition) => <option value={value.version} key={value.version}>{value.name}{value.recommended ? ' — recommended' : ''}</option>)}</select>
                        {platforms.includes('android') && <p className="help">Android SDK Platform {configuration.androidCompileSdk} required; minSdk follows the Java selection.</p>}
                        {platforms.includes('ios') && <p className="help">iOS builds require macOS and Xcode. {iosLegacy && configuration.iosLegacy.description}</p>}</section>
                    <section className="panel"><h2><span>03</span> Renderer</h2><label htmlFor="renderer" className="sr-only">Renderer</label>
                        <select id="renderer" value={renderer} onChange={event => setRenderer(event.target.value)}>
                            {configuration.renderers.filter((value: RendererDefinition): boolean => supportsRenderer(configuration, value.id, platforms))
                                .map((value: RendererDefinition) => <option value={value.id} key={value.id}>{value.name}{value.recommended ? ' — recommended' : ''}</option>)}</select>
                        <p className="renderer-description">{rendererDefinition.description}</p><p className="renderer-summary"><strong>{rendererDefinition.summary}</strong></p>
                    </section>
                    <section className="panel allocator-panel"><h2><span>04</span> Native memory allocator</h2><div className="allocator-list">
                        {configuration.allocators.map((value: AllocatorDefinition) => <AllocatorCard key={value.id} allocator={value}
                            enabled={supportsAllocator(value, platforms)} selected={allocator === value.id} select={() => setAllocator(value.id)}/>)}</div></section>
                </div>
                <div className="module-column">
                    <section className="panel core-modules-panel"><div className="library-heading"><h2><span>05</span> Core modules</h2><span className="selection-count">{coreModules.length} selected</span></div>
                        <p className="help">Optional jMonkeyEngine modules. Required platform modules are included automatically.</p>
                        <div className="core-module-list">{configuration.coreModules.map((module: EngineModuleDefinition) => {
                            const enabled: boolean = supportsCoreModule(module, platforms);
                            return <CoreModuleCard key={module.id} module={module} enabled={enabled} selected={coreModules.includes(module.id)}
                                toggle={() => setCoreModules(values => values.includes(module.id) ? values.filter(value => value !== module.id) : [...values, module.id])}/>;
                        })}</div></section>
                    <section className="panel library-panel"><div className="library-heading"><h2><span>06</span> Community modules</h2><span className="selection-count">{selected.length} selected</span></div>
                        <p className="help">Optional community libraries from <a href="https://jmonkeyengine.org/library/" target="_blank" rel="noopener noreferrer">the jMonkeyEngine Library</a>.</p>
                        <label htmlFor="module-search" className="sr-only">Search modules</label><input type="search" id="module-search" placeholder="Search modules, authors or tags…" value={query}
                            maxLength={100} onChange={event => {setPage(0); setQuery(event.target.value);}}/>
                        <div className="tag-list" aria-label="Filter by category"><button type="button" className={!tag ? 'active' : ''} onClick={() => {setTag(''); setPage(0);}}>All</button>
                            {categoryOptions(tags, expandedTags, tag).map(topic => <button type="button" key={topic} className={tag === topic ? 'active' : ''}
                                onClick={() => {setTag(tag === topic ? '' : topic); setPage(0);}}>{topic}</button>)}</div>
                        {tags.length > 8 && <button type="button" className="tag-expander" onClick={() => setExpandedTags(value => !value)}>{expandedTags ? 'Show fewer tags' : `Show all ${tags.length} tags`}</button>}
                        <div className="module-list" aria-label="Available modules" aria-busy={catalogState === 'loading'} tabIndex={0}>
                            {catalogState === 'loading' && <p className="empty" role="status">Loading the latest listed modules…</p>}
                            {catalogState === 'error' && <div className="empty"><p role="alert">{catalogError}</p><button type="button" onClick={() => setRetry(value => value + 1)}>Retry catalog</button>
                                <p className="help">You can still generate a project with the core engine.</p></div>}
                            {catalogState === 'ready' && visible.length === 0 && <p className="empty">{modules.length > 0 ? 'No compatible modules on this page.' : 'No modules match these filters.'}</p>}
                            {catalogState === 'ready' && visible.map(module => {const identifier: number = module.githubRepositoryId ?? 0; return <ModuleCard key={identifier} module={module}
                                selected={selected.includes(identifier)} toggle={() => {if (selected.includes(identifier)) selectedModules.current.delete(identifier); else selectedModules.current.set(identifier, module);
                                    setSelected(values => values.includes(identifier) ? values.filter(value => value !== identifier) : [...values, identifier]);}}/>;})}
                        </div>
                        <nav className="catalog-pagination" aria-label="Module pages"><button type="button" disabled={catalogState === 'loading' || page === 0} onClick={() => setPage(page - 1)}>← Previous</button>
                            <span>Page {page + 1} of {Math.max(1, totalPages)}</span><button type="button" disabled={catalogState !== 'ready' || page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next →</button></nav>
                        {catalogState === 'ready' && <div className="catalog-summary"><span>{visible.length} shown on this page</span>{hidden.length > 0 && <HiddenModulesNotice modules={hidden}/>}</div>}
                        {notice && <p className="compatibility-note" role="status">{notice}</p>}
                    </section>
                </div>
            </fieldset>
            <div className="generation-bar"><div className="project-files">{['app', ...launcherModules(configuration, platforms).map(value => `platform-${value}`)].map(value => <code key={value}>{value}/</code>)}</div>
                <div className="generation-actions"><button type="button" className="secondary" disabled={busy || iconBusy} onClick={event => void generate(event, true)}>Preview Gradle</button>
                    <button type="submit" className="primary" disabled={busy || iconBusy}>{busy ? 'Preparing project…' : 'Download project ↓'}</button></div></div>
        </form>
        {error && <p className="error-message" role="alert">{error}</p>}
        {downloaded && <p className="success-message">Your project is ready. Unzip it and follow README.md. <a href="https://jmonkeyengine.org/donate/">Support jMonkeyEngine ↗</a></p>}
        {preview && <section className="panel preview"><div className="library-heading"><h2>Generated Gradle configuration</h2><button type="button" onClick={() => setPreview(null)}>Close preview</button></div>
            {[...preview.entries()].map(([path, code]) => <details key={path} open={path === 'app/build.gradle.kts'}><summary>{path}</summary><pre><code>{code}</code></pre></details>)}</section>}
        <footer>Built for jMonkeyEngine {configuration.jmeVersion}. <a href="https://wiki.jmonkeyengine.org/">Documentation ↗</a></footer>
    </main>;
}

function messageOf(value: unknown): string {
    return value instanceof Error ? value.message : 'Unexpected initializer error.';
}
