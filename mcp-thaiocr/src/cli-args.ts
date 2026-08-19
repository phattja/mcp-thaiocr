export interface ParsedCliArgs {
  help: boolean;
  version: boolean;
  httpPort?: number;
  httpHost?: string;
  ocrEndpoint?: string;
  ocrModel?: string;
}

export class CliParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliParseError";
  }
}

function takeValue(args: string[], index: number, flag: string): { value: string; next: number } {
  const current = args[index];
  if (current.startsWith(`${flag}=`)) {
    const value = current.slice(flag.length + 1);
    if (!value) {
      throw new CliParseError(`Missing value for ${flag}`);
    }
    return { value, next: index };
  }
  if (index + 1 >= args.length) {
    throw new CliParseError(`Missing value for ${flag}`);
  }
  return { value: args[index + 1], next: index + 1 };
}

export function parseCliArgs(args: string[]): ParsedCliArgs {
  const result: ParsedCliArgs = {
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--version" || arg === "-v") {
      result.version = true;
    } else if (arg === "--http-port" || arg.startsWith("--http-port=")) {
      const taken = takeValue(args, i, "--http-port");
      const port = parseInt(taken.value, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        throw new CliParseError(`Invalid HTTP port: ${taken.value}. Must be between 1 and 65535.`);
      }
      result.httpPort = port;
      i = taken.next;
    } else if (arg === "--http-host" || arg.startsWith("--http-host=")) {
      const taken = takeValue(args, i, "--http-host");
      result.httpHost = taken.value;
      i = taken.next;
    } else if (arg === "--ocr-endpoint" || arg.startsWith("--ocr-endpoint=")) {
      const taken = takeValue(args, i, "--ocr-endpoint");
      result.ocrEndpoint = taken.value;
      i = taken.next;
    } else if (arg === "--ocr-model" || arg.startsWith("--ocr-model=")) {
      const taken = takeValue(args, i, "--ocr-model");
      result.ocrModel = taken.value;
      i = taken.next;
    } else if (arg.startsWith("-")) {
      throw new CliParseError(`Unknown option: ${arg}`);
    }
  }

  return result;
}
