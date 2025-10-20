/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { setGlobalOptions } from "firebase-functions";
import * as logger from "firebase-functions/logger";
import { onCall } from "firebase-functions/v2/https";

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// For cost control, set max instances to prevent runaway costs
setGlobalOptions({ maxInstances: 10 });

/**
 * Test function to verify Cloud Functions are working
 * Call this from the app with: httpsCallable(functions, 'testFunction')
 */
export const testFunction = onCall((request) => {
  logger.info("testFunction called", {data: request.data});
  
  const name = request.data?.name || "Anonymous";
  
  return {
    success: true,
    message: `Hello ${name}! Cloud Functions are working! 🎉`,
    timestamp: new Date().toISOString(),
    receivedData: request.data,
  };
});
