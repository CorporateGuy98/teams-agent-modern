import fetch from "node-fetch";
import { Attachment } from "botbuilder";
import { getBotToken } from "../utils/tokenCache";
import { DownloadedFile } from "./manageEngineService";

/**
 * Downloads all attachments from a Teams message.
 * Returns successfully downloaded files; failures are logged silently.
 */
export async function downloadAttachments(
  attachments: Attachment[]
): Promise<DownloadedFile[]> {
  const files: DownloadedFile[] = [];

  for (const att of attachments) {
    try {
      const downloaded = await downloadSingleAttachment(att);
      if (downloaded) {
        files.push(downloaded);
      }
    } catch (err) {
      console.error(
        `[ATTACH] Failed to download attachment "${att.name || "unknown"}":`,
        err
      );
    }
  }

  return files;
}

async function downloadSingleAttachment(
  att: Attachment
): Promise<DownloadedFile | null> {
  let downloadUrl: string | undefined;
  let fileName = att.name || "attachment";

  // Type 1: File download (SharePoint pre-signed URL)
  if (
    att.contentType === "application/vnd.microsoft.teams.file.download.info"
  ) {
    downloadUrl = (att.content as any)?.downloadUrl;
    if (!downloadUrl) {
      console.warn(`[ATTACH] File attachment "${fileName}" has no downloadUrl`);
      return null;
    }

    // Pre-signed URL — no auth needed
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      console.error(
        `[ATTACH] Download failed for "${fileName}": ${response.status}`
      );
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[ATTACH] Downloaded file: "${fileName}" (${buffer.length} bytes)`);
    return { buffer, fileName };
  }

  // Type 2: Inline image
  if (att.contentType?.startsWith("image/")) {
    downloadUrl = att.contentUrl;
    if (!downloadUrl) {
      console.warn(`[ATTACH] Inline image has no contentUrl`);
      return null;
    }

    // Get bot token for authenticated download (production only)
    const token = await getBotToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(downloadUrl, { headers });
    if (!response.ok) {
      console.error(
        `[ATTACH] Image download failed: ${response.status}`
      );
      return null;
    }

    // Use content-type to determine extension if name is generic
    if (fileName === "attachment") {
      const ct = response.headers.get("content-type") || att.contentType;
      const ext = ct?.split("/")[1]?.split(";")[0] || "png";
      fileName = `image.${ext}`;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`[ATTACH] Downloaded image: "${fileName}" (${buffer.length} bytes)`);
    return { buffer, fileName };
  }

  console.warn(
    `[ATTACH] Skipping unsupported attachment type: ${att.contentType}`
  );
  return null;
}
