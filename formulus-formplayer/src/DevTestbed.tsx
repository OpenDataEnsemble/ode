import React, { useState, useEffect } from 'react';
import { webViewMock, sampleFormData } from './webview-mock';
import { FormInitData } from './FormulusInterfaceDefinition';

interface DevTestbedProps {
  isVisible: boolean;
}

const DevTestbed: React.FC<DevTestbedProps> = ({ isVisible }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [customFormData, setCustomFormData] = useState<string>(
    JSON.stringify(sampleFormData, null, 2)
  );

  useEffect(() => {
    console.log('[DevTestbed] Component mounted, isVisible:', isVisible);
    const messageListener = (message: any) => {
      setMessages(prev => [...prev, { timestamp: new Date().toLocaleTimeString(), ...message }]);
    };

    webViewMock.addMessageListener(messageListener);
    return () => webViewMock.removeMessageListener(messageListener);
  }, [isVisible]);

  const handleSendFormInit = () => {
    try {
      const data: FormInitData = JSON.parse(customFormData);
      console.log('[DevTestbed] Sending form init with data:', data);
      webViewMock.simulateFormInit(data);
    } catch (error) {
      console.error('[DevTestbed] Error parsing form data:', error);
      alert('Invalid JSON in form data: ' + error);
    }
  };

  const handleLoadSampleData = () => {
    setCustomFormData(JSON.stringify(sampleFormData, null, 2));
  };

  const handleQuickTest = () => {
    // Quick test with minimal data
    const quickData: FormInitData = {
      formType: "TestForm",
      observationId: null, // New form, no observation ID yet
      params: {
        defaultData: { message: "Hello from Quick Test!" }
      },
      savedData: { message: "Hello from Quick Test!" },
      formSchema: {
        type: "object",
        properties: {
          message: {
            type: "string",
            title: "Message"
          }
        }
      }
    };
    console.log('[DevTestbed] Quick test with data:', quickData);
    webViewMock.simulateFormInit(quickData);
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  if (!isVisible) return null;

  return (
    <div style={{
      height: '100vh',
      padding: '20px',
      backgroundColor: '#f8f9fa',
      borderLeft: '1px solid #dee2e6',
      overflow: 'auto',
      boxSizing: 'border-box'
    }}>
      <div style={{
        marginBottom: '20px',
        padding: '16px',
        backgroundColor: '#e8f5e8',
        border: '1px solid #4caf50',
        borderRadius: '8px'
      }}>
        <h3 style={{ 
          margin: '0 0 8px 0', 
          color: '#2e7d32',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          🧪 Development Testbed
        </h3>
        <p style={{ 
          margin: '0', 
          fontSize: '14px', 
          color: '#388e3c' 
        }}>
          {webViewMock.isActiveMock() ? '✅ Mock Active' : '❌ Mock Inactive'}
        </p>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#666' }}>Form Init Data</h4>
        <textarea
          value={customFormData}
          onChange={(e) => setCustomFormData(e.target.value)}
          style={{
            width: '100%',
            height: '200px',
            fontFamily: 'monospace',
            fontSize: '11px',
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            boxSizing: 'border-box'
          }}
          placeholder="Enter JSON form data..."
        />
        <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
          <button
            onClick={handleSendFormInit}
            style={{
              padding: '8px 12px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Send onFormInit
          </button>
          <button
            onClick={handleLoadSampleData}
            style={{
              padding: '8px 12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Load Sample
          </button>
          <button
            onClick={handleQuickTest}
            style={{
              padding: '8px 12px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Quick Test
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h4 style={{ margin: 0, color: '#666' }}>Messages from App</h4>
          <button
            onClick={handleClearMessages}
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Clear
          </button>
        </div>
        <div style={{
          maxHeight: '200px',
          overflow: 'auto',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: '#fff'
        }}>
          {messages.length === 0 ? (
            <div style={{ padding: '8px', color: '#666', fontStyle: 'italic' }}>
              No messages yet...
            </div>
          ) : (
            messages.map((msg, index) => (
              <div key={index} style={{
                padding: '8px',
                borderBottom: index < messages.length - 1 ? '1px solid #eee' : 'none'
              }}>
                <div style={{ color: '#666', fontSize: '10px' }}>{msg.timestamp}</div>
                <div style={{ color: '#333' }}>
                  Type: <strong>{msg.type}</strong>
                </div>
                {Object.keys(msg).filter(k => k !== 'timestamp' && k !== 'type').map(key => (
                  <div key={key} style={{ color: '#666', fontSize: '11px' }}>
                    {key}: {JSON.stringify(msg[key])}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ fontSize: '11px', color: '#666', lineHeight: '1.4' }}>
        <strong>Usage:</strong><br/>
        1. Modify the JSON data above<br/>
        2. Click "Send onFormInit" to simulate native host<br/>
        3. Watch messages from app below<br/>
        4. Form should load with your data
      </div>
    </div>
  );
};

export default DevTestbed;
