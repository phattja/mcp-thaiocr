import { appendFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Diagnostic output configuration
const LOG_DIR = "/tmp/mcp-thaiocr/logs";
let logFile: string | null = null;

export function initializeDiagnosticSanitizer(): void {
  // Setup logging directory
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  logFile = join(LOG_DIR, `diagnostic-${timestamp}.log`);

  // Write startup log
  writeDiagnostic("info", "mcp-thaiocr diagnostic output initialized");
}

export function sanitizeErrorForTransport(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function writeDiagnostic(level: string, ...messages: unknown[]): void {
  const timestamp = new Date().toISOString();
  const levelUpper = level.toUpperCase();

  // Format messages
  const formattedLine = messages.map(msg => {
    if (typeof msg === "string") return msg;
    if (msg instanceof Error) return `${msg.name}: ${msg.message}`;
    return JSON.stringify(msg, null, 2);
  }).join(" ");

  const diagnosticLine = `[${timestamp}] [${levelUpper}] ${formattedLine}\n`;

  // Output to console
  switch (level) {
    case "error":
      console.error(diagnosticLine);
      break;
    case "warning":
      console.warn(diagnosticLine);
      break;
    default:
      console.log(diagnosticLine);
  }

  // Also write to file if logFile is set
  if (logFile) {
    try {
      appendFileSync(logFile, diagnosticLine);
    } catch (e) {
      // Ignore file write errors
    }
  }
}

// Helper functions for different diagnostic levels
export function writeDiagnosticInfo(...messages: unknown[]): void {
  writeDiagnostic("info", ...messages);
}

export function writeDiagnosticWarning(...messages: unknown[]): void {
  writeDiagnostic("warning", ...messages);
}

export function writeDiagnosticError(...messages: unknown[]): void {
  writeDiagnostic("error", ...messages);
}

