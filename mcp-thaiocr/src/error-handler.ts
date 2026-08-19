import { writeDiagnostic } from "./diagnostic-output.js";

export function handleUncaughtException(error: Error): void {
  writeDiagnostic("error", "Uncaught Exception:", error);
  console.error("Uncaught Exception:", error);
  process.exit(1);
}

export function handleUnhandledRejection(reason: unknown): void {
  const rejectionError = reason instanceof Error ? reason : new Error(String(reason));
  writeDiagnostic("error", "Unhandled Rejection:", rejectionError);
  console.error("Unhandled Rejection:", rejectionError);
  process.exit(1);
}

export function createConfigurationError(message: string): Error {
  return new Error(`Configuration Error: ${message}`);
}

export function createNoResultsMessage(query: string): string {
  return `ไม่พบผลลัพธ์สำหรับ: "${query}"\n`;
}

export function createNotFoundError(resource: string, id?: string): Error {
  const message = id ? `${resource} ไม่พบ: ${id}` : `${resource} ไม่พบ`;
  return new Error(message);
}

export function wrapError(error: unknown, context?: string): Error {
  const wrapped = new Error(
    context ? `${context}: ${error instanceof Error ? error.message : String(error)}` : String(error)
  );
  return wrapped;
}

// Error boundary for MCP tool calls
export function mcpToolErrorHandler(
  error: unknown,
  toolName?: string,
  args?: Record<string, unknown>
): never {
  const safeError = sanitizeErrorForTransport(error);
  writeDiagnostic("error", `MCP Tool Error: ${toolName}`, {
    tool: toolName,
    args,
    error: safeError.stack,
  });

  // Rethrow for MCP server to handle
  throw safeError;
}

// Sanitize error for transport (remove stack traces in production)
export function sanitizeErrorForTransport(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
