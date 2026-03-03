import fetch from "node-fetch";
import https from "https";
import FormData from "form-data";
import { config } from "../config";

// Self-signed certificate support
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export interface CreateTicketResult {
  id: string;
  displayId: string;
  subject: string;
}

export interface DownloadedFile {
  buffer: Buffer;
  fileName: string;
}

/**
 * Creates a ticket in ManageEngine ServiceDesk Plus.
 */
export async function createTicket(
  subject: string,
  description: string,
  requesterName: string
): Promise<CreateTicketResult> {
  const inputData = JSON.stringify({
    request: {
      subject,
      description,
      requester: { name: requesterName },
    },
  });

  const body = new URLSearchParams({ input_data: inputData });

  const response = await fetch(config.manageEngineEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      authtoken: config.manageEngineAuthToken,
    },
    body: body.toString(),
    agent: config.manageEngineEndpoint.startsWith("https") ? httpsAgent : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `ManageEngine API error ${response.status}: ${text}`
    );
  }

  const data = (await response.json()) as any;

  if (data.response_status?.status_code !== 2000) {
    throw new Error(
      `ManageEngine error: ${data.response_status?.status || "Unknown error"}`
    );
  }

  const result: CreateTicketResult = {
    id: String(data.request.id),
    displayId: String(data.request.display_id),
    subject: data.request.subject || subject,
  };

  console.log(
    `[ME] Ticket created: #${result.displayId} (internal: ${result.id})`
  );
  return result;
}

/**
 * Uploads a single attachment to an existing ticket.
 * Failures are logged but do not throw.
 */
export async function uploadAttachment(
  ticketId: string,
  file: DownloadedFile
): Promise<boolean> {
  try {
    const form = new FormData();
    form.append("inputfile", file.buffer, {
      filename: file.fileName,
      contentType: "application/octet-stream",
    });

    const url = `${config.manageEngineEndpoint}/${ticketId}/attachments`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        authtoken: config.manageEngineAuthToken,
        ...form.getHeaders(),
      },
      body: form as any,
      agent: url.startsWith("https") ? httpsAgent : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(
        `[ME] Attachment upload failed for "${file.fileName}": ${response.status} ${text}`
      );
      return false;
    }

    console.log(
      `[ME] Attachment uploaded: "${file.fileName}" to ticket ${ticketId}`
    );
    return true;
  } catch (err) {
    console.error(
      `[ME] Attachment upload error for "${file.fileName}":`,
      err
    );
    return false;
  }
}
