import { packageVersion } from "./version.js";

export const THAIOCR_TOOL_NAME = "thaiocr";
export const THAIOCR_TOOL_ALIASES = ["ocr_thai"] as const;

export const THAIOCR_GUIDES_URI = "thaiocr://guides";
export const THAIOCR_CONFIG_URI = "thaiocr://config";
export const THAIOCR_GUIDES_URI_ALIASES = ["help://usage-guide"];
export const THAIOCR_CONFIG_URI_ALIASES = ["config://server-config"];

export const SUPPORTED_FILE_TYPES =
  "PNG, JPEG/JPG, WEBP, GIF, TIFF/TIF, BMP, PDF";

export const OCR_THAI_TOOL: { name: string; description: string; inputSchema: object } = {
  name: THAIOCR_TOOL_NAME,
  description:
    `mcp-thaiocr ${packageVersion}. Extract Thai and English text from documents with Typhoon-OCR1.5-2B. `
    + `Supported file types: ${SUPPORTED_FILE_TYPES}. `
    + "Images always process page 1. PDFs default to page 1; pass `page` as `all` or a range (`1-3`, `1,3`, `4,6,7-9`) for more pages. Output is separated by `--- Page N ---`. "
    + "Task types: `default` (plain markdown), `structure` (HTML tables), `v1.5` (clean Markdown with HTML tables and Thai figure descriptions). "
    + "IMPORTANT: llama.cpp WebUI and Open WebUI do not attach chat images to this tool. "
    + "You must pass the image yourself as `image`: an absolute host path (e.g. /tmp/1.png), "
    + "a URL, a data:image/...;base64,... URI, raw base64, or an Open WebUI file id. "
    + "A bare filename is searched in /tmp, /tmp/ocr-inbox, and Open WebUI uploads.",
  inputSchema: {
    type: "object",
    properties: {
      image: {
        type: "string",
        description:
          "Image to OCR: absolute path, filename, http(s) URL, data URI, raw base64, or Open WebUI file id",
      },
      source: {
        type: "string",
        enum: ["file", "url", "base64"],
        description: "Optional. Auto-detected from image/file_path/url/base64 when omitted",
      },
      file_path: {
        type: "string",
        description: "Local file path when the image is on this host",
      },
      url: {
        type: "string",
        description: "http(s) URL of the image",
      },
      base64: {
        type: "string",
        description: "Raw base64 or data URI of the image",
      },
      file_id: {
        type: "string",
        description: "Open WebUI file id (requires OPENWEBUI_URL)",
      },
      __files__: {
        type: "array",
        description: "Open WebUI attached files (injected by the client when supported)",
        items: { type: "object" },
      },
      model: {
        type: "string",
        description: "OCR model name (default Typhoon-OCR1.5-2B)",
      },
      task: {
        type: "string",
        enum: ["default", "structure", "v1.5"],
        description:
          "OCR task type: 'default' (plain text markdown), 'structure' (HTML tables and placeholders), 'v1.5' (clean Markdown with HTML tables and Thai figure descriptions). Default v1.5.",
      },
      prompt: {
        type: "string",
        description:
          "Custom instructions appended to the OCR prompt for every page. Default: extract all text as clean Markdown with no extra explanation.",
      },
      page: {
        type: "string",
        description:
          "Pages to process for PDF inputs. Default '1' (first page). Use 'all' or a list like '1-3', '1,3', or '4,6,7-9'. Single images always process page 1.",
      },
      max_tokens: {
        type: "integer",
        minimum: 1,
        description: "Maximum tokens to generate (default 32768)",
      },
      temperature: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Sampling temperature (default 0.1)",
      },
      top_p: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "Top-p sampling (default 0.6)",
      },
      repetition_penalty: {
        type: "number",
        minimum: 0,
        description: "Repetition penalty (default 1.2)",
      },
    },
  },
};
