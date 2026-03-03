import { Application, TurnState } from "@microsoft/teams-ai";
import { TurnContext, MemoryStorage, Attachment } from "botbuilder";
import { config } from "./config";
import { generateTicketTitle } from "./services/ollamaService";
import {
  createTicket,
  uploadAttachment,
} from "./services/manageEngineService";
import { downloadAttachments } from "./services/attachmentService";
import { checkRateLimit, recordTicket } from "./utils/rateLimiter";

// --- Turkish messages ---
const MSG = {
  welcome:
    "Merhaba! Ben IT Yardım Masası Botuyum. Yaşadığınız teknik sorunu yazın, sizin için destek talebi oluşturayım. İsterseniz sorununuzla ilgili ekran görüntüsü veya dosya da ekleyebilirsiniz.",
  empty:
    "Lütfen yaşadığınız sorunu yazın, sizin için destek talebi oluşturayım.",
  tooLong: (len: number) =>
    `Mesajınız çok uzun (${len} karakter). Lütfen en fazla ${config.maxMessageLength} karakterde özetleyin.`,
  rateLimit: (sec: number) =>
    `Kısa süre önce bir talep oluşturdunuz. Yeni talep için lütfen ${sec} saniye bekleyin.`,
  processing:
    "Talebiniz alındı. Destek bileti oluşturuluyor, lütfen bekleyin...",
  success: (displayId: string, subject: string) =>
    `Destek talebiniz başarıyla oluşturuldu!\n\n**Talep #${displayId}**\n**Başlık:** ${subject}\n\nBir teknisyen en kısa sürede sizinle iletişime geçecek.`,
  successWithAttachments: (
    displayId: string,
    subject: string,
    count: number
  ) =>
    `Destek talebiniz başarıyla oluşturuldu!\n\n**Talep #${displayId}**\n**Başlık:** ${subject}\n**Ek dosya:** ${count} dosya eklendi\n\nBir teknisyen en kısa sürede sizinle iletişime geçecek.`,
  error:
    "Üzgünüm, bilet oluşturulurken bir hata oluştu. Lütfen tekrar deneyin veya IT yardım masasıyla doğrudan iletişime geçin.",
};

/**
 * Creates and configures the Teams AI Application instance.
 */
export function createApp(): Application<TurnState> {
  const app = new Application<TurnState>({
    storage: new MemoryStorage(),
    removeRecipientMention: true,
    startTypingTimer: true,
  });

  // --- Welcome: ConversationUpdate ---
  app.conversationUpdate(
    "membersAdded",
    async (context: TurnContext, _state: TurnState) => {
      const membersAdded = context.activity.membersAdded || [];
      for (const member of membersAdded) {
        if (member.id !== context.activity.recipient.id) {
          await context.sendActivity(MSG.welcome);
        }
      }
    }
  );

  // --- Main message handler: catch all messages ---
  app.message(
    /.*/,
    async (context: TurnContext, _state: TurnState) => {
      const text = (context.activity.text || "").trim();
      const userId =
        context.activity.from?.aadObjectId ||
        context.activity.from?.id ||
        "unknown";
      const userName = context.activity.from?.name || "Unknown User";

      // Filter out non-user attachments (e.g., adaptive card submits)
      const attachments: Attachment[] = (
        context.activity.attachments || []
      ).filter(
        (a) =>
          a.contentType ===
            "application/vnd.microsoft.teams.file.download.info" ||
          a.contentType?.startsWith("image/")
      );

      // --- Validation ---
      if (!text && attachments.length === 0) {
        await context.sendActivity(MSG.empty);
        return;
      }

      if (text.length > config.maxMessageLength) {
        await context.sendActivity(MSG.tooLong(text.length));
        return;
      }

      // --- Rate limit ---
      const rateCheck = checkRateLimit(userId);
      if (!rateCheck.allowed) {
        await context.sendActivity(
          MSG.rateLimit(rateCheck.remainingSeconds)
        );
        return;
      }

      // --- Send "processing" message immediately to avoid Teams 15s timeout ---
      await context.sendActivity(MSG.processing);

      try {
        // 1) Generate title via Ollama
        const userMessage = text || "(Kullanıcı yalnızca dosya gönderdi)";
        const title = await generateTicketTitle(userMessage);

        // 2) Create ticket in ManageEngine
        const ticket = await createTicket(title, userMessage, userName);

        // 3) Record rate limit
        recordTicket(userId);

        // 4) Upload attachments (if any)
        let uploadedCount = 0;
        if (attachments.length > 0) {
          const files = await downloadAttachments(attachments);
          for (const file of files) {
            const ok = await uploadAttachment(ticket.id, file);
            if (ok) uploadedCount++;
          }
        }

        // 5) Send success message
        if (uploadedCount > 0) {
          await context.sendActivity(
            MSG.successWithAttachments(
              ticket.displayId,
              ticket.subject,
              uploadedCount
            )
          );
        } else {
          await context.sendActivity(
            MSG.success(ticket.displayId, ticket.subject)
          );
        }
      } catch (err) {
        console.error("[APP] Ticket creation failed:", err);
        await context.sendActivity(MSG.error);
      }
    }
  );

  return app;
}
