/**
 * RAG (Retrieval-Augmented Generation) Service
 * Handles AI-powered question answering about user conversations
 * 
 * Architecture:
 * 1. n8n webhook retrieves relevant documents from Pinecone vector DB
 * 2. App constructs prompt with retrieved context
 * 3. App calls OpenAI to generate answer
 */

import Constants from 'expo-constants';

const N8N_WEBHOOK_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_N8N_WEBHOOK_URL || 
                        process.env.EXPO_PUBLIC_N8N_WEBHOOK_URL;
const OPENAI_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_OPENAI_API_KEY || 
                       process.env.EXPO_PUBLIC_OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini'; // Cost-efficient model

/**
 * Metadata from Pinecone match
 */
interface PineconeMetadata {
  chatid: string;
  recipientIds: string[];
  recipientNames: string[];
  senderId: string;
  senderName: string;
  text: string; // Message text content
  timestamp: string; // ISO timestamp string
}

/**
 * Pinecone match structure
 */
interface PineconeMatch {
  id: string;
  score: number;
  values: number[];
  metadata: PineconeMetadata;
}

/**
 * Response from n8n webhook (Pinecone format)
 */
interface N8nWebhookResponse {
  matches: PineconeMatch[];
}

/**
 * Processed document for RAG
 */
export interface RelevantDocument {
  text: string;
  senderId: string;
  senderName: string;
  chatId: string;
  timestamp: number;
  score: number;
  recipientIds: string[];
  recipientNames: string[];
}

/**
 * Validate that required configuration is present
 */
function validateConfig(): void {
  if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'your_n8n_webhook_url_here') {
    throw new Error('n8n webhook URL not configured. Please add EXPO_PUBLIC_N8N_WEBHOOK_URL to your .env file.');
  }
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key not configured. Please add EXPO_PUBLIC_OPENAI_API_KEY to your .env file.');
  }
}

/**
 * Query n8n webhook to retrieve relevant documents from Pinecone
 * 
 * @param question - User's question
 * @param userId - Current user's ID
 * @returns Array of relevant documents
 */
async function queryN8nWebhook(
  question: string,
  userId: string
): Promise<RelevantDocument[]> {
  if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL === 'your_n8n_webhook_url_here') {
    throw new Error('n8n webhook URL not configured');
  }

  console.log('🔍 Querying n8n webhook for relevant documents...');
  console.log('Question:', question);
  console.log('User ID:', userId);

  try {
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        userId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('n8n webhook error:', response.status, errorText);
      throw new Error(`n8n webhook failed: ${response.status}`);
    }

    const data: N8nWebhookResponse = await response.json();
    
    console.log('🔍 Raw webhook response:', JSON.stringify(data, null, 2));
    
    if (!data.matches || !Array.isArray(data.matches)) {
      console.warn('Invalid response format from n8n webhook:', data);
      return [];
    }

    // Convert Pinecone matches to RelevantDocument format
    const documents: RelevantDocument[] = data.matches.map((match, index) => {
      console.log(`\n📋 Processing match ${index + 1}:`);
      console.log('  - Raw match:', JSON.stringify(match, null, 2));
      console.log('  - match.metadata.text:', match.metadata.text);
      console.log('  - match.metadata.text type:', typeof match.metadata.text);
      
      return {
        text: match.metadata.text || '[Message content not available]',
        senderId: match.metadata.senderId,
        senderName: match.metadata.senderName,
        chatId: match.metadata.chatid, // Note: lowercase in Pinecone
        timestamp: new Date(match.metadata.timestamp).getTime(), // Convert ISO string to milliseconds
        score: match.score,
        recipientIds: match.metadata.recipientIds || [],
        recipientNames: match.metadata.recipientNames || [],
      };
    });

    console.log(`✅ Retrieved ${documents.length} relevant documents from Pinecone`);
    return documents;
  } catch (error) {
    console.error('❌ Error querying n8n webhook:', error);
    throw error;
  }
}

/**
 * Construct a RAG prompt with retrieved documents as context
 * 
 * @param question - User's question
 * @param documents - Relevant documents from Pinecone
 * @returns Formatted prompt for OpenAI
 */
function constructRAGPrompt(
  question: string,
  documents: RelevantDocument[]
): Array<{ role: string; content: string }> {
  // If no documents found, inform the AI
  if (documents.length === 0) {
    return [
      {
        role: 'system',
        content: 'You are MessageAI Bot, a helpful assistant that answers questions about the user\'s conversations. You have access to the user\'s message history to provide accurate answers.',
      },
      {
        role: 'user',
        content: question,
      },
      {
        role: 'assistant',
        content: 'I couldn\'t find any relevant information in your conversation history to answer that question. Could you rephrase or ask something else?',
      },
    ];
  }

  // Format documents as context
  const contextText = documents
    .map((doc, index) => {
      const date = new Date(doc.timestamp).toLocaleString();
      const sender = doc.senderName || doc.senderId;
      return `[${index + 1}] ${date} - ${sender}: ${doc.text}`;
    })
    .join('\n\n');

  const systemPrompt = `You are MessageAI Bot, a helpful assistant that answers questions about the user's conversations. You have access to the user's message history and can provide accurate, contextual answers.

When answering:
- Be concise and direct
- Cite specific messages when relevant (e.g., "Amy mentioned..." or "In your conversation on...")
- If the context doesn't contain enough information, say so honestly
- Be conversational and friendly
- Focus on answering the question asked`;

  const userPrompt = `Here are relevant messages from my conversation history:

${contextText}

Based on these messages, please answer my question: ${question}`;

  return [
    {
      role: 'system',
      content: systemPrompt,
    },
    {
      role: 'user',
      content: userPrompt,
    },
  ];
}

/**
 * Make a request to OpenAI API (reused pattern from openai.service.ts)
 */
async function makeOpenAIRequest(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'your_openai_api_key_here') {
    throw new Error('OpenAI API key not configured');
  }

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
        max_tokens: 500, // Shorter responses for chat interface
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
 * Main RAG function: Answer a user's question about their conversations
 * 
 * Flow:
 * 1. Query n8n webhook to get relevant documents from Pinecone
 * 2. Construct prompt with retrieved context
 * 3. Call OpenAI to generate answer
 * 4. Return answer
 * 
 * @param question - User's question
 * @param userId - Current user's ID
 * @returns AI-generated answer
 */
export async function answerQuestion(
  question: string,
  userId: string
): Promise<string> {
  validateConfig();

  if (!question || !question.trim()) {
    throw new Error('Question cannot be empty');
  }

  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log('🤖 Starting RAG process...');
  console.log('Question:', question);

  try {
    // Step 1: Retrieve relevant documents
    const documents = await queryN8nWebhook(question, userId);

    // Step 2: Construct RAG prompt
    const messages = constructRAGPrompt(question, documents);

    // Special case: No documents found
    if (documents.length === 0) {
      console.log('⚠️ No relevant documents found');
      return "I couldn't find any relevant information in your conversation history to answer that question. Could you rephrase or ask something else?";
    }

    // Log RAG context before sending to OpenAI
    console.log('📊 ===== RAG QUERY CONTEXT =====');
    console.log(`📝 User Question: "${question}"`);
    console.log(`📚 Retrieved ${documents.length} relevant messages:`);
    documents.forEach((doc, index) => {
      const date = new Date(doc.timestamp).toLocaleString();
      console.log(`  [${index + 1}] Score: ${doc.score.toFixed(3)} | ${date}`);
      console.log(`      From: ${doc.senderName} (${doc.senderId})`);
      console.log(`      Chat: ${doc.chatId}`);
      console.log(`      Text: "${doc.text}"`);
      console.log('');
    });
    console.log('🤖 Constructed Prompt for OpenAI:');
    messages.forEach((msg, index) => {
      console.log(`  [${index + 1}] Role: ${msg.role}`);
      console.log(`      Content: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? '...' : ''}`);
      console.log('');
    });
    console.log('================================');

    // Step 3: Get answer from OpenAI
    console.log('🧠 Generating answer with OpenAI...');
    const answer = await makeOpenAIRequest(messages);
    
    console.log('✅ RAG process complete');
    console.log(`💬 Answer: "${answer}"`);
    return answer;

  } catch (error) {
    console.error('❌ RAG process failed:', error);
    
    // Provide user-friendly error messages
    if (error instanceof Error) {
      if (error.message.includes('webhook')) {
        return "Sorry, I'm having trouble accessing your conversation history right now. Please try again later.";
      } else if (error.message.includes('OpenAI')) {
        return "Sorry, I'm having trouble generating a response right now. Please try again later.";
      }
    }
    
    // Generic fallback
    return "Sorry, something went wrong while processing your question. Please try again.";
  }
}

