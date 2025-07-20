import { useState, useEffect, useCallback, useRef } from "react";
import { 
  startEnhancedAgent, 
  stopEnhancedAgent, 
  isEnhancedAgentRunning, 
  getEnhancedAgentStats,
  createEnhancedAgent 
} from "./agent/EnhancedAgent";
import { getEnhancedMCPServer } from "./server/EnhancedMCPServer";
import { getLLMClient, LLMDebugInfo } from "./llm/LLMClient";
import { EnhancedDebugPanel, ConversationFlow } from "./components/EnhancedDebugPanel";
import { getDebugEventManager } from "./debug/DebugEventManager";
import { TokenUsageDisplay } from "./components/TokenUsageDisplay";
import MultiAgentInterface from "./components/MultiAgentInterface";

interface AgentStats {
  isRunning: boolean;
  executionCount: number;
  errorCount: number;
  runtime: number;
  contextSize: number;
}

interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: any;
}

function App() {
  const [useMultiAgent, setUseMultiAgent] = useState(false);
  const [log, setLog] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [tools, setTools] = useState<MCPToolInfo[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<{role: 'user' | 'assistant', content: string, timestamp: string}>>([]);
  const [isProcessingChat, setIsProcessingChat] = useState(false);
  const [debugHistory, setDebugHistory] = useState<LLMDebugInfo[]>([]);
  const [conversationFlows, setConversationFlows] = useState<ConversationFlow[]>([]);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  
  // Refs for auto-scrolling and input focus
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const logScrollRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((msg: string) => {
    setLog(prev => `${prev}${prev ? '\n' : ''}${msg}`);
  }, []);

  const handleStart = async () => {
    if (isRunning) return;
    
    setLog(""); // Clear previous logs
    
    try {
      // Use the enhanced agent instead of the old one
      await startEnhancedAgent(addLog);
      setIsRunning(true);
      addLog("✅ Enhanced MCP Agent started successfully!");
    } catch (error) {
      addLog(`❌ Failed to start Enhanced Agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStop = async () => {
    if (!isRunning) return;
    
    try {
      await stopEnhancedAgent();
      setIsRunning(false);
      addLog("🛑 Enhanced Agent stopped by user");
    } catch (error) {
      addLog(`⚠️ Error stopping Enhanced Agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsRunning(false);
    }
  };

  const handleClearLog = () => {
    setLog("");
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isProcessingChat) return;

    const userMessage = chatInput.trim();
    setChatInput("");
    setIsProcessingChat(true);

    // Add user message to chat history
    const timestamp = new Date().toLocaleTimeString();
    setChatHistory(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp
    }]);

    try {
      // Try to use the enhanced agent if it's running
      const enhancedAgent = createEnhancedAgent(addLog);
      
      if (isEnhancedAgentRunning()) {
        // Use the enhanced agent's chat session
        const response = await enhancedAgent.processMessage(userMessage);
        
        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: response,
          timestamp: new Date().toLocaleTimeString()
        }]);
      } else {
        // Fallback to direct LLM call
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            prompt: `You are an AI assistant helping with an MCP browser agent. The user has sent you this message: "${userMessage}". Please provide a helpful response. If they're asking about tools or the agent, you can reference the available MCP tools: calculator, dom_query, browser_storage, and list_tools.`
          })
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const responseText = await response.text();
        
        // Try to parse JSON response or use raw text
        let assistantMessage = responseText;
        try {
          const parsed = JSON.parse(responseText);
          if (parsed.content) {
            assistantMessage = parsed.content;
          } else if (parsed.message) {
            assistantMessage = parsed.message;
          }
        } catch (e) {
          // Use raw text if JSON parsing fails
        }

        setChatHistory(prev => [...prev, {
          role: 'assistant',
          content: assistantMessage,
          timestamp: new Date().toLocaleTimeString()
        }]);
      }

    } catch (error) {
      console.error('Chat error:', error);
      setChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsProcessingChat(false);
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
  };

  const handleToggleDebugPanel = () => {
    setIsDebugPanelVisible(!isDebugPanelVisible);
  };

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatHistory, isProcessingChat]);

  // Auto-scroll activity log to bottom when new logs are added
  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
    }
  }, [log]);

  // Focus chat input after processing is complete
  useEffect(() => {
    if (!isProcessingChat && chatInputRef.current) {
      chatInputRef.current.focus();
    }
  }, [isProcessingChat]);

  // Setup Enhanced Debug Event Manager
  useEffect(() => {
    const debugManager = getDebugEventManager();
    
    // Subscribe to conversation flow updates
    const unsubscribeFlow = debugManager.onFlow((flow: ConversationFlow) => {
      setConversationFlows(prev => {
        // Keep only last 20 flows
        const newFlows = [...prev, flow];
        if (newFlows.length > 20) {
          newFlows.shift();
        }
        return newFlows;
      });
    });

    // Load existing conversation flows
    setConversationFlows(debugManager.getConversationFlows());

    // Also keep the old LLM debug callback for backward compatibility
    const llmClient = getLLMClient();
    
    const handleDebugUpdate = (debugInfo: LLMDebugInfo) => {
      setDebugHistory(prev => {
        // Keep only last 50 entries
        const newHistory = [...prev, debugInfo];
        if (newHistory.length > 50) {
          newHistory.shift();
        }
        return newHistory;
      });
    };

    llmClient.setDebugCallback(handleDebugUpdate);
    setDebugHistory(llmClient.getDebugHistory());

    return () => {
      // Clean up callbacks on unmount
      unsubscribeFlow();
      llmClient.setDebugCallback(() => {});
    };
  }, []);

  // Update stats and running status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      // Check enhanced agent system only
      const running = isEnhancedAgentRunning();
      
      setIsRunning(running);
      
      if (running) {
        // Get enhanced agent stats
        const enhancedStats = getEnhancedAgentStats();
        setStats(enhancedStats);
      } else {
        setStats(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load available tools
  useEffect(() => {
    const loadTools = async () => {
      try {
        // Use enhanced server only
        const enhancedServer = getEnhancedMCPServer();
        await enhancedServer.initialize();
        const availableTools = await enhancedServer.listTools();
        setTools(availableTools);
        addLog("✅ Enhanced tools loaded successfully");
      } catch (error) {
        console.error('Failed to load tools:', error);
        addLog(`❌ Failed to load tools: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    loadTools();
  }, [addLog]);

  // If multi-agent mode is enabled, render the MultiAgentInterface
  if (useMultiAgent) {
    return <MultiAgentInterface onSwitchToSingleAgent={() => setUseMultiAgent(false)} />;
  }

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px'
    }}>
      <header style={{ marginBottom: '30px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: '10px'
        }}>
          <h1 style={{ 
            color: '#2563eb',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            🤖 MCP Browser Agent
            <span style={{
              fontSize: '14px',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: isRunning ? '#10b981' : '#6b7280',
              color: 'white',
              fontWeight: 'normal'
            }}>
              {isRunning ? 'RUNNING' : 'STOPPED'}
            </span>
          </h1>
          
          {/* Mode Toggle Button */}
          <button
            onClick={() => setUseMultiAgent(!useMultiAgent)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            🔄 Switch to Multi-Agent Mode
          </button>
        </div>
        <p style={{ color: '#6b7280', margin: 0 }}>
          An intelligent agent that uses MCP tools to interact with the browser
        </p>
      </header>

      {/* Chat Panel - Now at the top */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '20px',
        marginBottom: '20px'
      }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '15px'
        }}>
          <h2 style={{ margin: 0, color: '#1e293b' }}>💬 Chat with AI Agent</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              style={{
                padding: '6px 12px',
                backgroundColor: isRunning ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              {isRunning ? '🔄 Running' : '▶️ Start Agent'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={!isRunning}
              style={{
                padding: '6px 12px',
                backgroundColor: !isRunning ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: !isRunning ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500'
              }}
            >
              ⏹️ Stop
            </button>
            
            <button
              onClick={handleClearChat}
              style={{
                padding: '6px 12px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Clear Chat
            </button>
          </div>
        </div>

        {/* Chat History with auto-scroll */}
        <div 
          ref={chatScrollRef}
          style={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            height: '300px',
            overflow: 'auto',
            padding: '15px',
            marginBottom: '15px'
          }}
        >
          {chatHistory.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#6b7280', 
              fontStyle: 'italic',
              marginTop: '100px'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>💬</div>
              <div>Start a conversation with the AI assistant</div>
              <div style={{ fontSize: '12px', marginTop: '5px' }}>
                Ask questions about the MCP agent, tools, or get help with anything!
              </div>
            </div>
          ) : (
            <div>
              {chatHistory.map((message, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '15px',
                    display: 'flex',
                    flexDirection: message.role === 'user' ? 'row-reverse' : 'row',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: message.role === 'user' ? '#2563eb' : '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0
                  }}>
                    {message.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div style={{
                    maxWidth: '70%',
                    backgroundColor: message.role === 'user' ? '#2563eb' : '#f1f5f9',
                    color: message.role === 'user' ? 'white' : '#1e293b',
                    padding: '10px 15px',
                    borderRadius: '18px',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {message.content}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#6b7280',
                    alignSelf: 'flex-end',
                    marginBottom: '5px'
                  }}>
                    {message.timestamp}
                  </div>
                </div>
              ))}
              {isProcessingChat && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '15px'
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px'
                  }}>
                    🤖
                  </div>
                  <div style={{
                    backgroundColor: '#f1f5f9',
                    color: '#6b7280',
                    padding: '10px 15px',
                    borderRadius: '18px',
                    fontSize: '14px',
                    fontStyle: 'italic'
                  }}>
                    Thinking...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input */}
        <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '10px' }}>
          <input
            ref={chatInputRef}
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Ask me anything about the MCP agent or tools..."
            disabled={isProcessingChat}
            style={{
              flex: 1,
              padding: '12px 15px',
              border: '1px solid #e2e8f0',
              borderRadius: '25px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: isProcessingChat ? '#f9fafb' : 'white'
            }}
          />
          <button
            type="submit"
            disabled={!chatInput.trim() || isProcessingChat}
            style={{
              padding: '12px 20px',
              backgroundColor: (!chatInput.trim() || isProcessingChat) ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '25px',
              cursor: (!chatInput.trim() || isProcessingChat) ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '14px'
            }}
          >
            {isProcessingChat ? '⏳' : '📤'}
          </button>
        </form>
      </div>

      {/* Enhanced Debug Panel */}
      <EnhancedDebugPanel 
        conversationFlows={conversationFlows}
        isVisible={isDebugPanelVisible}
        onToggle={handleToggleDebugPanel}
      />

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 300px', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {/* Control Panel */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h2 style={{ marginTop: 0, color: '#1e293b' }}>Agent Details</h2>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <button
              onClick={handleStart}
              disabled={isRunning}
              style={{
                padding: '10px 20px',
                backgroundColor: isRunning ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: isRunning ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              {isRunning ? '🔄 Running...' : '▶️ Start Agent'}
            </button>
            
            <button
              onClick={handleStop}
              disabled={!isRunning}
              style={{
                padding: '10px 20px',
                backgroundColor: !isRunning ? '#9ca3af' : '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: !isRunning ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              ⏹️ Stop Agent
            </button>
            
            <button
              onClick={handleClearLog}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🗑️ Clear Log
            </button>
          </div>

          {/* Running Token Total */}
          <TokenUsageDisplay style={{ marginBottom: '20px' }} />

          {/* Stats */}
          {stats && (
            <div style={{
              backgroundColor: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '15px',
              marginBottom: '20px'
            }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', fontSize: '16px' }}>Agent Statistics</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                <div><strong>Executions:</strong> {stats.executionCount}</div>
                <div><strong>Runtime:</strong> {stats.runtime}s</div>
                <div><strong>Errors:</strong> {stats.errorCount}</div>
                <div><strong>Context Size:</strong> {stats.contextSize}</div>
              </div>
            </div>
          )}

          {/* Activity Log with auto-scroll */}
          <div>
            <h3 style={{ color: '#1e293b', fontSize: '16px' }}>Activity Log</h3>
            <div 
              ref={logScrollRef}
              style={{
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '15px',
                borderRadius: '6px',
                height: '400px',
                overflow: 'auto',
                fontFamily: 'Monaco, Consolas, monospace',
                fontSize: '12px',
                lineHeight: '1.6'
              }}
            >
              {log ? (
                <div>
                  {log.split('\n').map((line, index) => {
                    if (!line.trim()) return <div key={index} style={{ height: '8px' }} />;
                    
                    // Parse timestamp and message
                    const timestampMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
                    if (!timestampMatch) {
                      return <div key={index} style={{ color: '#9ca3af' }}>{line}</div>;
                    }
                    
                    const [, timestamp, message] = timestampMatch;
                    
                    // Style based on message type
                    let messageStyle = { color: '#e2e8f0' };
                    let icon = '';
                    
                    if (message.includes('🤖') || message.includes('starting')) {
                      messageStyle.color = '#60a5fa'; // Blue
                      icon = '🚀';
                    } else if (message.includes('✅') || message.includes('result:')) {
                      messageStyle.color = '#34d399'; // Green
                      icon = '✅';
                    } else if (message.includes('🔧') || message.includes('Executing')) {
                      messageStyle.color = '#fbbf24'; // Yellow
                      icon = '⚙️';
                    } else if (message.includes('🧠') || message.includes('Decision:')) {
                      messageStyle.color = '#a78bfa'; // Purple
                      icon = '🧠';
                    } else if (message.includes('❌') || message.includes('error')) {
                      messageStyle.color = '#f87171'; // Red
                      icon = '❌';
                    } else if (message.includes('🛑') || message.includes('stop')) {
                      messageStyle.color = '#fb7185'; // Pink
                      icon = '🛑';
                    } else if (message.includes('⏸️') || message.includes('waiting')) {
                      messageStyle.color = '#94a3b8'; // Gray
                      icon = '⏸️';
                    }
                    
                    // Format JSON results nicely
                    let formattedMessage = message;
                    if (message.includes('result:') && message.includes('{')) {
                      try {
                        const jsonStart = message.indexOf('{');
                        const prefix = message.substring(0, jsonStart);
                        const jsonPart = message.substring(jsonStart);
                        const parsed = JSON.parse(jsonPart);
                        formattedMessage = prefix + JSON.stringify(parsed, null, 2);
                      } catch (e) {
                        // Keep original if parsing fails
                      }
                    }
                    
                    return (
                      <div key={index} style={{ 
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}>
                        <span style={{ 
                          color: '#6b7280', 
                          fontSize: '10px',
                          minWidth: '60px',
                          marginTop: '1px'
                        }}>
                          {timestamp.split(' ')[1]} {/* Just show time, not date */}
                        </span>
                        <span style={{ minWidth: '16px', marginTop: '1px' }}>
                          {icon}
                        </span>
                        <div style={{ 
                          ...messageStyle, 
                          flex: 1,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {formattedMessage.replace(/^[🤖🔧✅❌🛑⏸️🧠]\s*/, '')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  fontStyle: 'italic',
                  marginTop: '50px'
                }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>🤖</div>
                  <div>No activity yet.</div>
                  <div style={{ fontSize: '11px', marginTop: '5px' }}>
                    Click "Start Agent" to begin the MCP browser agent.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tools Panel */}
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '20px'
        }}>
          <h2 style={{ marginTop: 0, color: '#1e293b' }}>
            Available Tools ({tools.length})
          </h2>
          
          <div style={{ maxHeight: '600px', overflow: 'auto' }}>
            {tools.map((tool) => (
              <div
                key={tool.name}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '10px'
                }}
              >
                <h4 style={{ 
                  margin: '0 0 8px 0', 
                  color: '#2563eb',
                  fontSize: '14px',
                  fontFamily: 'Monaco, Consolas, monospace'
                }}>
                  {tool.name}
                </h4>
                <p style={{ 
                  margin: '0 0 8px 0', 
                  fontSize: '13px', 
                  color: '#4b5563',
                  lineHeight: '1.4'
                }}>
                  {tool.description}
                </p>
                
                {/* Show required parameters */}
                {tool.inputSchema?.required && tool.inputSchema.required.length > 0 && (
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>
                    <strong>Required:</strong> {tool.inputSchema.required.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {tools.length === 0 && (
            <div style={{ 
              textAlign: 'center', 
              color: '#6b7280', 
              fontStyle: 'italic',
              padding: '20px'
            }}>
              Loading tools...
            </div>
          )}
        </div>
      </div>

      <footer style={{ 
        textAlign: 'center', 
        color: '#6b7280', 
        fontSize: '14px',
        borderTop: '1px solid #e2e8f0',
        paddingTop: '20px'
      }}>
        <p>
          🧠 Powered by MCP (Model Context Protocol) • 
          🔧 Tools run entirely in your browser • 
          🤖 AI reasoning via OpenAI API
        </p>
      </footer>
    </div>
  );
}

export default App;
