import * as admin from "firebase-admin";
import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

setGlobalOptions({
  region: "us-east1",
  timeoutSeconds: 10,
  memory: "256MiB",
});

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const N8N_WEBHOOK_URL = defineSecret("N8N_WEBHOOK_URL");

interface ChatMessage {
  chatId: string;
  senderId: string;
  text?: string;
  createdAt?: FirebaseFirestore.Timestamp | string;
  status?: string;
  edited?: boolean;
}

export const onMessageCreate = onDocumentCreated(
  {
    document: "chats/{chatId}/messages/{messageId}",
    secrets: [N8N_WEBHOOK_URL],
  },
  async (event) => {
    const message = event.data?.data() as ChatMessage | undefined;
    const messageId = event.params.messageId;
    const chatId = event.params.chatId;

    if (!message) {
      logger.error("No message data found", { messageId, chatId });
      return;
    }

    // Fetch chat document to get participant information
    const db = admin.firestore();
    const chatDoc = await db.collection("chats").doc(chatId).get();
    const chatData = chatDoc.data();
    const participants = chatData?.participantIds || [];
    
    // Get recipient IDs (all participants except the sender)
    const recipientIds = participants.filter((id: string) => id !== message.senderId);

    // Fetch sender's user document to get display name
    const senderDoc = await db.collection("users").doc(message.senderId).get();
    const senderData = senderDoc.data();
    const senderName = senderData?.displayName || "Unknown";

    // Fetch recipient user documents to get display names
    const recipientPromises = recipientIds.map(async (recipientId: string) => {
      const recipientDoc = await db.collection("users").doc(recipientId).get();
      const recipientData = recipientDoc.data();
      return recipientData?.displayName || "Unknown";
    });
    const recipientNames = await Promise.all(recipientPromises);

    // Format timestamp
    const timestamp = message.createdAt 
      ? (message.createdAt as any)?.toDate?.()?.toISOString() ?? 
        (typeof message.createdAt === 'string' ? message.createdAt : new Date().toISOString())
      : new Date().toISOString();

    logger.info("New message created, sending to n8n webhook", {
      messageId,
      chatId,
      senderId: message.senderId,
      senderName,
      recipientIds,
      recipientNames,
      text: message.text,
      timestamp,
    });

    try {
      const webhookUrl = N8N_WEBHOOK_URL.value();

      logger.info("Attempting to send webhook request", {
        messageId,
        chatId,
        webhookUrl,
      });

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId,
          chatId,
          senderId: message.senderId,
          senderName,
          recipientIds,
          recipientNames,
          text: message.text,
          timestamp,
          status: message.status,
          edited: message.edited,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unable to read response");
        logger.error("Webhook returned non-OK status", {
          messageId,
          chatId,
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
        });
        throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
      }

      logger.info("Successfully sent message to n8n webhook", {
        messageId,
        chatId,
        status: response.status,
      });
    } catch (error) {
      logger.error("Failed to send message to n8n webhook", {
        messageId,
        chatId,
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });
    }
  }
);
