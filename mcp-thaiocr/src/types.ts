export type OCRSource = "file" | "url" | "base64";

export interface OCROCRArgs {
  source: OCRSource;
  file_path?: string;
  url?: string;
  base64?: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  repetition_penalty?: number;
}

export interface CollectionInfoArgs {
  refresh?: boolean;
}

export function isOCRArgs(args: unknown): args is OCROCRArgs {
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return false;
  }

  const ocrArgs = args as Record<string, unknown>;

  // Source is required and must be a string
  if (!ocrArgs.hasOwnProperty("source") || typeof ocrArgs.source !== "string") {
    return false;
  }

  const source = ocrArgs.source as OCRSource;
  if (source !== "file" && source !== "url" && source !== "base64") {
    return false;
  }

  // Validate file_path if source is file
  if (source === "file") {
    if (!ocrArgs.file_path || typeof ocrArgs.file_path !== "string") {
      return false;
    }
  }

  // Validate url if source is url
  if (source === "url") {
    if (!ocrArgs.url || typeof ocrArgs.url !== "string") {
      return false;
    }
  }

  // Validate base64 if source is base64
  if (source === "base64") {
    if (!ocrArgs.base64 || typeof ocrArgs.base64 !== "string") {
      return false;
    }
  }

  // Optional parameters validation
  if (ocrArgs.model !== undefined && typeof ocrArgs.model !== "string") {
    return false;
  }

  if (ocrArgs.max_tokens !== undefined) {
    if (typeof ocrArgs.max_tokens !== "number" || !Number.isInteger(ocrArgs.max_tokens) || ocrArgs.max_tokens < 1) {
      return false;
    }
  }

  if (ocrArgs.temperature !== undefined) {
    if (typeof ocrArgs.temperature !== "number" || Number.isNaN(ocrArgs.temperature) || ocrArgs.temperature < 0 || ocrArgs.temperature > 1) {
      return false;
    }
  }

  if (ocrArgs.top_p !== undefined) {
    if (typeof ocrArgs.top_p !== "number" || Number.isNaN(ocrArgs.top_p) || ocrArgs.top_p < 0 || ocrArgs.top_p > 1) {
      return false;
    }
  }

  if (ocrArgs.repetition_penalty !== undefined) {
    if (typeof ocrArgs.repetition_penalty !== "number" || Number.isNaN(ocrArgs.repetition_penalty) || ocrArgs.repetition_penalty <= 0) {
      return false;
    }
  }

  return true;
}

export function isCollectionInfoArgs(args: unknown): args is CollectionInfoArgs {
  if (args === undefined || args === null) {
    return true;
  }
  if (typeof args !== "object") {
    return false;
  }
  const infoArgs = args as Record<string, unknown>;
  if (infoArgs.refresh !== undefined && typeof infoArgs.refresh !== "boolean") {
    return false;
  }
  return true;
}

// Tool definition for Thai OCR
export const OCR_THAI_TOOL: { name: string; description: string; inputSchema: object } = {
  name: "ocr_thai",
  description:
    "แปลงภาพเป็นข้อความภาษาไทยและภาษาอังกฤษด้วย AI OCR (typhoon-ocr). รองรับไฟล์ภาพ PNG, JPG และ PDF. "
    + "ใช้กับเอกสารกฎหมายไทย, คำพิพากษาศาล, และเอกสารราชการอื่นๆ.",
  inputSchema: {
    type: "object",
    properties: {
      source: {
        type: "string",
        enum: ["file", "url", "base64"],
        description: "แหล่งข้อมูล: file (ไฟล์ในเซิร์ฟเวอร์), url (ลิงก์ภาพ), base64 (encoded string)",
      },
      file_path: {
        type: "string",
        description: "เส้นทางไฟล์ภาพเมื่อ source=file เช่น /tmp/1.png, /path/to/image.jpg",
      },
      url: {
        type: "string",
        description: "URL ของภาพเมื่อ source=url",
      },
      base64: {
        type: "string",
        description: "ฐานหกสี่ของภาพเมื่อ source=base64 (ไม่รวม data URI prefix)",
      },
      model: {
        type: "string",
        description: "โมเดล OCR ที่ใช้ (เช่น Typhoon-OCR1.5-2B). ค่าเริ่มต้นตาม config",
      },
      max_tokens: {
        type: "integer",
        minimum: 1,
        description: "จำนวนโทเค็นสูงสุดที่จะสร้าง (ค่าเริ่มต้น 4096)",
      },
      temperature: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "อุณหภูมิสำหรับการสร้างข้อความ (ค่าเริ่มต้น 0.1). ยิ่งต่ำยิ่งคาดเดาได้",
      },
      top_p: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "ค่า top-p sampling (ค่าเริ่มต้น 0.6)",
      },
      repetition_penalty: {
        type: "number",
        minimum: 0,
        description: "บทลงโทษการซ้ำซ้อน (ค่าเริ่มต้น 1.2)",
      },
    },
    required: ["source"],
  },
};
