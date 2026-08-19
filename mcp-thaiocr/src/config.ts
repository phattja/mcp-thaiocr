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
  HTTP_PORT: "OCR_HTTP_PORT",
  HTTP_HOST: "OCR_HTTP_HOST",
} as const;

interface OCRConfig {
  ocrEndpoint: string;
  ocrModel: string;
  defaultMaxTokens: number;
  defaultTemperature: number;
  defaultTopP: number;
  defaultRepetitionPenalty: number;
  httpPort?: number;
  httpHost?: string;
}

// Default values
const DEFAULTS: OCRConfig = {
  ocrEndpoint: "http://127.0.0.1:3003/v1",
  ocrModel: "Typhoon-OCR1.5-2B",
  defaultMaxTokens: 4096,
  defaultTemperature: 0.1,
  defaultTopP: 0.6,
  defaultRepetitionPenalty: 1.2,
  httpPort: 8006,
  httpHost: "0.0.0.0",
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
    httpPort: parseInt(process.env[ENV_NAMES.HTTP_PORT] || "", 10) || DEFAULTS.httpPort,
    httpHost: process.env[ENV_NAMES.HTTP_HOST] || DEFAULTS.httpHost,
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
export const SERVER_NAME = "mcp-thaiocr";
