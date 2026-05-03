import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";
import os from "os";
import * as XLSX from "xlsx";
import { ocrImage, ocrPdf, isOcrableImage } from "@/lib/ocr";

const UPLOAD_DIR = path.join(os.homedir(), "Library", "Application Support", "nexus", "uploads");

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".csv", ".json", ".ts", ".tsx", ".js", ".jsx",
  ".py", ".go", ".rs", ".java", ".rb", ".php", ".sql", ".yaml",
  ".yml", ".toml", ".html", ".xml", ".sh", ".bash", ".zsh",
  ".env", ".gitignore", ".config",
]);

const MAX_TEXT_CHARS = 50_000;

function isPlainText(filename: string, mimeType: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/xml" ||
    TEXT_EXTENSIONS.has(ext)
  );
}

/**
 * Extract searchable text from any file we can. Returns null if the format is
 * binary-only (image, video, audio) or if extraction failed.
 */
async function extractText(buffer: Buffer, filename: string, mimeType: string): Promise<string | null> {
  const ext = path.extname(filename).toLowerCase();

  // Plain text — straight UTF-8 decode
  if (isPlainText(filename, mimeType)) {
    return buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS);
  }

  // PDF — try pdf-parse first, fall back to OCR for scanned/image-only PDFs
  if (ext === ".pdf" || mimeType === "application/pdf") {
    let extractedText = "";
    try {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      extractedText = (result.text ?? "").trim();
    } catch (err) {
      console.error("[uploads] pdf-parse failed:", err);
    }
    // Heuristic: under 40 chars = effectively no text → it's a scan, OCR it
    if (extractedText.length >= 40) {
      return extractedText.slice(0, MAX_TEXT_CHARS);
    }
    try {
      console.log("[uploads] PDF has no extractable text — running OCR");
      const ocrText = await ocrPdf(buffer);
      return ocrText.length > 0 ? ocrText.slice(0, MAX_TEXT_CHARS) : null;
    } catch (err) {
      console.error("[uploads] OCR fallback failed:", err);
      return null;
    }
  }

  // Image — OCR directly
  if (isOcrableImage(mimeType, ext)) {
    try {
      const text = await ocrImage(buffer);
      return text.length > 0 ? text.slice(0, MAX_TEXT_CHARS) : null;
    } catch (err) {
      console.error("[uploads] image OCR failed:", err);
      return null;
    }
  }

  // XLSX / XLS / ODS — flatten all sheets to CSV-like text
  if (ext === ".xlsx" || ext === ".xls" || ext === ".ods" || mimeType.includes("spreadsheetml")) {
    try {
      const wb = XLSX.read(buffer, { type: "buffer" });
      const parts: string[] = [];
      for (const name of wb.SheetNames) {
        parts.push(`### Sheet: ${name}`);
        parts.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
      }
      const text = parts.join("\n\n").trim();
      return text.length > 0 ? text.slice(0, MAX_TEXT_CHARS) : null;
    } catch (err) {
      console.error("[uploads] xlsx parse failed:", err);
      return null;
    }
  }

  // DOCX — unzip, pull text from word/document.xml. Avoids adding mammoth as a dep.
  if (ext === ".docx" || mimeType.includes("wordprocessingml")) {
    try {
      // Lazy-load yauzl alternative: use built-in zlib via the docx file structure
      // Simpler: use the `docx` library's reader if available, or fall back to a regex over unzipped XML
      // We'll do the cheap path — strip <w:t>...</w:t> matches from the document.xml entry
      const zip = await unzipBuffer(buffer);
      const docXml = zip.get("word/document.xml");
      if (!docXml) return null;
      const xml = docXml.toString("utf-8");
      const matches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [];
      const text = matches.map((m) => m.replace(/<[^>]+>/g, "")).join(" ").trim();
      return text.length > 0 ? text.slice(0, MAX_TEXT_CHARS) : null;
    } catch (err) {
      console.error("[uploads] docx parse failed:", err);
      return null;
    }
  }

  return null;
}

/**
 * Minimal in-memory zip reader using Node's built-in zlib.
 * Sufficient for reading docx (a zip with known entry names).
 */
async function unzipBuffer(buf: Buffer): Promise<Map<string, Buffer>> {
  // Use the `node:zlib` based approach via JSZip-like minimal reader.
  // We have `pdf-lib` and `docx` already; neither exposes a zip reader cleanly.
  // Pull in node's stream-based unzip — the simplest path is the `unzipper` package,
  // but to avoid another dep we parse the central directory manually.
  return parseZipCentralDirectory(buf);
}

function parseZipCentralDirectory(buf: Buffer): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  // Find End-of-Central-Directory record by scanning back
  const EOCD_SIG = 0x06054b50;
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) { eocdOffset = i; break; }
  }
  if (eocdOffset < 0) return result;

  const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);
  const centralDirEntries = buf.readUInt16LE(eocdOffset + 10);
  const CFH_SIG = 0x02014b50;
  const LFH_SIG = 0x04034b50;

  let pos = centralDirOffset;
  for (let i = 0; i < centralDirEntries; i++) {
    if (buf.readUInt32LE(pos) !== CFH_SIG) break;
    const compressionMethod = buf.readUInt16LE(pos + 10);
    const compressedSize = buf.readUInt32LE(pos + 20);
    const fileNameLen = buf.readUInt16LE(pos + 28);
    const extraLen = buf.readUInt16LE(pos + 30);
    const commentLen = buf.readUInt16LE(pos + 32);
    const localHeaderOffset = buf.readUInt32LE(pos + 42);
    const fileName = buf.slice(pos + 46, pos + 46 + fileNameLen).toString("utf-8");

    // Read local file header to find the actual data offset
    if (buf.readUInt32LE(localHeaderOffset) === LFH_SIG) {
      const lfhFileNameLen = buf.readUInt16LE(localHeaderOffset + 26);
      const lfhExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + lfhFileNameLen + lfhExtraLen;
      const compressedData = buf.slice(dataStart, dataStart + compressedSize);

      let content: Buffer;
      if (compressionMethod === 0) {
        content = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate (raw, no zlib header)
        const zlib = require("zlib");
        content = zlib.inflateRawSync(compressedData);
      } else {
        pos += 46 + fileNameLen + extraLen + commentLen;
        continue;
      }
      result.set(fileName, content);
    }

    pos += 46 + fileNameLen + extraLen + commentLen;
  }
  return result;
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name);
  const uploadId = crypto.randomUUID();
  const filePath = path.join(UPLOAD_DIR, `${uploadId}${ext}`);
  fs.writeFileSync(filePath, buffer);

  const textContent = await extractText(buffer, file.name, file.type);

  const upload = await prisma.upload.create({
    data: {
      id: uploadId,
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: buffer.length,
      path: filePath,
      textContent,
    },
  });

  return NextResponse.json({
    id: upload.id,
    filename: upload.filename,
    mimeType: upload.mimeType,
    extracted: textContent !== null,
    textLength: textContent?.length ?? 0,
  });
}

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const upload = await prisma.upload.findUnique({ where: { id } });
  if (!upload) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(upload);
}
