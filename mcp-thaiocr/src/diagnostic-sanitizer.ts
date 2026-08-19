// Diagnostic sanitizer for secure error handling

export function initializeDiagnosticSanitizer(): void {
  // Setup any sanitization rules if needed
  // Currently empty, can be expanded for production use
}

export function sanitizeErrorForTransport(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}
