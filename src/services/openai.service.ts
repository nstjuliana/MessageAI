/**
 * OpenAI Service
 * Handles AI features using OpenAI API
 * 
 * Features:
 * - Message translation
 * - Chat summarization
 */

import type { Message } from '@/types/chat.types';
import Constants from 'expo-constants';

const OPENAI_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY || 
                       process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // Cost-efficient model

/**
 * Validate that OpenAI API key is configured
 */
function validateApiKey(): void {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.');
  }
}

/**
 * Make a request to OpenAI API
 */
async function makeOpenAIRequest(messages: Array<{ role: string; content: string }>): Promise<string> {
  validateApiKey();

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.3, // Lower temperature for more consistent results
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', errorData);
      
      if (response.status === 401) {
        throw new Error('Invalid OpenAI API key');
      } else if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`OpenAI API error: ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenAI API');
    }

    const content = data.choices[0].message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    return content.trim();
  } catch (error) {
    if (error instanceof Error) {
      console.error('OpenAI request failed:', error.message);
      throw error;
    }
    throw new Error('Unknown error occurred while calling OpenAI API');
  }
}

/**
 * Translate a message to the target language
 * 
 * @param text - The text to translate
 * @param targetLanguage - Target language (default: 'English')
 * @returns Translated text
 */
export async function translateMessage(
  text: string,
  targetLanguage: string = 'English'
): Promise<string> {
  if (!text || !text.trim()) {
    throw new Error('No text to translate');
  }

  console.log(`🌐 Translating message to ${targetLanguage}`);

  const messages = [
    {
      role: 'system',
      content: `You are a professional translator. Translate the following text to ${targetLanguage}. Only provide the translation, without any explanations or additional text. If the text is already in ${targetLanguage}, return it as-is.`,
    },
    {
      role: 'user',
      content: text,
    },
  ];

  try {
    const translatedText = await makeOpenAIRequest(messages);
    console.log('✅ Translation successful');
    return translatedText;
  } catch (error) {
    console.error('❌ Translation failed:', error);
    throw error;
  }
}

/**
 * Generate a summary of a chat conversation
 * 
 * @param messages - Array of messages to summarize
 * @param limit - Optional limit on number of messages to include (for future use)
 * @returns Summary text
 */
export async function summarizeChat(
  messages: Message[],
  limit?: number
): Promise<string> {
  if (!messages || messages.length === 0) {
    throw new Error('No messages to summarize');
  }

  console.log(`📝 Generating chat summary for ${messages.length} messages`);

  // Apply limit if specified (for future use)
  const messagesToSummarize = limit ? messages.slice(-limit) : messages;

  // Filter out system messages and format for OpenAI
  const conversationText = messagesToSummarize
    .filter(msg => msg.senderId !== 'system' && msg.text)
    .map(msg => {
      const timestamp = new Date(msg.createdAt).toLocaleString();
      return `[${timestamp}] ${msg.text}`;
    })
    .join('\n');

  if (!conversationText.trim()) {
    throw new Error('No valid messages to summarize');
  }

  const promptMessages = [
    {
      role: 'system',
      content: 'You are a helpful assistant that summarizes chat conversations. Provide a concise, informative summary of the conversation covering the main topics, key points, and any important decisions or conclusions. Keep the summary natural and easy to read.',
    },
    {
      role: 'user',
      content: `Please summarize the following conversation:\n\n${conversationText}`,
    },
  ];

  try {
    const summary = await makeOpenAIRequest(promptMessages);
    console.log('✅ Chat summary generated');
    return summary;
  } catch (error) {
    console.error('❌ Summary generation failed:', error);
    throw error;
  }
}

