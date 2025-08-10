/**
 * Utility functions for the message manager
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

/**
 * Extract JSON from model output, handling both plain JSON and code-block-wrapped JSON.
 */
export function extractJsonFromModelOutput(content: string): any {
  try {
    // If content is wrapped in code blocks, extract just the JSON part
    if (content.includes('```')) {
      // Find the JSON content between code blocks
      const parts = content.split('```');
      if (parts.length > 1 && parts[1] !== undefined) {
        // TypeScript safety: ensure parts[1] exists
        const extractedContent = parts[1];
        content = extractedContent;
        // Remove language identifier if present (e.g., 'json\n')
        if (content.includes('\n')) {
          const lines = content.split('\n');
          if (lines.length > 1) {
            // Skip the first line (language identifier) and join the rest
            content = lines.slice(1).join('\n');
          }
        }
      }
    }
    // Parse the cleaned content
    return JSON.parse(content);
  } catch (e) {
    console.warn(`Failed to parse model output: ${content} ${e}`);
    throw new Error('Could not parse response.');
  }
}

/**
 * Convert input messages to a format that is compatible with the planner model
 */
export function convertInputMessages(
  inputMessages: BaseMessage[],
  modelName: string | null,
): BaseMessage[] {
  if (modelName === null) {
    return inputMessages;
  }
  if (modelName === 'deepseek-reasoner' || modelName.includes('deepseek-r1')) {
    let convertedInputMessages = convertMessagesForNonFunctionCallingModels(inputMessages);
    let mergedInputMessages = mergeSuccessiveMessages(convertedInputMessages, HumanMessage);
    mergedInputMessages = mergeSuccessiveMessages(mergedInputMessages, AIMessage);
    return mergedInputMessages;
  }
  return inputMessages;
}

/**
 * Convert messages for non-function-calling models
 */
function convertMessagesForNonFunctionCallingModels(inputMessages: BaseMessage[]): BaseMessage[] {
  const outputMessages: BaseMessage[] = [];
  for (const message of inputMessages) {
    if (message instanceof HumanMessage) {
      outputMessages.push(message);
    } else if (message instanceof SystemMessage) {
      outputMessages.push(message);
    } else if (message instanceof ToolMessage) {
      // Wrap message content in an object with content field if it's a complex type
      if (typeof message.content === 'string') {
        outputMessages.push(new HumanMessage({ content: message.content }));
      } else {
        // Handle complex content type
        outputMessages.push(new HumanMessage({ content: JSON.stringify(message.content) }));
      }
    } else if (message instanceof AIMessage) {
      // @ts-ignore - TypeScript doesn't know about tool_calls property
      if (message.tool_calls) {
        // @ts-ignore
        const toolCalls = JSON.stringify(message.tool_calls);
        outputMessages.push(new AIMessage({ content: toolCalls }));
      } else {
        outputMessages.push(message);
      }
    } else {
      throw new Error(`Unknown message type: ${typeof message}`);
    }
  }
  return outputMessages;
}

/**
 * Some models like deepseek-reasoner dont allow multiple human messages in a row.
 * This function merges them into one.
 */
function mergeSuccessiveMessages(
  messages: BaseMessage[],
  classToMerge: { new (...args: any[]): BaseMessage },
): BaseMessage[] {
  const mergedMessages: BaseMessage[] = [];
  let streak = 0;
  for (const message of messages) {
    if (message instanceof classToMerge) {
      streak += 1;
      if (streak > 1) {
        if (Array.isArray(message.content)) {
          // @ts-ignore
          mergedMessages[mergedMessages.length - 1].content += message.content[0].text;
        } else {
          // @ts-ignore
          mergedMessages[mergedMessages.length - 1].content += message.content;
        }
      } else {
        mergedMessages.push(message);
      }
    } else {
      mergedMessages.push(message);
      streak = 0;
    }
  }
  return mergedMessages;
}

/**
 * Save conversation history to file.
 */
export function saveConversation(
  inputMessages: BaseMessage[],
  response: any,
  target: string,
  encoding: string | null = null,
): void {
  // Create folders if not exists
  fs.mkdirSync(path.dirname(target), { recursive: true });

  // Open file for writing
  const fileContent = [];

  // Write messages
  for (const message of inputMessages) {
    fileContent.push(` ${message.constructor.name} `);

    if (Array.isArray(message.content)) {
      for (const item of message.content) {
        if (typeof item === 'object' && item.type === 'text') {
          fileContent.push(item.text.trim());
        }
      }
    } else if (typeof message.content === 'string') {
      try {
        const content = JSON.parse(message.content);
        fileContent.push(JSON.stringify(content, null, 2));
      } catch (e) {
        fileContent.push(message.content.trim());
      }
    }

    fileContent.push('');
  }

  // Write response
  fileContent.push(' RESPONSE');
  // Assuming response has a toJSON method or similar
  try {
    const responseJson = JSON.parse(JSON.stringify(response));
    fileContent.push(JSON.stringify(responseJson, null, 2));
  } catch (e) {
    fileContent.push(JSON.stringify(response, null, 2));
  }

  // Write to file
  fs.writeFileSync(
    target,
    fileContent.join('\n'),
    encoding ? { encoding: encoding as BufferEncoding } : undefined,
  );
}
