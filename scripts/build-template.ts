import {promises as filesystem} from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

const root: string = path.resolve(import.meta.dirname, '..');
const source: string = path.join(root, 'template-src');
const destination: string = path.join(root, 'public', 'template.zip');
const fixedDate: Date = new Date('1980-01-01T00:00:00.000Z');

async function listFiles(directory: string, relative: string = ''): Promise<string[]> {
    const entries = await filesystem.readdir(directory, {withFileTypes: true});
    const files: string[] = [];
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        const childRelative: string = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
        const child: string = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await listFiles(child, childRelative));
        else if (entry.isFile()) files.push(childRelative);
    }
    return files;
}

const zip: JSZip = new JSZip();
for (const file of await listFiles(source)) {
    const bytes: Buffer = await filesystem.readFile(path.join(source, file));
    zip.file(file, bytes, {
        binary: true,
        date: fixedDate,
        unixPermissions: file === 'gradlew' ? 0o100755 : 0o100644,
        createFolders: false
    });
}
await filesystem.mkdir(path.dirname(destination), {recursive: true});
await filesystem.writeFile(destination, await zip.generateAsync({
    type: 'nodebuffer', platform: 'UNIX', compression: 'DEFLATE', compressionOptions: {level: 9}
}));
