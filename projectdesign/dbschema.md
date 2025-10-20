# Firestore Root

## users (collection)
- `{userId}` (document)
  - `displayName`: string  
  - `phoneNumber`: string  
  - `avatarUrl`: string  
  - `bio`: string  
  - `lastSeen`: timestamp  
  - `presence`: `"online"` | `"offline"` | `"away"`  
  - `deviceTokens`: string[]  
  - `createdAt`: timestamp  
  - `updatedAt`: timestamp  

## chats (collection)
- `{chatId}` (document)
  - `type`: `"dm"` | `"group"`  
  - `participants`: string[]  _(user IDs)_  
  - `adminIds`: string[]  _(only for group chats)_  
  - `lastMessageId`: string  
  - `lastMessageText`: string  
  - `lastMessageAt`: timestamp  
  - `createdAt`: timestamp  
  - `updatedAt`: timestamp  

  ### messages (subcollection)
  - `{messageId}` (document)
    - `senderId`: string  
    - `text`: string | null  
    - `mediaUrl`: string | null  
    - `mediaMime`: string | null  
    - `replyToId`: string | null  
    - `status`: `"sending"` | `"sent"` | `"delivered"` | `"read"`  
    - `createdAt`: timestamp  
    - `edited`: boolean  
    - `reactions`: { [emoji: string]: string[] } _(optional map of userIds)_

  ### readReceipts (subcollection, optional)
  - `{userId}` (document)
    - `lastReadMessageId`: string  
    - `lastReadAt`: timestamp  

## groupInvites (optional)
- `{inviteId}` (document)
  - `chatId`: string  
  - `invitedUserId`: string  
  - `invitedBy`: string  
  - `expiresAt`: timestamp  
  - `status`: `"pending"` | `"accepted"` | `"declined"`  

## aiResults (optional, if using LLM features)
- `{resultId}` (document)
  - `chatId`: string  
  - `requestType`: `"summarize"` | `"translate"` | ...  
  - `inputContext`: string  
  - `resultText`: string  
  - `createdBy`: string  
  - `createdAt`: timestamp  
