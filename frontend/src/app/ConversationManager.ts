/**
 * Conversation Manager - Application-level conversation handling
 * Manages chat history, message formatting, and context trimming
 * Pure application concern - not MCP protocol
 */

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
  tool_call_id?: string;
  tool_calls?: any[];
  name?: string;
}

export interface ConversationContext {
  messages: Message[];
  messageCount: number;
  startTime: number;
  lastActivity: number;
}

/**
 * Manages conversation history and context for the application
 */
export class ConversationManager {
  private messages: Message[] = [];
  private startTime: number;
  private maxMessages: number;

  constructor(maxMessages: number = 20) {
    this.startTime = Date.now();
    this.maxMessages = maxMessages;
  }

  /**
   * Add a user message to the conversation
   */
  addUserMessage(content: string): void {
    this.messages.push({
      role: 'user',
      content,
      timestamp: Date.now()
    });
    
    this.trimIfNeeded();
  }

  /**
   * Add an assistant message to the conversation
   */
  addAssistantMessage(content: string, tool_calls?: any[]): void {
    this.messages.push({
      role: 'assistant',
      content,
      tool_calls,
      timestamp: Date.now()
    });
    
    this.trimIfNeeded();
  }

  /**
   * Add a system message to the conversation
   */
  addSystemMessage(content: string): void {
    this.messages.push({
      role: 'system',
      content,
      timestamp: Date.now()
    });
    
    this.trimIfNeeded();
  }

  /**
   * Add a tool result message to the conversation
   */
  addToolResult(toolCallId: string, toolName: string, result: string): void {
    this.messages.push({
      role: 'tool',
      tool_call_id: toolCallId,
      name: toolName,
      content: result,
      timestamp: Date.now()
    });
    
    this.trimIfNeeded();
  }

  /**
   * Get all messages in the conversation
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Get messages formatted for LLM (without timestamps)
   */
  getMessagesForLLM(): Omit<Message, 'timestamp'>[] {
    return this.messages.map(({ timestamp, ...message }) => message);
  }

  /**
   * Get conversation context summary
   */
  getContext(): ConversationContext {
    return {
      messages: this.getMessages(),
      messageCount: this.messages.length,
      startTime: this.startTime,
      lastActivity: this.getLastActivity()
    };
  }

  /**
   * Clear all messages except system messages
   */
  clear(): void {
    const systemMessages = this.messages.filter(m => m.role === 'system');
    this.messages = systemMessages;
    this.startTime = Date.now();
  }

  /**
   * Clear all messages including system messages
   */
  clearAll(): void {
    this.messages = [];
    this.startTime = Date.now();
  }

  /**
   * Get message count
   */
  getMessageCount(): number {
    return this.messages.length;
  }

  /**
   * Get conversation duration in seconds
   */
  getDuration(): number {
    return Math.round((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get last activity timestamp
   */
  getLastActivity(): number {
    if (this.messages.length === 0) {
      return this.startTime;
    }
    
    const lastMessage = this.messages[this.messages.length - 1];
    return lastMessage.timestamp || Date.now();
  }

  /**
   * Get messages by role
   */
  getMessagesByRole(role: Message['role']): Message[] {
    return this.messages.filter(m => m.role === role);
  }

  /**
   * Get recent messages (last N messages)
   */
  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count);
  }

  /**
   * Search messages by content
   */
  searchMessages(query: string): Message[] {
    const lowerQuery = query.toLowerCase();
    return this.messages.filter(m => 
      m.content?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get conversation statistics
   */
  getStats(): {
    totalMessages: number;
    userMessages: number;
    assistantMessages: number;
    toolMessages: number;
    systemMessages: number;
    duration: number;
    averageMessageLength: number;
  } {
    const userMessages = this.getMessagesByRole('user').length;
    const assistantMessages = this.getMessagesByRole('assistant').length;
    const toolMessages = this.getMessagesByRole('tool').length;
    const systemMessages = this.getMessagesByRole('system').length;
    
    const totalLength = this.messages.reduce((sum, m) => sum + (m.content?.length || 0), 0);
    const averageMessageLength = this.messages.length > 0 ? 
      Math.round(totalLength / this.messages.length) : 0;

    return {
      totalMessages: this.messages.length,
      userMessages,
      assistantMessages,
      toolMessages,
      systemMessages,
      duration: this.getDuration(),
      averageMessageLength
    };
  }

  /**
   * Export conversation to JSON
   */
  export(): {
    messages: Message[];
    metadata: {
      startTime: number;
      exportTime: number;
      duration: number;
      messageCount: number;
    };
  } {
    return {
      messages: this.getMessages(),
      metadata: {
        startTime: this.startTime,
        exportTime: Date.now(),
        duration: this.getDuration(),
        messageCount: this.messages.length
      }
    };
  }

  /**
   * Import conversation from JSON
   */
  import(data: {
    messages: Message[];
    metadata?: {
      startTime?: number;
    };
  }): void {
    this.messages = data.messages || [];
    this.startTime = data.metadata?.startTime || Date.now();
    
    this.trimIfNeeded();
  }

  /**
   * Set maximum message count
   */
  setMaxMessages(maxMessages: number): void {
    this.maxMessages = maxMessages;
    this.trimIfNeeded();
  }

  /**
   * Get maximum message count
   */
  getMaxMessages(): number {
    return this.maxMessages;
  }

  /**
   * Check if conversation needs trimming
   */
  needsTrimming(): boolean {
    return this.messages.length > this.maxMessages;
  }

  /**
   * Trim conversation to keep within limits
   * Preserves system messages and recent context
   */
  private trimIfNeeded(): void {
    if (!this.needsTrimming()) {
      return;
    }

    // Keep system messages
    const systemMessages = this.messages.filter(m => m.role === 'system');
    const nonSystemMessages = this.messages.filter(m => m.role !== 'system');
    
    // Keep recent non-system messages
    const keepCount = this.maxMessages - systemMessages.length;
    const recentMessages = nonSystemMessages.slice(-keepCount);
    
    this.messages = [...systemMessages, ...recentMessages];
    
    console.log(`📝 ConversationManager: Trimmed to ${this.messages.length} messages`);
  }

  /**
   * Add multiple messages at once
   */
  addMessages(messages: Message[]): void {
    this.messages.push(...messages);
    this.trimIfNeeded();
  }

  /**
   * Remove messages by index range
   */
  removeMessages(startIndex: number, endIndex?: number): void {
    if (endIndex === undefined) {
      endIndex = startIndex + 1;
    }
    
    this.messages.splice(startIndex, endIndex - startIndex);
  }

  /**
   * Update a message by index
   */
  updateMessage(index: number, updates: Partial<Message>): boolean {
    if (index < 0 || index >= this.messages.length) {
      return false;
    }
    
    this.messages[index] = { ...this.messages[index], ...updates };
    return true;
  }

  /**
   * Get message by index
   */
  getMessage(index: number): Message | undefined {
    return this.messages[index];
  }

  /**
   * Find message index by tool call ID
   */
  findMessageByToolCallId(toolCallId: string): number {
    return this.messages.findIndex(m => m.tool_call_id === toolCallId);
  }

  /**
   * Get conversation summary for debugging
   */
  getSummary(): string {
    const stats = this.getStats();
    return `Conversation: ${stats.totalMessages} messages (${stats.userMessages} user, ${stats.assistantMessages} assistant, ${stats.toolMessages} tool) over ${stats.duration}s`;
  }
}
