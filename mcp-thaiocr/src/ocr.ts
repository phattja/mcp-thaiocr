import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOCRConfig, validateOCRConfig } from "./config.js";
import { createConfigurationError } from "./error-handler.js";
import { logMessage } from "./logging.js";

export interface OCRRequestArgs {
  source: "file" | "url" | "base64";
  file_path?: string;
  url?: string;
  base64?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
}

export async function performOCR(
  mcpServer: McpServer,
  args: OCRRequestArgs,
  signal?: AbortSignal,
): Promise<string> {
  // Validate configuration
  const configIssue = validateOCRConfig();
  if (configIssue) {
    throw createConfigurationError(configIssue);
  }

  const config = getOCRConfig();
  const model = args.model || config.ocrModel;
  const maxTokens = args.max_tokens || config.defaultMaxTokens;
  const temperature = args.temperature ?? config.defaultTemperature;
  const topP = args.top_p ?? config.defaultTopP;
  const repetitionPenalty = args.repetition_penalty ?? config.defaultRepetitionPenalty;

  logMessage(mcpServer, "info", `Performing OCR with model: ${model}`, {
    source: args.source,
    maxTokens,
    temperature,
    topP,
    repetitionPenalty,
  });

  // Validate source-specific parameters
  if (args.source === "file" && !args.file_path) {
    throw new Error("file_path is required when source=file");
  }
  if (args.source === "url" && !args.url) {
    throw new Error("url is required when source=url");
  }
  if (args.source === "base64" && !args.base64) {
    throw new Error("base64 is required when source=base64");
  }

  // Perform OCR based on source type
  let imageData: Uint8Array;
  let mimeType: string;

  switch (args.source) {
    case "file":
      try {
        const fs = await import("fs");
        imageData = fs.readFileSync(args.file_path!);
        mimeType = detectMimeType(args.file_path!);
        logMessage(mcpServer, "debug", `Read file: ${args.file_path}, size: ${imageData.length} bytes`);
      } catch (error) {
        throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;

    case "url":
      try {
        const response = await fetch(args.url!, { signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        imageData = new Uint8Array(await response.arrayBuffer());
        mimeType = detectMimeTypeFromUrl(args.url!);
        logMessage(mcpServer, "debug", `Fetched image from URL, size: ${imageData.length} bytes`);
      } catch (error) {
        throw new Error(`Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;

    case "base64":
      try {
        imageData = Uint8Array.from(atob(args.base64!), c => c.charCodeAt(0));
        mimeType = detectMimeTypeFromBase64(args.base64!) || "image/png";
        logMessage(mcpServer, "debug", `Decoded base64 image, size: ${imageData.length} bytes`);
      } catch (error) {
        throw new Error(`Failed to decode base64: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;

    default:
      throw new Error(`Unsupported source type: ${args.source}`);
  }

  // Convert image to base64 for API call
  const base64Image = Buffer.from(imageData).toString("base64");

  // Prepare the OCR request
  const ocrResponse = await callOCRApi({
    endpoint: config.ocrEndpoint,
    model,
    base64Image,
    mimeType,
    maxTokens,
    temperature,
    topP,
    repetitionPenalty,
    signal,
  });

  return ocrResponse;
}

interface OCRApiRequest {
  endpoint: string;
  model: string;
  base64Image: string;
  mimeType: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  repetitionPenalty: number;
  signal?: AbortSignal;
}

async function callOCRApi(req: OCRApiRequest): Promise<string> {
  const messages = [
    {
      role: "user",
      content: [
        {
          type: "image",
          image: {
            url: `data:${req.mimeType};base64,${req.base64Image}`,
          },
        },
        {
          type: "text",
          text: "Extract text from this Thai document image. Include all visible text including headers, footers, and any special formatting. Return the result in plain text format.",
        },
      ],
    },
  ];

  const response = await fetch(`${req.endpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
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

  const result = await response.json();
  return result.choices[0]?.message?.content || "No text extracted from image.";
}

function detectMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return "image/png";
  }
}

function detectMimeTypeFromUrl(url: string): string {
  const ext = url.split("/").pop()?.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    default:
      return "image/png";
  }
}

function detectMimeTypeFromBase64(base64: string): string | null {
  // Check for JPEG signature
  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }
  // Check for PNG signature
  if (base64.startsWith("iVBORw0KGgo=")) {
    return "image/png";
  }
  // Check for GIF signature
  if (base64.startsWith("R0lGODdh")) {
    return "image/gif";
  }
  return null;
}

