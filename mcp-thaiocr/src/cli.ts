#!/usr/bin/env node

import { handleUncaughtException, handleUnhandledRejection } from "./error-handler.js";
import { initializeDiagnosticSanitizer, sanitizeErrorForTransport } from "./diagnostic-sanitizer.js";
import { writeDiagnostic } from "./diagnostic-output.js";
import { packageVersion } from "./version.js";
import { parseCliArgs } from "./cli-args.js";

process.on("uncaughtException", handleUncaughtException);
process.on("unhandledRejection", handleUnhandledRejection);

let parsed;
try {
  parsed = parseCliArgs(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  writeDiagnostic("error", message);
  writeDiagnostic("error", "Use --help for usage.");
  process.exit(1);
}

if (parsed.help) {
  const helpText = `
Thai OCR MCP Server - Usage

SYNOPSIS
  mcp-thaiocr [OPTIONS]

DESCRIPTION
  MCP server for Thai OCR with Typhoon-OCR1.5-2B. Supports STDIO and HTTP transports.

OPTIONS
  --help, -h                 Show this help message
  --version, -v              Show version number
  --http-port PORT           Set HTTP port for streamable transport (default: 8006)
  --http-host HOST           Bind host for HTTP server (default: 0.0.0.0)
  --ocr-endpoint URL         OCR API endpoint URL (default: http://ai-tool:3003/v1)
  --ocr-model NAME           OCR model name (default: Typhoon-OCR1.5-2B)

ENVIRONMENT VARIABLES
  OCR_ENDPOINT        OCR API endpoint URL (default: http://ai-tool:3003/v1)
  OCR_MODEL           Default OCR model name (default: Typhoon-OCR1.5-2B)
  DEFAULT_MAX_TOKENS  Maximum tokens to generate (default: 4096)
  DEFAULT_TEMPERATURE Sampling temperature (default: 0.1)
  DEFAULT_TOP_P       Top-p sampling value (default: 0.6)
  DEFAULT_REPETITION_PENALTY  Repetition penalty (default: 1.2)
  OCR_HTTP_PORT       HTTP port for streamable transport (overrides --http-port)
  OCR_HTTP_HOST       Bind host for HTTP server (overrides --http-host)

EXAMPLES
  # STDIO mode
  npx -y mcp-thaiocr

  # HTTP mode
  npx -y mcp-thaiocr --http-port 8006 --http-host 0.0.0.0

SEE ALSO
  Documentation: See the repository README for more details.
`;

  writeDiagnostic("log", helpText.trim());
  process.exit(0);
}

if (parsed.version) {
  writeDiagnostic("log", packageVersion);
  process.exit(0);
}

// Parse and apply CLI overrides to environment if needed
const httpPort = parsed.httpPort;
const httpHost = parsed.httpHost;

if (httpPort) {
  process.env.OCR_HTTP_PORT = String(httpPort);
}
if (httpHost) {
  process.env.OCR_HTTP_HOST = httpHost;
}
if (parsed.ocrEndpoint) {
  process.env.OCR_ENDPOINT = parsed.ocrEndpoint;
}
if (parsed.ocrModel) {
  process.env.OCR_MODEL = parsed.ocrModel;
}

// Import and run the main function
void import("./index.js")
  .then(({ main }) => main())
  .catch((error) => {
    writeDiagnostic("error", "Failed to start server:", sanitizeErrorForTransport(error));
    process.exit(1);
  });
