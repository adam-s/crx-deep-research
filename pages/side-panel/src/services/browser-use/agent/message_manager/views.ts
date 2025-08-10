import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from '@langchain/core/messages';

// Forward declaration to avoid circular imports
export interface AgentOutput {
  currentState: any;
  action: any[];
}

// Define ToolCall interface to match LangChain's expected structure
export interface ToolCall {
  name: string;
  args: any;
  id: string;
  type: 'tool_call';
}

export class MessageMetadata {
  /**
   * Metadata for a message
   */
  tokens: number = 0;

  constructor(data?: Partial<MessageMetadata>) {
    if (data) {
      Object.assign(this, data);
    }
  }
}

export class ManagedMessage {
  /**
   * A message with its metadata
   */
  message: BaseMessage;
  metadata: MessageMetadata;

  constructor(message: BaseMessage, metadata: MessageMetadata = new MessageMetadata()) {
    this.message = message;
    this.metadata = metadata;
  }

  toJSON(): any {
    /**
     * Returns the JSON representation of the model.
     *
     * It uses langchain's serialization for the message property
     * before encoding the overall object.
     */
    const data: any = {
      metadata: this.metadata,
    };

    // Handle message serialization based on its type
    if (this.message instanceof SystemMessage) {
      data.message = {
        type: 'system',
        content: this.message.content,
      };
    } else if (this.message instanceof HumanMessage) {
      data.message = {
        type: 'human',
        content: this.message.content,
      };
    } else if (this.message instanceof AIMessage) {
      data.message = {
        type: 'ai',
        content: this.message.content,
        tool_calls: this.message.tool_calls || undefined,
      };
    } else if (this.message instanceof ToolMessage) {
      data.message = {
        type: 'tool',
        content: this.message.content,
        tool_call_id: this.message.tool_call_id,
      };
    } else {
      data.message = {
        type: 'base',
        content: this.message.content,
      };
    }

    return data;
  }

  static fromJSON(data: any): ManagedMessage {
    /**
     * Create a ManagedMessage from JSON data
     */
    let message: BaseMessage;

    if (data.message.type === 'system') {
      message = new SystemMessage(data.message.content);
    } else if (data.message.type === 'human') {
      message = new HumanMessage(data.message.content);
    } else if (data.message.type === 'ai') {
      message = new AIMessage({
        content: data.message.content,
        tool_calls: data.message.tool_calls || undefined,
      });
    } else if (data.message.type === 'tool') {
      message = new ToolMessage({
        content: data.message.content,
        tool_call_id: data.message.tool_call_id,
      });
    } else {
      // Create a human message instead of BaseMessage which is abstract
      message = new HumanMessage(data.message.content);
    }

    return new ManagedMessage(message, data.metadata);
  }
}

export class MessageHistory {
  /**
   * History of messages with metadata
   */
  messages: ManagedMessage[] = [];
  currentTokens: number = 0;

  addMessage(
    message: BaseMessage,
    metadata: MessageMetadata,
    position: number | null = null,
  ): void {
    /**
     * Add message with metadata to history
     */
    if (position === null) {
      this.messages.push(new ManagedMessage(message, metadata));
    } else {
      this.messages.splice(position, 0, new ManagedMessage(message, metadata));
    }
    this.currentTokens += metadata.tokens;
  }

  addModelOutput(output: AgentOutput): void {
    /**
     * Add model output as AI message
     */
    const toolCalls: ToolCall[] = [
      {
        name: 'AgentOutput',
        args: output,
        id: '1',
        type: 'tool_call',
      },
    ];

    const msg = new AIMessage({
      content: '',
      tool_calls: toolCalls,
    });
    this.addMessage(msg, new MessageMetadata({ tokens: 100 })); // Estimate tokens for tool calls

    // Empty tool response
    const toolMessage = new ToolMessage({
      content: '',
      tool_call_id: '1',
    });
    this.addMessage(toolMessage, new MessageMetadata({ tokens: 10 })); // Estimate tokens for empty response
  }

  getMessages(): BaseMessage[] {
    /**
     * Get all messages
     */
    // Since messages is initialized as an empty array in the class declaration,
    // we don't need the fallback to empty array, but we'll keep the null/undefined checks
    // on the individual messages for robustness
    return this.messages.filter(m => m && m.message).map(m => m.message);
  }

  getTotalTokens(): number {
    /**
     * Get total tokens in history
     */
    // Since currentTokens is initialized as 0 in the class declaration,
    // we don't need the fallback to 0
    return this.currentTokens;
  }

  removeOldestMessage(): void {
    /**
     * Remove oldest non-system message
     */
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      if (message && !(message.message instanceof SystemMessage)) {
        // Safely update token count if metadata exists
        if (message.metadata && typeof message.metadata.tokens === 'number') {
          this.currentTokens -= message.metadata.tokens;
        }
        this.messages.splice(i, 1);
        break;
      }
    }
  }

  /**
   * Remove message at specific index
   */
  removeMessageAtIndex(index: number): void {
    if (index >= 0 && index < this.messages.length) {
      const message = this.messages[index];
      // Update token count if message and metadata exist
      if (message && message.metadata && typeof message.metadata.tokens === 'number') {
        this.currentTokens -= message.metadata.tokens;
      }
      // Remove the message
      this.messages.splice(index, 1);
    }
  }

  removeLastStateMessage(): void {
    /**
     * Remove last state message from history
     */
    if (this.messages.length > 2) {
      const lastIndex = this.messages.length - 1;
      const lastMessage = this.messages[lastIndex];
      if (lastMessage && lastMessage.message instanceof HumanMessage) {
        if (lastMessage.metadata && lastMessage.metadata.tokens) {
          this.currentTokens -= lastMessage.metadata.tokens;
        }
        this.messages.pop();
      }
    }
  }
}

export class MessageManagerState {
  /**
   * Holds the state for MessageManager
   */
  history: MessageHistory = new MessageHistory();
  toolId: number = 1;
}
