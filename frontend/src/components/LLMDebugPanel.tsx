import { useState } from 'react';
import { LLMDebugInfo } from '../llm/LLMClient';

interface LLMDebugPanelProps {
  debugHistory: LLMDebugInfo[];
  isVisible: boolean;
  onToggle: () => void;
}

export function LLMDebugPanel({ debugHistory, isVisible, onToggle }: LLMDebugPanelProps) {
  const [selectedRequest, setSelectedRequest] = useState<LLMDebugInfo | null>(null);
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
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

  const getStatusColor = (debugInfo: LLMDebugInfo): string => {
    if (debugInfo.responsePayload?.error) {
      return '#ef4444'; // Red for errors
    }
    if (debugInfo.duration > 5000) {
      return '#f59e0b'; // Yellow for slow requests
    }
    return '#10b981'; // Green for successful requests
  };

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
          🔍 LLM Debug Panel
          <span style={{
            fontSize: '14px',
            padding: '2px 8px',
            borderRadius: '12px',
            backgroundColor: '#e2e8f0',
            color: '#64748b',
            fontWeight: 'normal'
          }}>
            {debugHistory.length} requests
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
          {debugHistory.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#6b7280',
              fontStyle: 'italic',
              padding: '40px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>🔍</div>
              <div>No LLM requests yet</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Start a conversation to see request/response details
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
              {/* Request List */}
              <div>
                <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '16px' }}>
                  Recent Requests
                </h3>
                <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                  {debugHistory.slice().reverse().map((debugInfo) => (
                    <div
                      key={debugInfo.id}
                      style={{
                        padding: '12px',
                        marginBottom: '8px',
                        backgroundColor: selectedRequest?.id === debugInfo.id ? '#e0f2fe' : 'white',
                        border: `1px solid ${selectedRequest?.id === debugInfo.id ? '#0ea5e9' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        borderLeft: `4px solid ${getStatusColor(debugInfo)}`
                      }}
                      onClick={() => setSelectedRequest(debugInfo)}
                    >
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        {formatTimestamp(debugInfo.timestamp)}
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        fontWeight: '500',
                        color: '#1e293b',
                        marginBottom: '4px'
                      }}>
                        {debugInfo.model} ({debugInfo.id})
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#6b7280',
                        marginBottom: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {debugInfo.requestPayload?.messages?.length > 0 
                          ? `${debugInfo.requestPayload.messages.length} msgs: ${debugInfo.requestPayload.messages[debugInfo.requestPayload.messages.length - 1]?.content?.substring(0, 50)}...`
                          : 'No messages'
                        }
                      </div>
                      <div style={{ 
                        fontSize: '12px', 
                        color: '#6b7280',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}>
                        <span>{formatDuration(debugInfo.duration)}</span>
                        {debugInfo.tokenUsage && (
                          <span>{debugInfo.tokenUsage.total_tokens} tokens</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Request Details */}
              <div>
                {selectedRequest ? (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '20px'
                    }}>
                      <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px' }}>
                        Request Details
                      </h3>
                      <div style={{ fontSize: '12px', color: '#6b7280' }}>
                        {formatTimestamp(selectedRequest.timestamp)} • {formatDuration(selectedRequest.duration)}
                      </div>
                    </div>

                    {/* Token Usage */}
                    {selectedRequest.tokenUsage && (
                      <div style={{
                        backgroundColor: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        padding: '15px',
                        marginBottom: '15px'
                      }}>
                        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>
                          Token Usage
                        </h4>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: '1fr 1fr 1fr', 
                          gap: '15px',
                          fontSize: '12px'
                        }}>
                          <div>
                            <div style={{ color: '#6b7280' }}>Prompt</div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>
                              {selectedRequest.tokenUsage.prompt_tokens}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#6b7280' }}>Completion</div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>
                              {selectedRequest.tokenUsage.completion_tokens}
                            </div>
                          </div>
                          <div>
                            <div style={{ color: '#6b7280' }}>Total</div>
                            <div style={{ fontWeight: '500', color: '#1e293b' }}>
                              {selectedRequest.tokenUsage.total_tokens}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Request Payload */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      marginBottom: '15px'
                    }}>
                      <div 
                        style={{
                          padding: '12px 15px',
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => toggleSection('request')}
                      >
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
                          📤 Request Payload ({selectedRequest.requestPayload?.messages?.length || 0} messages)
                        </h4>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(formatJson(selectedRequest.requestPayload));
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: '10px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Copy Full JSON
                          </button>
                          <span style={{ fontSize: '12px' }}>
                            {expandedSections.request ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      {expandedSections.request && (
                        <div style={{ padding: '15px' }}>
                          {/* Conversation History View */}
                          <div style={{ marginBottom: '15px' }}>
                            <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                              Conversation History (as sent to LLM):
                            </h5>
                            <div style={{
                              backgroundColor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              padding: '10px',
                              maxHeight: '200px',
                              overflow: 'auto'
                            }}>
                              {selectedRequest.requestPayload?.messages?.map((message: any, index: number) => (
                                <div key={index} style={{
                                  marginBottom: '8px',
                                  padding: '8px',
                                  backgroundColor: message.role === 'system' ? '#fef3c7' : 
                                                 message.role === 'user' ? '#dbeafe' : '#dcfce7',
                                  borderRadius: '4px',
                                  fontSize: '11px',
                                  lineHeight: '1.4'
                                }}>
                                  <div style={{ fontWeight: '600', marginBottom: '4px', textTransform: 'capitalize' }}>
                                    {message.role}:
                                  </div>
                                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {message.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Full JSON View */}
                          <div>
                            <h5 style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                              Full Request JSON:
                            </h5>
                            <pre style={{
                              backgroundColor: '#1e293b',
                              color: '#e2e8f0',
                              padding: '15px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              lineHeight: '1.4',
                              overflow: 'auto',
                              maxHeight: '300px',
                              maxWidth: '100%',
                              margin: 0,
                              fontFamily: 'Monaco, Consolas, monospace',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                              overflowWrap: 'break-word'
                            }}>
                              {formatJson(selectedRequest.requestPayload)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Response Payload */}
                    <div style={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px'
                    }}>
                      <div 
                        style={{
                          padding: '12px 15px',
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                        onClick={() => toggleSection('response')}
                      >
                        <h4 style={{ margin: 0, fontSize: '14px', color: '#1e293b' }}>
                          📥 Response Payload
                        </h4>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(formatJson(selectedRequest.responsePayload));
                            }}
                            style={{
                              padding: '4px 8px',
                              fontSize: '10px',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              borderRadius: '4px',
                              cursor: 'pointer'
                            }}
                          >
                            Copy
                          </button>
                          <span style={{ fontSize: '12px' }}>
                            {expandedSections.response ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                      {expandedSections.response && (
                        <div style={{ padding: '15px' }}>
                          <pre style={{
                            backgroundColor: '#1e293b',
                            color: '#e2e8f0',
                            padding: '15px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            lineHeight: '1.4',
                            overflow: 'auto',
                            maxHeight: '300px',
                            maxWidth: '100%',
                            margin: 0,
                            fontFamily: 'Monaco, Consolas, monospace',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                          }}>
                            {formatJson(selectedRequest.responsePayload)}
                          </pre>
                        </div>
                      )}
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
                    <div>Select a request to view details</div>
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
