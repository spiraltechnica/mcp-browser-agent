import { useState } from 'react';

export interface DebugEvent {
  id: string;
  timestamp: number;
  type: 'user_message' | 'llm_request' | 'llm_response' | 'tool_call_parsed' | 'tool_execution' | 'tool_result' | 'final_response' | 'error';
  data: any;
  duration?: number;
  parentId?: string; // For linking related events
}

export interface ConversationFlow {
  id: string;
  userMessage: string;
  timestamp: number;
  events: DebugEvent[];
  isComplete: boolean;
  totalDuration: number;
}

interface EnhancedDebugPanelProps {
  conversationFlows: ConversationFlow[];
  isVisible: boolean;
  onToggle: () => void;
}

export function EnhancedDebugPanel({ conversationFlows, isVisible, onToggle }: EnhancedDebugPanelProps) {
  const [selectedFlow, setSelectedFlow] = useState<ConversationFlow | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<{[key: string]: boolean}>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedButtons, setCopiedButtons] = useState<{[key: string]: boolean}>({});

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => ({
      ...prev,
      [eventId]: !prev[eventId]
    }));
  };

  const copyToClipboard = async (text: string, buttonId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedButtons(prev => ({ ...prev, [buttonId]: true }));
      setTimeout(() => {
        setCopiedButtons(prev => ({ ...prev, [buttonId]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  const formatRawJson = (rawText: string): string => {
    try {
      const parsed = JSON.parse(rawText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If it's not valid JSON, return as-is
      return rawText;
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (duration: number): string => {
    if (duration < 1000) {
      return `${duration}ms`;
    }
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'user_message': return '👤';
      case 'llm_request': return '📤';
      case 'llm_response': return '📥';
      case 'tool_call_parsed': return '🔍';
      case 'tool_execution': return '⚙️';
      case 'tool_result': return '📋';
      case 'final_response': return '✅';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getEventColor = (type: string): string => {
    switch (type) {
      case 'user_message': return '#2563eb';
      case 'llm_request': return '#7c3aed';
      case 'llm_response': return '#7c3aed';
      case 'tool_call_parsed': return '#0891b2';
      case 'tool_execution': return '#ea580c';
      case 'tool_result': return '#16a34a';
      case 'final_response': return '#10b981';
      case 'error': return '#dc2626';
      default: return '#6b7280';
    }
  };

  const getEventTitle = (event: DebugEvent): string => {
    switch (event.type) {
      case 'user_message': return 'User Message';
      case 'llm_request': 
        // Find corresponding response to get prompt tokens
        const correspondingResponse = selectedFlow?.events.find(e => 
          e.type === 'llm_response' && e.parentId === event.id
        );
        const promptTokens = correspondingResponse?.data.usage?.prompt_tokens;
        const tokenInfo = promptTokens ? ` • ${promptTokens} prompt tokens` : '';
        return `LLM Request (${event.data.model || 'Unknown'})${tokenInfo}`;
      case 'llm_response': 
        const completionTokens = event.data.usage ? ` • ${event.data.usage.completion_tokens} completion tokens` : '';
        return `LLM Response${completionTokens}`;
      case 'tool_call_parsed': return `Tool Call Parsed: ${event.data.toolName || 'Unknown'}`;
      case 'tool_execution': return `Tool Execution: ${event.data.toolName || 'Unknown'}`;
      case 'tool_result': return `Tool Result: ${event.data.toolName || 'Unknown'}`;
      case 'final_response': return 'Final Response';
      case 'error': return 'Error';
      default: return 'Debug Event';
    }
  };

  const getFlowTokenSummary = (flow: ConversationFlow): { totalTokens: number; llmCalls: number } => {
    let totalTokens = 0;
    let llmCalls = 0;
    
    flow.events.forEach(event => {
      if (event.type === 'llm_response' && event.data.usage) {
        totalTokens += event.data.usage.total_tokens;
        llmCalls++;
      }
    });
    
    return { totalTokens, llmCalls };
  };

  const filteredEvents = selectedFlow ? selectedFlow.events.filter(event => 
    filterType === 'all' || event.type === filterType
  ) : [];

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      marginBottom: '20px'
    }}>
      {/* Header */}
      <div 
        style={{
          padding: '15px 20px',
          borderBottom: isVisible ? '1px solid #e2e8f0' : 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        onClick={onToggle}
      >
        <h2 style={{ 
          margin: 0, 
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          🔍 Enhanced Debug Panel
          <span style={{
            fontSize: '14px',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: '#e2e8f0',
            color: '#64748b',
            fontWeight: 'normal'
          }}>
            {conversationFlows.length} conversations
          </span>
        </h2>
        <div style={{ 
          fontSize: '18px',
          transform: isVisible ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s'
        }}>
          ▼
        </div>
      </div>

      {/* Content */}
      {isVisible && (
        <div style={{ padding: '20px' }}>
          {conversationFlows.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              fontStyle: 'italic',
              padding: '40px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔍</div>
              <div>No conversations yet</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Start a conversation to see the complete tool call flow
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
              {/* Conversation List */}
              <div>
                <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '16px' }}>
                  Recent Conversations
                </h3>
                <div style={{ maxHeight: '500px', overflow: 'auto' }}>
                  {conversationFlows.slice().reverse().map((flow) => {
                    const tokenSummary = getFlowTokenSummary(flow);
                    return (
                      <div
                        key={flow.id}
                        style={{
                          padding: '12px',
                          marginBottom: '8px',
                          backgroundColor: selectedFlow?.id === flow.id ? '#e0f2fe' : 'white',
                          border: `1px solid ${selectedFlow?.id === flow.id ? '#0ea5e9' : '#e2e8f0'}`,
                          borderRadius: '6px',
                          cursor: 'pointer',
                          borderLeft: `4px solid ${flow.isComplete ? '#10b981' : '#f59e0b'}`
                        }}
                        onClick={() => setSelectedFlow(flow)}
                      >
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          marginBottom: '4px'
                        }}>
                          {formatTimestamp(flow.timestamp)}
                        </div>
                        <div style={{ 
                          fontSize: '14px', 
                          fontWeight: '500',
                          color: '#1e293b',
                          marginBottom: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {flow.userMessage.substring(0, 50)}...
                        </div>
                        <div style={{ 
                          fontSize: '12px', 
                          color: '#6b7280',
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '4px'
                        }}>
                          <span>{flow.events.length} events</span>
                          <span>{formatDuration(flow.totalDuration)}</span>
                        </div>
                        {tokenSummary.totalTokens > 0 && (
                          <div style={{
                            fontSize: '11px',
                            color: '#0ea5e9',
                            fontWeight: '600',
                            display: 'flex',
                            justifyContent: 'space-between',
                            backgroundColor: '#f0f9ff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            marginTop: '4px'
                          }}>
                            <span>🔢 {tokenSummary.totalTokens} tokens</span>
                            <span>{tokenSummary.llmCalls} LLM calls</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Conversation Details */}
              <div>
                {selectedFlow ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '20px'
                    }}>
                      <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px' }}>
                        Conversation Flow
                      </h3>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <select
                          value={filterType}
                          onChange={(e) => setFilterType(e.target.value)}
                          style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px'
                          }}
                        >
                          <option value="all">All Events</option>
                          <option value="user_message">User Messages</option>
                          <option value="llm_request">LLM Requests</option>
                          <option value="llm_response">LLM Responses</option>
                          <option value="tool_call_parsed">Tool Calls</option>
                          <option value="tool_execution">Tool Executions</option>
                          <option value="tool_result">Tool Results</option>
                          <option value="error">Errors</option>
                        </select>
                        <div style={{ fontSize: '12px', color: '#6b7280' }}>
                          {formatTimestamp(selectedFlow.timestamp)} • {formatDuration(selectedFlow.totalDuration)}
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                      {filteredEvents.map((event, index) => (
                        <div
                          key={event.id}
                          style={{
                            marginBottom: '15px',
                            backgroundColor: 'white',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            borderLeft: `4px solid ${getEventColor(event.type)}`
                          }}
                        >
                          <div 
                            style={{
                              padding: '12px 15px',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            onClick={() => toggleEvent(event.id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '16px' }}>
                                {getEventIcon(event.type)}
                              </span>
                              <div>
                                <div style={{ 
                                  fontSize: '14px', 
                                  fontWeight: '500',
                                  color: '#1e293b'
                                }}>
                                  {getEventTitle(event)}
                                </div>
                                <div style={{ 
                                  fontSize: '12px', 
                                  color: '#6b7280'
                                }}>
                                  {formatTimestamp(event.timestamp)}
                                  {event.duration && ` • ${formatDuration(event.duration)}`}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              {/* Only show copy button for non-LLM events */}
                              {event.type !== 'llm_request' && event.type !== 'llm_response' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    copyToClipboard(formatJson(event.data), `copy-${event.id}`);
                                  }}
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '10px',
                                    backgroundColor: copiedButtons[`copy-${event.id}`] ? '#dcfce7' : '#f1f5f9',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: copiedButtons[`copy-${event.id}`] ? '#166534' : 'inherit'
                                  }}
                                >
                                  {copiedButtons[`copy-${event.id}`] ? 'Copied!' : 'Copy'}
                                </button>
                              )}
                              <span style={{ fontSize: '12px' }}>
                                {expandedEvents[event.id] ? '▼' : '▶'}
                              </span>
                            </div>
                          </div>
                          
                          {expandedEvents[event.id] && (
                            <div style={{ 
                              padding: '15px',
                              borderTop: '1px solid #e2e8f0',
                              backgroundColor: '#f8fafc'
                            }}>
                              {/* Event-specific content */}
                              {event.type === 'user_message' && (
                                <div style={{
                                  padding: '10px',
                                  backgroundColor: '#dbeafe',
                                  borderRadius: '4px',
                                  fontSize: '14px'
                                }}>
                                  {event.data.content}
                                </div>
                              )}
                              
                              {event.type === 'tool_call_parsed' && (
                                <div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <strong>Tool:</strong> {event.data.toolName}<br/>
                                    <strong>Arguments:</strong>
                                  </div>
                                  <pre style={{
                                    backgroundColor: '#1e293b',
                                    color: '#e2e8f0',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                  }}>
                                    {formatJson(event.data.arguments)}
                                  </pre>
                                </div>
                              )}
                              
                              {event.type === 'tool_execution' && (
                                <div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <strong>MCP Request:</strong>
                                  </div>
                                  <pre style={{
                                    backgroundColor: '#1e293b',
                                    color: '#e2e8f0',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                  }}>
                                    {formatJson(event.data.mcpRequest)}
                                  </pre>
                                </div>
                              )}
                              
                              {event.type === 'tool_result' && (
                                <div>
                                  <div style={{ marginBottom: '10px' }}>
                                    <strong>Success:</strong> {event.data.success ? 'Yes' : 'No'}<br/>
                                    <strong>Result:</strong>
                                  </div>
                                  <pre style={{
                                    backgroundColor: event.data.success ? '#dcfce7' : '#fef2f2',
                                    color: event.data.success ? '#166534' : '#991b1b',
                                    padding: '10px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    overflow: 'auto',
                                    maxHeight: '200px'
                                  }}>
                                    {typeof event.data.result === 'string' ? event.data.result : formatJson(event.data.result)}
                                  </pre>
                                </div>
                              )}
                              
                              {event.type === 'llm_request' && (
                                <div>
                                  <div style={{ marginBottom: '15px' }}>
                                    <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                                      Request Details:
                                    </h5>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr 1fr',
                                      gap: '10px',
                                      marginBottom: '10px',
                                      fontSize: '12px'
                                    }}>
                                      <div>
                                        <strong>Model:</strong> {event.data.model || 'Unknown'}
                                      </div>
                                      <div>
                                        <strong>Messages:</strong> {event.data.messages?.length || 0}
                                      </div>
                                      <div>
                                        <strong>Tools:</strong> {event.data.tools?.length || 0}
                                      </div>
                                    </div>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr 1fr',
                                      gap: '10px',
                                      fontSize: '12px'
                                    }}>
                                      <div>
                                        <strong>Temperature:</strong> {event.data.temperature || 'Default'}
                                      </div>
                                      <div>
                                        <strong>Max Tokens:</strong> {event.data.max_tokens || 'Default'}
                                      </div>
                                      <div>
                                        <strong>Timestamp:</strong> {formatTimestamp(event.timestamp)}
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ maxWidth: '600px' }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      marginBottom: '10px'
                                    }}>
                                      <h5 style={{ margin: 0, fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                                        Full Request JSON (Raw HTTP Body):
                                      </h5>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rawData = event.data.rawRequestBody || formatJson(event.data);
                                          copyToClipboard(formatRawJson(rawData), `request-json-${event.id}`);
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '10px',
                                          backgroundColor: copiedButtons[`request-json-${event.id}`] ? '#dcfce7' : '#f1f5f9',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          color: copiedButtons[`request-json-${event.id}`] ? '#166534' : 'inherit'
                                        }}
                                      >
                                        {copiedButtons[`request-json-${event.id}`] ? 'Copied!' : 'Copy JSON'}
                                      </button>
                                    </div>
                                    <pre style={{
                                      backgroundColor: '#1e293b',
                                      color: '#e2e8f0',
                                      padding: '15px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      lineHeight: '1.4',
                                      overflow: 'auto',
                                      maxHeight: '300px',
                                      margin: 0,
                                      fontFamily: 'Monaco, Consolas, monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {formatRawJson(event.data.rawRequestBody || formatJson(event.data))}
                                    </pre>
                                  </div>
                                </div>
                              )}
                              
                              {event.type === 'llm_response' && (
                                <div>
                                  {/* Token Usage - Prominent Display */}
                                  {event.data.usage && (
                                    <div style={{
                                      backgroundColor: '#f0f9ff',
                                      border: '2px solid #0ea5e9',
                                      borderRadius: '6px',
                                      padding: '15px',
                                      marginBottom: '15px'
                                    }}>
                                      <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0c4a6e', fontWeight: '600' }}>
                                        🔢 Token Usage
                                      </h5>
                                      <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 1fr 1fr 1fr', 
                                        gap: '15px',
                                        fontSize: '13px'
                                      }}>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ color: '#0c4a6e', fontWeight: '600', fontSize: '18px' }}>
                                            {event.data.usage.prompt_tokens}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '11px' }}>Prompt Tokens</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ color: '#0c4a6e', fontWeight: '600', fontSize: '18px' }}>
                                            {event.data.usage.completion_tokens}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '11px' }}>Completion Tokens</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ color: '#0c4a6e', fontWeight: '600', fontSize: '18px' }}>
                                            {event.data.usage.total_tokens}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '11px' }}>Total Tokens</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                          <div style={{ color: '#0c4a6e', fontWeight: '600', fontSize: '18px' }}>
                                            {event.duration ? formatDuration(event.duration) : 'N/A'}
                                          </div>
                                          <div style={{ color: '#64748b', fontSize: '11px' }}>Duration</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div style={{ marginBottom: '15px' }}>
                                    <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                                      Response Details:
                                    </h5>
                                    <div style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr 1fr 1fr',
                                      gap: '10px',
                                      marginBottom: '10px',
                                      fontSize: '12px'
                                    }}>
                                      <div>
                                        <strong>Model:</strong> {event.data.model || 'Unknown'}
                                      </div>
                                      <div>
                                        <strong>Finish Reason:</strong> {event.data.finishReason || 'Unknown'}
                                      </div>
                                      <div>
                                        <strong>Tool Calls:</strong> {event.data.tool_calls?.length || 0}
                                      </div>
                                    </div>
                                    {event.data.content && (
                                      <div style={{ marginBottom: '10px' }}>
                                        <strong>Content Preview:</strong>
                                        <div style={{
                                          backgroundColor: '#f8fafc',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: '4px',
                                          padding: '10px',
                                          fontSize: '12px',
                                          maxHeight: '100px',
                                          overflow: 'auto'
                                        }}>
                                          {event.data.content.substring(0, 500)}
                                          {event.data.content.length > 500 ? '...' : ''}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div style={{ maxWidth: '600px' }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between', 
                                      alignItems: 'center',
                                      marginBottom: '10px'
                                    }}>
                                      <h5 style={{ margin: 0, fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                                        Full Response JSON (Raw HTTP Body):
                                      </h5>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const rawData = event.data.rawResponseBody || formatJson(event.data);
                                          copyToClipboard(formatRawJson(rawData), `response-json-${event.id}`);
                                        }}
                                        style={{
                                          padding: '4px 8px',
                                          fontSize: '10px',
                                          backgroundColor: copiedButtons[`response-json-${event.id}`] ? '#dcfce7' : '#f1f5f9',
                                          border: '1px solid #e2e8f0',
                                          borderRadius: '4px',
                                          cursor: 'pointer',
                                          color: copiedButtons[`response-json-${event.id}`] ? '#166534' : 'inherit'
                                        }}
                                      >
                                        {copiedButtons[`response-json-${event.id}`] ? 'Copied!' : 'Copy JSON'}
                                      </button>
                                    </div>
                                    <pre style={{
                                      backgroundColor: '#1e293b',
                                      color: '#e2e8f0',
                                      padding: '15px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      lineHeight: '1.4',
                                      overflow: 'auto',
                                      maxHeight: '300px',
                                      margin: 0,
                                      fontFamily: 'Monaco, Consolas, monospace',
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}>
                                      {formatRawJson(event.data.rawResponseBody || formatJson(event.data))}
                                    </pre>
                                  </div>
                                </div>
                              )}
                              
                              {event.type === 'final_response' && (
                                <div style={{
                                  padding: '10px',
                                  backgroundColor: '#dcfce7',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  color: '#166534'
                                }}>
                                  {event.data.content}
                                </div>
                              )}
                              
                              {event.type === 'error' && (
                                <div style={{
                                  padding: '10px',
                                  backgroundColor: '#fef2f2',
                                  borderRadius: '4px',
                                  fontSize: '14px',
                                  color: '#991b1b'
                                }}>
                                  <strong>Error:</strong> {event.data.message}<br/>
                                  {event.data.stack && (
                                    <pre style={{ 
                                      marginTop: '10px', 
                                      fontSize: '11px',
                                      whiteSpace: 'pre-wrap'
                                    }}>
                                      {event.data.stack}
                                    </pre>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    textAlign: 'center',
                    color: '#6b7280',
                    fontStyle: 'italic',
                    padding: '60px 20px'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>👈</div>
                    <div>Select a conversation to view the complete flow</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
