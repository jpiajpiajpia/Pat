import path from "path";
import os from "os";
import fs from "fs";

/**
 * OCR + PDF rasterization helpers.
 *
 * - Worker is lazy-loaded on first use (avoids paying the ~3s init cost on every upload)
 * - Trained-data file is cached to ~/Library/Application Support/nexus/ocr-cache/
 * - First-use UX: ~10s for the eng.traineddata download, then fast for subsequent calls
 */

const CACHE_DIR = path.join(os.homedir(), "Library", "Application Support", "nexus", "ocr-cache");

type RecognitionResult = { data: { text: string } };
type Worker = { recognize: (input: Buffer | string) => Promise<RecognitionResult>; terminate: () => Promise<void> };

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const { createWorker } = await import("tesseract.js");
    return createWorker("eng", 1, {
      cachePath: CACHE_DIR,
      logger: () => {},
    }) as unknown as Worker;
  })();
  return workerPromise;
}

/**
 * OCR a single image (PNG, JPEG, etc.) and return the extracted text.
 */
export async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await getWorker();
  const { data: { text } } = await worker.recognize(buffer);
  return text.trim();
}

/**
 * Rasterize each page of a PDF to a PNG buffer, then OCR each page.
 * Returns the concatenated text. Used as a fallback when pdf-parse returns empty
 * (i.e., the PDF is a scan or image-only).
 */
export async function ocrPdf(buffer: Buffer, opts: { maxPages?: number; scale?: number } = {}): Promise<string> {
  const maxPages = opts.maxPages ?? 20;
  const scale = opts.scale ?? 2; // 2x rasterization improves OCR accuracy

  // Lazy import — pdfjs and canvas are heavy
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");

  // pdfjs needs a worker source; in node we disable it
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  // pdfjs takes a Uint8Array, not a Node Buffer
  const data = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const doc = await pdfjs.getDocument({ data, disableWorker: true } as unknown as Parameters<typeof pdfjs.getDocument>[0]).promise;

  const pageCount = Math.min(doc.numPages, maxPages);
  const worker = await getWorker();
  const pieces: string[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext("2d");
    // Render the PDF page to the canvas
    // (`canvas` field is required by newer pdfjs-dist; `canvasContext` was the old shape)
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const png = canvas.toBuffer("image/png");
    const { data: { text } } = await worker.recognize(png);
    if (text.trim()) pieces.push(`### Page ${i}\n${text.trim()}`);
  }

  await doc.destroy();
  return pieces.join("\n\n").trim();
}

/**
 * Whether OCR should be attempted on a file with this MIME type.
 */
export function isOcrableImage(mimeType: string, ext: string): boolean {
  if (mimeType.startsWith("image/")) {
    // Skip vector images and animated GIFs; tesseract handles raster well
    return !mimeType.includes("svg");
  }
  return [".png", ".jpg", ".jpeg", ".heic", ".heif", ".webp", ".bmp", ".tiff", ".tif"].includes(ext.toLowerCase());
}
