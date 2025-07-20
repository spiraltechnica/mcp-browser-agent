import { useEffect, useState } from 'react';
import { getDebugEventManager } from '../debug/DebugEventManager';

interface TokenUsageDisplayProps {
  style?: React.CSSProperties;
  compact?: boolean;
}

export function TokenUsageDisplay({ style, compact = false }: TokenUsageDisplayProps) {
  const [tokenStats, setTokenStats] = useState({
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalLLMCalls: 0,
    conversationCount: 0
  });

  useEffect(() => {
    const debugManager = getDebugEventManager();
    
    // Update token stats
    const updateStats = () => {
      const stats = debugManager.getTokenUsageStats();
      setTokenStats(stats);
    };

    // Initial load
    updateStats();

    // Subscribe to flow updates to refresh stats
    const unsubscribe = debugManager.onFlow(() => {
      updateStats();
    });

    // Also update on event changes for real-time updates
    const unsubscribeEvent = debugManager.onEvent(() => {
      updateStats();
    });

    return () => {
      unsubscribe();
      unsubscribeEvent();
    };
  }, []);

  if (compact) {
    return (
      <div style={{
        backgroundColor: '#f0f9ff',
        border: '1px solid #0ea5e9',
        borderRadius: '6px',
        padding: '8px 12px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#0c4a6e',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...style
      }}>
        <span>🔢</span>
        <span>{tokenStats.totalTokens.toLocaleString()} tokens</span>
        <span style={{ color: '#64748b', fontWeight: 'normal' }}>
          ({tokenStats.totalLLMCalls} calls)
        </span>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#f0f9ff',
      border: '2px solid #0ea5e9',
      borderRadius: '8px',
      padding: '15px',
      ...style
    }}>
      <h4 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '14px', 
        color: '#0c4a6e', 
        fontWeight: '600',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        🔢 Running Token Total
      </h4>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '12px',
        marginBottom: '12px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            color: '#0c4a6e', 
            fontWeight: '700', 
            fontSize: '20px',
            lineHeight: '1'
          }}>
            {tokenStats.totalTokens.toLocaleString()}
          </div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
            Total Tokens
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            color: '#0c4a6e', 
            fontWeight: '700', 
            fontSize: '20px',
            lineHeight: '1'
          }}>
            {tokenStats.totalLLMCalls}
          </div>
          <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>
            LLM Calls
          </div>
        </div>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '12px',
        fontSize: '12px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            color: '#0c4a6e', 
            fontWeight: '600', 
            fontSize: '16px',
            lineHeight: '1'
          }}>
            {tokenStats.promptTokens.toLocaleString()}
          </div>
          <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
            Prompt Tokens
          </div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            color: '#0c4a6e', 
            fontWeight: '600', 
            fontSize: '16px',
            lineHeight: '1'
          }}>
            {tokenStats.completionTokens.toLocaleString()}
          </div>
          <div style={{ color: '#64748b', fontSize: '10px', marginTop: '2px' }}>
            Completion Tokens
          </div>
        </div>
      </div>

      {tokenStats.conversationCount > 0 && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid #bae6fd',
          fontSize: '11px',
          color: '#64748b',
          textAlign: 'center'
        }}>
          Across {tokenStats.conversationCount} conversation{tokenStats.conversationCount !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
