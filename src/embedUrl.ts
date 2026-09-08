/** Resolves the iframe from the actual embed script URL, independent of the parent page. */
export function resolveInitializerUrl(scriptSource: string): URL {
    return new URL('./?embed=1', new URL(scriptSource));
}
