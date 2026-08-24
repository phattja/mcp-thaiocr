import { writeDiagnostic } from "./diagnostic-output.js";

// Configuration validation functions

// Environment variable names
const ENV_NAMES = {
  OCR_ENDPOINT: "OCR_ENDPOINT",
  OCR_MODEL: "OCR_MODEL",
  DEFAULT_MAX_TOKENS: "DEFAULT_MAX_TOKENS",
  DEFAULT_TEMPERATURE: "DEFAULT_TEMPERATURE",
  DEFAULT_TOP_P: "DEFAULT_TOP_P",
  DEFAULT_REPETITION_PENALTY: "DEFAULT_REPETITION_PENALTY",
  DEFAULT_TASK: "DEFAULT_TASK",
  DEFAULT_PROMPT: "DEFAULT_PROMPT",
  HTTP_PORT: "OCR_HTTP_PORT",
  HTTP_HOST: "OCR_HTTP_HOST",
  UPLOAD_DIRS: "OCR_UPLOAD_DIRS",
  OPENWEBUI_URL: "OPENWEBUI_URL",
  OPENWEBUI_TOKEN: "OPENWEBUI_TOKEN",
} as const;

interface OCRConfig {
  ocrEndpoint: string;
  ocrModel: string;
  defaultMaxTokens: number;
  defaultTemperature: number;
  defaultTopP: number;
  defaultRepetitionPenalty: number;
  defaultTask: string;
  defaultPrompt: string;
  httpPort?: number;
  httpHost?: string;
  uploadDirs: string[];
  openWebuiUrl?: string;
  openWebuiToken?: string;
}

// Default values
const DEFAULTS: OCRConfig = {
  ocrEndpoint: "http://ai-tool:3003/v1",
  ocrModel: "Typhoon-OCR1.5-2B",
  defaultMaxTokens: 32768,
  defaultTemperature: 0.1,
  defaultTopP: 0.6,
  defaultRepetitionPenalty: 1.2,
  defaultTask: "v1.5",
  defaultPrompt: "",
  httpPort: 8006,
  httpHost: "0.0.0.0",
  uploadDirs: ["/tmp", "/tmp/ocr-inbox", "/ai/openwebui/data/uploads"],
};

// Load and validate configuration
export function getOCRConfig(): OCRConfig {
  const rawConfig = {
    ocrEndpoint: process.env[ENV_NAMES.OCR_ENDPOINT] || DEFAULTS.ocrEndpoint,
    ocrModel: process.env[ENV_NAMES.OCR_MODEL] || DEFAULTS.ocrModel,
    defaultMaxTokens: parseInt(process.env[ENV_NAMES.DEFAULT_MAX_TOKENS] || "", 10) || DEFAULTS.defaultMaxTokens,
    defaultTemperature: parseFloat(process.env[ENV_NAMES.DEFAULT_TEMPERATURE] || "") || DEFAULTS.defaultTemperature,
    defaultTopP: parseFloat(process.env[ENV_NAMES.DEFAULT_TOP_P] || "") || DEFAULTS.defaultTopP,
    defaultRepetitionPenalty: parseFloat(process.env[ENV_NAMES.DEFAULT_REPETITION_PENALTY] || "") || DEFAULTS.defaultRepetitionPenalty,
    defaultTask: process.env[ENV_NAMES.DEFAULT_TASK] || DEFAULTS.defaultTask,
    defaultPrompt: process.env[ENV_NAMES.DEFAULT_PROMPT] ?? DEFAULTS.defaultPrompt,
    httpPort: parseInt(process.env[ENV_NAMES.HTTP_PORT] || "", 10) || DEFAULTS.httpPort,
    httpHost: process.env[ENV_NAMES.HTTP_HOST] || DEFAULTS.httpHost,
    uploadDirs: (process.env[ENV_NAMES.UPLOAD_DIRS] || DEFAULTS.uploadDirs.join(","))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    openWebuiUrl: process.env[ENV_NAMES.OPENWEBUI_URL]?.replace(/\/$/, "") || undefined,
    openWebuiToken: process.env[ENV_NAMES.OPENWEBUI_TOKEN] || undefined,
  };

  // Validate required fields
  if (!rawConfig.ocrEndpoint) {
    writeDiagnostic("error", "OCR_ENDPOINT environment variable is required");
    process.exit(1);
  }

  // Validate URL format
  try {
    new URL(rawConfig.ocrEndpoint);
  } catch (e) {
    writeDiagnostic("error", `Invalid OCR_ENDPOINT URL: ${rawConfig.ocrEndpoint}`);
    process.exit(1);
  }

  // Validate numeric ranges
  if (rawConfig.httpPort && (rawConfig.httpPort < 1 || rawConfig.httpPort > 65535)) {
    writeDiagnostic("error", `Invalid HTTP port: ${rawConfig.httpPort}. Must be between 1 and 65535.`);
    process.exit(1);
  }

  if (rawConfig.defaultTemperature < 0 || rawConfig.defaultTemperature > 1) {
    writeDiagnostic("error", `Invalid temperature: ${rawConfig.defaultTemperature}. Must be between 0 and 1.`);
    process.exit(1);
  }

  if (rawConfig.defaultTopP < 0 || rawConfig.defaultTopP > 1) {
    writeDiagnostic("error", `Invalid top_p: ${rawConfig.defaultTopP}. Must be between 0 and 1.`);
    process.exit(1);
  }

  if (rawConfig.defaultRepetitionPenalty <= 0) {
    writeDiagnostic("error", `Invalid repetition_penalty: ${rawConfig.defaultRepetitionPenalty}. Must be positive.`);
    process.exit(1);
  }

  if (!["default", "structure", "v1.5"].includes(rawConfig.defaultTask)) {
    writeDiagnostic("error", `Invalid DEFAULT_TASK: ${rawConfig.defaultTask}. Must be one of: default, structure, v1.5.`);
    process.exit(1);
  }

  return rawConfig;
}

export function validateOCRConfig(): string | null {
  try {
    getOCRConfig();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Configuration validation failed";
  }
}

export interface ListenConfig {
  port?: number;
  host?: string;
  portError?: string;
}

export function resolveHttpListen(): ListenConfig {
  const config = getOCRConfig();
  
  // Check for port conflicts or invalid values
  if (config.httpPort && (config.httpPort < 1 || config.httpPort > 65535)) {
    return { portError: `Invalid HTTP port: ${config.httpPort}. Must be between 1 and 65535.` };
  }

  // Check if port is already in use would require a socket check, but we'll let the server handle that
  return { port: config.httpPort, host: config.httpHost };
}

export function resolveBindHost(host?: string): string {
  return host || "0.0.0.0";
}

// Server name constant
export const SERVER_NAME = "phattja/mcp-thaiocr";

export const SERVER_INSTRUCTIONS =
  "Use the `thaiocr` tool to extract Thai/English text from a document image or PDF. "
  + "Supported file types: PNG, JPEG/JPG, WEBP, GIF, TIFF/TIF, BMP, PDF. "
  + "Chat UI attachments (llama.cpp WebUI, Open WebUI) are NOT sent to this tool automatically. "
  + "Pass image as: an absolute host path the MCP server can read (e.g. /tmp/1.png), "
  + "a http(s) URL, a data:image/...;base64,... URI, or raw base64. "
  + "A bare filename is resolved under /tmp, /tmp/ocr-inbox, and Open WebUI uploads. "
  + "Do not invent file paths. "
  + "Read resource thaiocr://guides (name thaiocr_guides) for usage.";
