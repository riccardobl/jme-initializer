export interface PlatformSupport {
    operatingSystem?: string;
}

export interface ArtifactCoordinate {
    groupId?: string;
    artifactId?: string;
    version?: string;
    classifier?: string;
    registry?: string;
    registryOwner?: string;
    registryRepository?: string;
}

export interface LibraryModule {
    githubRepositoryId?: number;
    displayName?: string;
    name?: string;
    fullName?: string;
    owner?: string;
    description?: string;
    visibilityDecision?: string;
    moderationState?: string;
    topics?: string[];
    images?: string[];
    platforms?: PlatformSupport[];
    author?: {name?: string; githubAccount?: string};
    artifacts?: ArtifactCoordinate[];
    rootArtifact?: ArtifactCoordinate;
    engineDependencies?: ArtifactCoordinate[];
    recommendedRuntimeDependencies?: ArtifactCoordinate[];
    dependencies?: ArtifactCoordinate[];
    gradleSnippet?: string;
}

export interface CatalogPage {
    items: LibraryModule[];
    page: number;
    totalPages: number;
}
