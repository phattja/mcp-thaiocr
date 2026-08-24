import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, isAbsolute, join } from "path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOCRConfig, validateOCRConfig } from "./config.js";
import { createConfigurationError } from "./error-handler.js";
import { logMessage } from "./logging.js";

export interface OCRRequestArgs {
  image?: unknown;
  source?: string;
  file_path?: string;
  url?: string;
  base64?: string;
  file_id?: string;
  __files__?: unknown;
  files?: unknown;
  model?: string;
  task?: string;
  prompt?: string;
  page?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
}

const VALID_TASKS = new Set(["default", "structure", "v1.5"]);

/**
 * Parse a page-selection string like '1-3', '1,3', '4,6,7-9' into a sorted set of
 * page numbers. Default (missing/empty) is page 1. Returns null when 'all' is requested.
 */
export function parsePageRanges(pageArg?: string): Set<number> | null {
  if (!pageArg || !pageArg.trim()) {
    return new Set([1]);
  }
  if (pageArg.trim().toLowerCase() === "all") {
    return null;
  }
  const pages = new Set<number>();
  const parts = pageArg.replace(/\s/g, "").split(",");
  for (const part of parts) {
    if (!part) continue;
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => Number.parseInt(n, 10));
      if (Number.isNaN(a) || Number.isNaN(b)) {
        throw new Error(`Invalid range format: '${part}'`);
      }
      const [start, end] = a <= b ? [a, b] : [b, a];
      for (let p = start; p <= end; p++) pages.add(p);
    } else {
      const n = Number.parseInt(part, 10);
      if (Number.isNaN(n) || !/^\d+$/.test(part)) {
        throw new Error(`Invalid page number: '${part}'`);
      }
      pages.add(n);
    }
  }
  if (pages.size === 0) {
    throw new Error(`Invalid page selection: '${pageArg}'`);
  }
  return new Set([...pages].sort((x, y) => x - y));
}

interface ResolvedImage {
  bytes: Uint8Array;
  mimeType: string;
  origin: string;
}

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".tif", ".tiff", ".bmp", ".pdf"]);

export function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      summary[key] = value.length > 120
        ? `${value.slice(0, 40)}…(${value.length} chars)`
        : value;
    } else if (Array.isArray(value)) {
      summary[key] = `array(${value.length})`;
    } else if (value && typeof value === "object") {
      summary[key] = `object(${Object.keys(value as object).join(",")})`;
    } else {
      summary[key] = value;
    }
  }
  return summary;
}

export async function performOCR(
  mcpServer: McpServer,
  args: OCRRequestArgs,
  signal?: AbortSignal,
): Promise<string> {
  const configIssue = validateOCRConfig();
  if (configIssue) {
    throw createConfigurationError(configIssue);
  }

  const config = getOCRConfig();
  const model = args.model || config.ocrModel;
  const task = args.task || config.defaultTask;
  const prompt = args.prompt ?? config.defaultPrompt;
  const maxTokens = args.max_tokens || config.defaultMaxTokens;
  const temperature = args.temperature ?? config.defaultTemperature;
  const topP = args.top_p ?? config.defaultTopP;
  const repetitionPenalty = args.repetition_penalty ?? config.defaultRepetitionPenalty;

  if (!VALID_TASKS.has(task)) {
    throw new Error(`Invalid task '${task}'. Must be one of: ${[...VALID_TASKS].join(", ")}`);
  }

  let pageRange: Set<number> | null = null;
  try {
    pageRange = parsePageRanges(args.page);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Invalid page selection");
  }

  const resolved = await resolveImage(args, signal);
  logMessage(mcpServer, "info", `Performing OCR with model: ${model}`, {
    origin: resolved.origin,
    mimeType: resolved.mimeType,
    bytes: resolved.bytes.length,
    task,
    maxTokens,
    page: args.page || "1",
  });

  return callOCRApi({
    endpoint: config.ocrEndpoint,
    model,
    task,
    prompt,
    pageRange,
    bytes: resolved.bytes,
    mimeType: resolved.mimeType,
    origin: resolved.origin,
    maxTokens,
    temperature,
    topP,
    repetitionPenalty,
    signal,
  });
}

export async function resolveImage(args: OCRRequestArgs, signal?: AbortSignal): Promise<ResolvedImage> {
  const candidates = collectCandidates(args);
  if (candidates.length === 0) {
    throw new Error(
      "No image was provided. Chat attachments are not forwarded by llama.cpp WebUI or Open WebUI MCP. "
      + "Pass `image` as an absolute path on this host (e.g. /tmp/1.png), a URL, a data:image URI, "
      + "raw base64, or an Open WebUI file id. Bare filenames are searched in /tmp, /tmp/ocr-inbox, "
      + "and /ai/openwebui/data/uploads.",
    );
  }

  const errors: string[] = [];
  for (const candidate of candidates) {
    try {
      return await loadCandidate(candidate, signal);
    } catch (error) {
      errors.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Could not load any image candidate.\n${errors.join("\n")}`);
}

function collectCandidates(args: OCRRequestArgs): string[] {
  const found: string[] = [];
  const push = (value: unknown) => {
    for (const item of flattenImageValue(value)) {
      if (item && !found.includes(item)) {
        found.push(item);
      }
    }
  };

  push(args.image);
  push(args.file_path);
  push(args.url);
  push(args.base64);
  push(args.file_id);
  push(args.__files__);
  push(args.files);

  if (args.source === "file") push(args.file_path);
  if (args.source === "url") push(args.url);
  if (args.source === "base64") push(args.base64);

  return found;
}

function flattenImageValue(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenImageValue(item));
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = ["image", "url", "uri", "path", "file_path", "filepath", "data", "base64", "id", "file_id", "content"];
    const out: string[] = [];
    for (const key of keys) {
      out.push(...flattenImageValue(record[key]));
    }
    if (typeof record.data === "string" && typeof record.mimeType === "string" && !record.data.startsWith("data:")) {
      out.push(`data:${record.mimeType};base64,${record.data}`);
    }
    return out;
  }
  return [];
}

async function loadCandidate(raw: string, signal?: AbortSignal): Promise<ResolvedImage> {
  const value = raw.trim();
  if (!value) {
    throw new Error("empty value");
  }

  if (value.startsWith("data:")) {
    return decodeDataUri(value);
  }

  if (/^https?:\/\//i.test(value)) {
    return fetchUrl(value, signal);
  }

  if (/^[A-Za-z0-9+/=\s]+$/.test(value) && value.replace(/\s/g, "").length > 200) {
    const compact = value.replace(/\s/g, "");
    return {
      bytes: Buffer.from(compact, "base64"),
      mimeType: detectMimeTypeFromBase64(compact) || "image/png",
      origin: "base64",
    };
  }

  const pathOrId = value.replace(/^file:\/\//, "");
  const resolvedPath = resolveLocalPath(pathOrId);
  if (resolvedPath) {
    const bytes = readFileSync(resolvedPath);
    return {
      bytes,
      mimeType: detectMimeType(resolvedPath),
      origin: `file:${resolvedPath}`,
    };
  }

  const fromWebui = await fetchOpenWebuiFile(pathOrId, signal);
  if (fromWebui) {
    return fromWebui;
  }

  throw new Error(`not a readable path, URL, data URI, or file id: ${pathOrId}`);
}

function resolveLocalPath(input: string): string | undefined {
  const config = getOCRConfig();
  const candidates: string[] = [];

  if (isAbsolute(input) || input.startsWith(".")) {
    candidates.push(input);
  }

  const name = basename(input);
  for (const dir of config.uploadDirs) {
    candidates.push(join(dir, input));
    candidates.push(join(dir, name));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  if (/^[0-9a-f-]{8,}$/i.test(name) || name.includes(".")) {
    for (const dir of config.uploadDirs) {
      if (!existsSync(dir)) continue;
      try {
        const match = readdirSync(dir).find((entry) => entry === name || entry.startsWith(`${name}_`) || entry.startsWith(`${name}.`));
        if (match) {
          const full = join(dir, match);
          if (statSync(full).isFile()) {
            return full;
          }
        }
      } catch {
        // ignore unreadable dirs
      }
    }
  }

  return undefined;
}

async function fetchUrl(url: string, signal?: AbortSignal): Promise<ResolvedImage> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
  return {
    bytes,
    mimeType: headerType && headerType !== "application/octet-stream"
      ? headerType
      : detectMimeTypeFromUrl(url),
    origin: `url:${url}`,
  };
}

async function fetchOpenWebuiFile(id: string, signal?: AbortSignal): Promise<ResolvedImage | undefined> {
  const config = getOCRConfig();
  if (!config.openWebuiUrl || !/^[0-9a-f-]{16,}$/i.test(id)) {
    return undefined;
  }
  const headers: Record<string, string> = {};
  if (config.openWebuiToken) {
    headers.Authorization = `Bearer ${config.openWebuiToken}`;
  }
  const response = await fetch(`${config.openWebuiUrl}/api/v1/files/${id}/content`, { headers, signal });
  if (!response.ok) {
    throw new Error(`Open WebUI file ${id}: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const headerType = response.headers.get("content-type")?.split(";")[0]?.trim();
  return {
    bytes,
    mimeType: headerType && headerType !== "application/octet-stream" ? headerType : "image/png",
    origin: `openwebui:${id}`,
  };
}

function decodeDataUri(uri: string): ResolvedImage {
  const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/i.exec(uri);
  if (!match) {
    throw new Error("invalid data URI");
  }
  const mimeType = match[1] || "image/png";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || "";
  const bytes = isBase64 ? Buffer.from(payload, "base64") : Buffer.from(decodeURIComponent(payload));
  return { bytes, mimeType, origin: "data-uri" };
}

interface OCRApiRequest {
  endpoint: string;
  model: string;
  task: string;
  prompt?: string;
  pageRange: Set<number> | null;
  bytes: Uint8Array;
  mimeType: string;
  origin: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  repetitionPenalty: number;
  signal?: AbortSignal;
}

async function callOCRApi(req: OCRApiRequest): Promise<string> {
  try {
    return await ocrWithTyphoonPackage(req);
  } catch (error) {
    if (req.mimeType.includes("pdf") || (error as Error & { code?: string }).code === "PAGE_OUT_OF_RANGE") {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`PDF OCR failed: ${detail}`);
    }
    // Images can still be sent as a data URI if typhoon_ocr is unavailable.
  }

  const base64Image = Buffer.from(req.bytes).toString("base64");
  const baseText = "Extract text from this Thai document image. Include all visible text including headers, footers, and any special formatting.";
  const text = req.prompt ? `${baseText}\n${req.prompt}` : baseText;
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:${req.mimeType};base64,${base64Image}` },
        },
        {
          type: "text",
          text,
        },
      ],
    },
  ];

  const response = await fetch(`${req.endpoint}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages,
      max_tokens: req.maxTokens,
      temperature: req.temperature,
      top_p: req.topP,
      repetition_penalty: req.repetitionPenalty,
    }),
    signal: req.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR API call failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return result.choices?.[0]?.message?.content || "No text extracted from image.";
}

async function ocrWithTyphoonPackage(req: OCRApiRequest): Promise<string> {
  const { mkdtempSync, writeFileSync, rmSync } = await import("fs");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const { spawn } = await import("child_process");
  const pythonBin = process.env.THAIOCR_PYTHON
    || (existsSync("/opt/typhoon-ocr/bin/python3") ? "/opt/typhoon-ocr/bin/python3" : "python3");

  const ext = req.mimeType.includes("jpeg") || req.mimeType.includes("jpg")
    ? ".jpg"
    : req.mimeType.includes("pdf")
      ? ".pdf"
      : ".png";
  const dir = mkdtempSync(join(tmpdir(), "mcp-thaiocr-"));
  const imagePath = join(dir, `input${ext}`);
  writeFileSync(imagePath, req.bytes);

  const isPdf = req.mimeType.includes("pdf");
  // Default is page 1. `page=all` (pageRange null) iterates every PDF page until the end.
  const pagesArg = !isPdf
    ? "[1]"
    : req.pageRange
      ? JSON.stringify([...req.pageRange])
      : "ALL";

  const script = `
import sys, json
from openai import OpenAI
from typhoon_ocr import prepare_ocr_messages

image_path = sys.argv[1]
base_url = sys.argv[2]
api_key = sys.argv[3]
model = sys.argv[4]
task_type = sys.argv[5]
max_tokens = int(sys.argv[6])
prompt = sys.argv[7]
pages_arg = sys.argv[8]
temperature = float(sys.argv[9])
top_p = float(sys.argv[10])
repetition_penalty = float(sys.argv[11])
is_pdf = sys.argv[12] == "1"

client = OpenAI(base_url=base_url, api_key=api_key)
pages = list(range(1, 10000)) if pages_arg == "ALL" else json.loads(pages_arg)

out_parts = []
for page in pages:
    try:
        messages = prepare_ocr_messages(pdf_or_image_path=image_path, task_type=task_type, page_num=page)
    except Exception as exc:
        # Page out of range: stop iterating when auto-iterating all pages
        if pages_arg == "ALL" and page > 1:
            break
        if pages_arg == "ALL":
            print(f"PREPARE_FAILED: {exc}", file=sys.stderr)
            sys.exit(2)
        print(f"PAGE_OUT_OF_RANGE: {page} ({exc})", file=sys.stderr)
        sys.exit(3)
    if prompt:
        for item in messages[0]["content"]:
            if item.get("type") == "text":
                item["text"] += "\\n" + prompt
    response = client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        extra_body={"repetition_penalty": repetition_penalty},
    )
    text = response.choices[0].message.content
    if text is None:
        text = ""
    if is_pdf:
        out_parts.append(f"--- Page {page} ---\\n{text}")
    else:
        out_parts.append(text)
print("\\n".join(out_parts))
`;

  try {
    const output = await new Promise<string>((resolve, reject) => {
      const child = spawn(pythonBin, [
        "-c",
        script,
        imagePath,
        req.endpoint,
        "no-key",
        req.model,
        req.task,
        String(req.maxTokens),
        req.prompt || "",
        pagesArg,
        String(req.temperature),
        String(req.topP),
        String(req.repetitionPenalty),
        isPdf ? "1" : "0",
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      const onAbort = () => child.kill("SIGTERM");
      req.signal?.addEventListener("abort", onAbort);
      child.on("error", reject);
      child.on("close", (code) => {
        req.signal?.removeEventListener("abort", onAbort);
        if (code === 0 && stdout.trim()) {
          resolve(stdout.trim());
          return;
        }
        const match = /PAGE_OUT_OF_RANGE:\s*(\d+)/.exec(stderr);
        if (match) {
          const err = new Error(`Page ${match[1]} is out of range for this PDF.`);
          (err as Error & { code?: string }).code = "PAGE_OUT_OF_RANGE";
          reject(err);
          return;
        }
        reject(new Error(stderr.trim() || `typhoon_ocr exited ${code}`));
      });
    });
    return output;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function detectMimeType(filePath: string): string {
  const ext = filePath.includes(".") ? `.${filePath.split(".").pop()?.toLowerCase()}` : "";
  switch (ext) {
    case ".png": return "image/png";
    case ".jpg":
    case ".jpeg": return "image/jpeg";
    case ".webp": return "image/webp";
    case ".gif": return "image/gif";
    case ".tif":
    case ".tiff": return "image/tiff";
    case ".bmp": return "image/bmp";
    case ".pdf": return "application/pdf";
    default: return "image/png";
  }
}

function detectMimeTypeFromUrl(url: string): string {
  try {
    return detectMimeType(new URL(url).pathname);
  } catch {
    return "image/png";
  }
}

function detectMimeTypeFromBase64(base64: string): string | null {
  if (base64.startsWith("/9j/")) return "image/jpeg";
  if (base64.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64.startsWith("R0lGODdh") || base64.startsWith("R0lGODlh")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
  return null;
}

export function isLikelyImageName(name: string): boolean {
  const ext = name.includes(".") ? `.${name.split(".").pop()?.toLowerCase()}` : "";
  return IMAGE_EXT.has(ext);
}
