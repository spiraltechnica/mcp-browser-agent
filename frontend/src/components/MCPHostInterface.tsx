import { useEffect, useState, useCallback, useRef } from "react";
import { MultiAgentManager, AgentInfo } from "../app/MultiAgentManager";
import { TokenUsageDisplay } from "./TokenUsageDisplay";
import { EnhancedDebugPanel, ConversationFlow } from "./MCPDebugPanel";
import { getDebugEventManager } from "../debug/DebugEventManager";
import { getLLMClient, LLMDebugInfo } from "../llm/LLMClient";

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface AgentChatState {
  agentId: string;
  chatHistory: Message[];
  chatInput: string;
  isProcessing: boolean;
}

interface MultiAgentInterfaceProps {
  onSwitchToSingleAgent?: () => void;
}

function MultiAgentInterface({ onSwitchToSingleAgent }: MultiAgentInterfaceProps = {}) {
  const [agentManager, setAgentManager] = useState<MultiAgentManager | null>(null);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [agentChats, setAgentChats] = useState<Map<string, AgentChatState>>(new Map());
  const [logs, setLogs] = useState<Map<string, string>>(new Map());
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [newAgentName, setNewAgentName] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [debugHistory, setDebugHistory] = useState<LLMDebugInfo[]>([]);
  const [conversationFlows, setConversationFlows] = useState<ConversationFlow[]>([]);
  const [isDebugPanelVisible, setIsDebugPanelVisible] = useState(false);
  
  // Refs for auto-scrolling and input focus
  const chatScrollRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const logScrollRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const chatInputRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  // Initialize agent manager
  useEffect(() => {
    const manager = new MultiAgentManager((message: string) => {
      // For multi-agent, we need to parse the agent-specific logs
      // The message format is "[AgentName] actual message"
      const agentMatch = message.match(/^\[([^\]]+)\]\s*(.*)$/);
      if (agentMatch) {
        const [, agentName, actualMessage] = agentMatch;
        // Find agent by name to get ID
        const agent = manager.getAllAgents().find(a => a.name === agentName);
        if (agent) {
          setLogs(prev => {
            const newLogs = new Map(prev);
            const currentLog = newLogs.get(agent.id) || "";
            newLogs.set(agent.id, `${currentLog}${currentLog ? '\n' : ''}${actualMessage}`);
            return newLogs;
          });
        }
      }
    });
    
    setAgentManager(manager);
    
    // Check if agents already exist before creating initial agent
    const existingAgents = manager.getAllAgents();
    if (existingAgents.length === 0) {
      // Only create initial agent if no agents exist
      createInitialAgent(manager);
    } else {
      // Use existing agents
      setAgents(existingAgents);
      
      // Set the first agent as active if none is selected
      if (!activeAgentId && existingAgents.length > 0) {
        setActiveAgentId(existingAgents[0].id);
      }
      
      // Initialize chat states for existing agents
      existingAgents.forEach(agent => {
        setAgentChats(prev => {
          const newChats = new Map(prev);
          if (!newChats.has(agent.id)) {
            newChats.set(agent.id, {
              agentId: agent.id,
              chatHistory: [],
              chatInput: "",
              isProcessing: false
            });
          }
          return newChats;
        });
      });
    }
  }, []);

  const createInitialAgent = async (manager: MultiAgentManager) => {
    try {
      const agentId = await manager.createAgent("Main Agent");
      // Don't auto-start the agent - let user start it manually for consistency
      setActiveAgentId(agentId);
      
      // Initialize chat state for the new agent
      setAgentChats(prev => {
        const newChats = new Map(prev);
        newChats.set(agentId, {
          agentId,
          chatHistory: [],
          chatInput: "",
          isProcessing: false
        });
        return newChats;
      });
      
      // Refresh agents list
      setAgents(manager.getAllAgents());
    } catch (error) {
      console.error('Failed to create initial agent:', error);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentManager || isCreatingAgent) return;
    
    setIsCreatingAgent(true);
    try {
      const agentName = newAgentName.trim() || undefined;
      const agentId = await agentManager.createAgent(agentName);
      
      // Initialize chat state for the new agent
      setAgentChats(prev => {
        const newChats = new Map(prev);
        newChats.set(agentId, {
          agentId,
          chatHistory: [],
          chatInput: "",
          isProcessing: false
        });
        return newChats;
      });
      
      // Switch to the new agent
      setActiveAgentId(agentId);
      
      // Refresh agents list
      setAgents(agentManager.getAllAgents());
      
      // Reset form
      setNewAgentName("");
      setShowCreateForm(false);
    } catch (error) {
      console.error('Failed to create agent:', error);
      alert(`Failed to create agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    if (!agentManager) return;
    
    const agent = agentManager.getAgentInfo(agentId);
    if (!agent) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to remove "${agent.name}"?`);
    if (!confirmDelete) return;
    
    try {
      await agentManager.removeAgent(agentId);
      
      // Remove chat state
      setAgentChats(prev => {
        const newChats = new Map(prev);
        newChats.delete(agentId);
        return newChats;
      });
      
      // Remove logs
      setLogs(prev => {
        const newLogs = new Map(prev);
        newLogs.delete(agentId);
        return newLogs;
      });
      
      // Switch to another agent if this was active
      if (activeAgentId === agentId) {
        const remainingAgents = agentManager.getAllAgents();
        setActiveAgentId(remainingAgents.length > 0 ? remainingAgents[0].id : null);
      }
      
      // Refresh agents list
      setAgents(agentManager.getAllAgents());
    } catch (error) {
      console.error('Failed to remove agent:', error);
      alert(`Failed to remove agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStartAgent = async (agentId: string) => {
    if (!agentManager) return;
    
    try {
      await agentManager.startAgent(agentId);
      setAgents(agentManager.getAllAgents());
    } catch (error) {
      console.error('Failed to start agent:', error);
      alert(`Failed to start agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStopAgent = async (agentId: string) => {
    if (!agentManager) return;
    
    try {
      await agentManager.stopAgent(agentId);
      setAgents(agentManager.getAllAgents());
    } catch (error) {
      console.error('Failed to stop agent:', error);
      alert(`Failed to stop agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleChatSubmit = async (agentId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!agentManager) return;
    
    const chatState = agentChats.get(agentId);
    if (!chatState || !chatState.chatInput.trim() || chatState.isProcessing) return;

    const userMessage = chatState.chatInput.trim();
    
    // Update chat state - clear input and set processing
    setAgentChats(prev => {
      const newChats = new Map(prev);
      const currentChat = newChats.get(agentId);
      if (currentChat) {
        newChats.set(agentId, {
          ...currentChat,
          chatInput: "",
          isProcessing: true,
          chatHistory: [...currentChat.chatHistory, {
            role: 'user',
            content: userMessage,
            timestamp: new Date().toLocaleTimeString()
          }]
        });
      }
      return newChats;
    });

    try {
      const response = await agentManager.processMessage(agentId, userMessage);
      
      // Add assistant response
      setAgentChats(prev => {
        const newChats = new Map(prev);
        const currentChat = newChats.get(agentId);
        if (currentChat) {
          newChats.set(agentId, {
            ...currentChat,
            isProcessing: false,
            chatHistory: [...currentChat.chatHistory, {
              role: 'assistant',
              content: response,
              timestamp: new Date().toLocaleTimeString()
            }]
          });
        }
        return newChats;
      });
    } catch (error) {
      console.error('Chat error:', error);
      
      // Add error message
      setAgentChats(prev => {
        const newChats = new Map(prev);
        const currentChat = newChats.get(agentId);
        if (currentChat) {
          newChats.set(agentId, {
            ...currentChat,
            isProcessing: false,
            chatHistory: [...currentChat.chatHistory, {
              role: 'assistant',
              content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
              timestamp: new Date().toLocaleTimeString()
            }]
          });
        }
        return newChats;
      });
    }
  };

  const handleChatInputChange = (agentId: string, value: string) => {
    setAgentChats(prev => {
      const newChats = new Map(prev);
      const currentChat = newChats.get(agentId);
      if (currentChat) {
        newChats.set(agentId, {
          ...currentChat,
          chatInput: value
        });
      }
      return newChats;
    });
  };

  const handleClearChat = (agentId: string) => {
    if (!agentManager) return;
    
    agentManager.clearAgentHistory(agentId);
    
    setAgentChats(prev => {
      const newChats = new Map(prev);
      const currentChat = newChats.get(agentId);
      if (currentChat) {
        newChats.set(agentId, {
          ...currentChat,
          chatHistory: []
        });
      }
      return newChats;
    });
  };

  const handleRenameAgent = (agentId: string) => {
    if (!agentManager) return;
    
    const agent = agentManager.getAgentInfo(agentId);
    if (!agent) return;
    
    const newName = prompt(`Enter new name for "${agent.name}":`, agent.name);
    if (newName && newName.trim() !== agent.name) {
      try {
        agentManager.renameAgent(agentId, newName.trim());
        setAgents(agentManager.getAllAgents());
      } catch (error) {
        console.error('Failed to rename agent:', error);
        alert(`Failed to rename agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Auto-scroll chat to bottom when new messages are added
  useEffect(() => {
    agentChats.forEach((chatState, agentId) => {
      const scrollRef = chatScrollRefs.current.get(agentId);
      if (scrollRef) {
        scrollRef.scrollTop = scrollRef.scrollHeight;
      }
    });
  }, [agentChats]);

  // Auto-scroll logs to bottom when new logs are added
  useEffect(() => {
    logs.forEach((_, agentId) => {
      const scrollRef = logScrollRefs.current.get(agentId);
      if (scrollRef) {
        scrollRef.scrollTop = scrollRef.scrollHeight;
      }
    });
  }, [logs]);

  const activeAgent = activeAgentId ? agents.find(a => a.id === activeAgentId) : null;
  const activeChatState = activeAgentId ? agentChats.get(activeAgentId) : null;
  const activeLog = activeAgentId ? logs.get(activeAgentId) || "" : "";

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

  // Focus chat input after processing is complete for the active agent
  useEffect(() => {
    if (activeAgentId && activeChatState && !activeChatState.isProcessing) {
      const inputRef = chatInputRefs.current.get(activeAgentId);
      if (inputRef) {
        inputRef.focus();
      }
    }
  }, [activeAgentId, activeChatState?.isProcessing]);

  const handleToggleDebugPanel = () => {
    setIsDebugPanelVisible(!isDebugPanelVisible);
  };

  return (
    <div style={{ 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '1400px',
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
            🤖 Multi-Agent MCP Browser
            <span style={{
              fontSize: '14px',
              padding: '4px 8px',
              borderRadius: '12px',
              backgroundColor: '#6366f1',
              color: 'white',
              fontWeight: 'normal'
            }}>
              {agents.filter(a => a.isActive).length} / {agents.length} ACTIVE
            </span>
          </h1>
          
          {/* Mode Toggle Button */}
          {onSwitchToSingleAgent && (
            <button
              onClick={onSwitchToSingleAgent}
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
              🔄 Switch to Single Agent Mode
            </button>
          )}
        </div>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Manage multiple AI agents, each with their own conversation and context
        </p>
      </header>

      {/* Agent Tabs */}
      <div style={{
        backgroundColor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px 8px 0 0',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        overflowX: 'auto'
      }}>
        {agents.map(agent => (
          <div
            key={agent.id}
            onClick={() => setActiveAgentId(agent.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: activeAgentId === agent.id ? '#2563eb' : 'white',
              color: activeAgentId === agent.id ? 'white' : '#374151',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              minWidth: 'fit-content',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: agent.isActive ? '#10b981' : '#6b7280'
            }} />
            <span>{agent.name}</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameAgent(agent.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '12px',
                  opacity: 0.7
                }}
                title="Rename agent"
              >
                ✏️
              </button>
              {agents.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveAgent(agent.id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    opacity: 0.7
                  }}
                  title="Remove agent"
                >
                  ❌
                </button>
              )}
            </div>
          </div>
        ))}
        
        {/* Add Agent Button */}
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              minWidth: 'fit-content'
            }}
          >
            + Add Agent
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              type="text"
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="Agent name (optional)"
              style={{
                padding: '6px 10px',
                border: '1px solid #e2e8f0',
                borderRadius: '4px',
                fontSize: '14px',
                width: '150px'
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreateAgent();
                }
              }}
            />
            <button
              onClick={handleCreateAgent}
              disabled={isCreatingAgent}
              style={{
                padding: '6px 12px',
                backgroundColor: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {isCreatingAgent ? '⏳' : '✓'}
            </button>
            <button
              onClick={() => {
                setShowCreateForm(false);
                setNewAgentName("");
              }}
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
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {activeAgent && activeChatState ? (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '20px',
          marginBottom: '20px'
        }}>
          {/* Agent Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h2 style={{ margin: 0, color: '#1e293b' }}>
              💬 Chat with {activeAgent.name}
            </h2>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                onClick={() => handleStartAgent(activeAgent.id)}
                disabled={activeAgent.isActive}
                style={{
                  padding: '6px 12px',
                  backgroundColor: activeAgent.isActive ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: activeAgent.isActive ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                {activeAgent.isActive ? '🔄 Running' : '▶️ Start'}
              </button>
              
              <button
                onClick={() => handleStopAgent(activeAgent.id)}
                disabled={!activeAgent.isActive}
                style={{
                  padding: '6px 12px',
                  backgroundColor: !activeAgent.isActive ? '#9ca3af' : '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: !activeAgent.isActive ? 'not-allowed' : 'pointer',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                ⏹️ Stop
              </button>
              
              <button
                onClick={() => handleClearChat(activeAgent.id)}
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

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr 1fr', 
            gap: '20px'
          }}>
            {/* Chat Area */}
            <div>
              {/* Chat History */}
              <div 
                ref={(el) => chatScrollRefs.current.set(activeAgent.id, el)}
                style={{
                  backgroundColor: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  height: '400px',
                  overflow: 'auto',
                  padding: '15px',
                  marginBottom: '15px'
                }}
              >
                {activeChatState.chatHistory.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    color: '#6b7280', 
                    fontStyle: 'italic',
                    marginTop: '150px'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>💬</div>
                    <div>Start a conversation with {activeAgent.name}</div>
                    <div style={{ fontSize: '12px', marginTop: '5px' }}>
                      {activeAgent.isActive ? 'Agent is ready to chat!' : 'Start the agent first to begin chatting'}
                    </div>
                  </div>
                ) : (
                  <div>
                    {activeChatState.chatHistory.map((message, index) => (
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
                    {activeChatState.isProcessing && (
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
              <form onSubmit={(e) => handleChatSubmit(activeAgent.id, e)} style={{ display: 'flex', gap: '10px' }}>
                <input
                  ref={(el) => chatInputRefs.current.set(activeAgent.id, el)}
                  type="text"
                  value={activeChatState.chatInput}
                  onChange={(e) => handleChatInputChange(activeAgent.id, e.target.value)}
                  placeholder={activeAgent.isActive ? `Message ${activeAgent.name}...` : "Start the agent to begin chatting"}
                  disabled={activeChatState.isProcessing || !activeAgent.isActive}
                  style={{
                    flex: 1,
                    padding: '12px 15px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '25px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: (activeChatState.isProcessing || !activeAgent.isActive) ? '#f9fafb' : 'white'
                  }}
                />
                <button
                  type="submit"
                  disabled={!activeChatState.chatInput.trim() || activeChatState.isProcessing || !activeAgent.isActive}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: (!activeChatState.chatInput.trim() || activeChatState.isProcessing || !activeAgent.isActive) ? '#9ca3af' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '25px',
                    cursor: (!activeChatState.chatInput.trim() || activeChatState.isProcessing || !activeAgent.isActive) ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    fontSize: '14px'
                  }}
                >
                  {activeChatState.isProcessing ? '⏳' : '📤'}
                </button>
              </form>
            </div>

            {/* Activity Log */}
            <div>
              {/* Running Token Total */}
              <TokenUsageDisplay compact style={{ marginBottom: '15px' }} />
              
              <h3 style={{ color: '#1e293b', fontSize: '16px', marginBottom: '10px' }}>
                Activity Log - {activeAgent.name}
              </h3>
              <div 
                ref={(el) => logScrollRefs.current.set(activeAgent.id, el)}
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
                {activeLog ? (
                  <div>
                    {activeLog.split('\n').map((line, index) => {
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
                            {message.replace(/^[🤖🔧✅❌🛑⏸️🧠]\s*/, '')}
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
                    marginTop: '150px'
                  }}>
                    <div style={{ fontSize: '24px', marginBottom: '10px' }}>🤖</div>
                    <div>No activity yet for {activeAgent.name}</div>
                    <div style={{ fontSize: '11px', marginTop: '5px' }}>
                      Start the agent to see activity logs
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>🤖</div>
          <h2 style={{ color: '#1e293b', marginBottom: '10px' }}>No Agent Selected</h2>
          <p style={{ color: '#6b7280' }}>
            Create your first agent to get started with multi-agent conversations
          </p>
        </div>
      )}

      {/* Enhanced Debug Panel */}
      <EnhancedDebugPanel 
        conversationFlows={conversationFlows}
        isVisible={isDebugPanelVisible}
        onToggle={handleToggleDebugPanel}
      />

      <footer style={{ 
        textAlign: 'center', 
        color: '#6b7280', 
        fontSize: '14px',
        borderTop: '1px solid #e2e8f0',
        paddingTop: '20px',
        marginTop: '20px'
      }}>
        <p>
          🧠 Powered by MCP (Model Context Protocol) • 
          🔧 Multiple agents with shared tools • 
          🤖 AI reasoning via OpenAI API
        </p>
      </footer>
    </div>
  );
}

export default MultiAgentInterface;
