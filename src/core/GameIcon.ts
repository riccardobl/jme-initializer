const ALLOWED_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_BYTES: number = 12 * 1024 * 1024;
const MAX_SOURCE_EDGE: number = 8192;
const OUTPUT_SIZE: number = 1024;

/** Browser-side icon decoder and square PNG normalizer. */
export class GameIcon {
    public static validateUpload(file: Pick<File, 'size' | 'type'>): void {
        if (!ALLOWED_TYPES.has(file.type)) throw new Error('Choose a PNG, JPEG or WebP image.');
        if (file.size === 0 || file.size > MAX_FILE_BYTES) throw new Error('The game icon must be between 1 byte and 12 MB.');
    }

    public static async normalize(file: File): Promise<Uint8Array> {
        GameIcon.validateUpload(file);
        const bitmap: ImageBitmap = await createImageBitmap(file);
        try {
            if (bitmap.width < 64 || bitmap.height < 64 || bitmap.width > MAX_SOURCE_EDGE || bitmap.height > MAX_SOURCE_EDGE) {
                throw new Error('The game icon must be between 64×64 and 8192×8192 pixels.');
            }
            const canvas: HTMLCanvasElement = document.createElement('canvas');
            canvas.width = OUTPUT_SIZE;
            canvas.height = OUTPUT_SIZE;
            const context: CanvasRenderingContext2D | null = canvas.getContext('2d', {alpha: false});
            if (context === null) throw new Error('This browser cannot prepare the game icon.');
            context.fillStyle = '#111114';
            context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
            const edge: number = Math.min(bitmap.width, bitmap.height);
            const sourceX: number = (bitmap.width - edge) / 2;
            const sourceY: number = (bitmap.height - edge) / 2;
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(bitmap, sourceX, sourceY, edge, edge, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
            const blob: Blob = await new Promise<Blob>((resolve: (value: Blob) => void, reject: (reason: Error) => void): void => {
                canvas.toBlob((value: Blob | null): void => value === null
                    ? reject(new Error('The browser could not encode the game icon.')) : resolve(value), 'image/png');
            });
            return new Uint8Array(await blob.arrayBuffer());
        } finally {
            bitmap.close();
        }
    }
}
