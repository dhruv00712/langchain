import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const chatBodyRef = useRef(null);

  const API_URL = 'http://localhost:3000';

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Send message
  const sendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage = {
      text: inputValue,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setShowWelcome(false);
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_URL}/api/query`, {
        question: inputValue
      });

      const botMessage = {
        text: response.data.answer,
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        diagram: response.data.generatedDiagram || null,
        circuits: response.data.relevantCircuits || []
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const errorMessage = {
        text: '❌ Sorry, I couldn\'t connect to the server. Make sure the backend is running on http://localhost:3000',
        sender: 'bot',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Enter key
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Quick action buttons
  const handleQuickAction = (question) => {
    setInputValue(question);
    setTimeout(() => sendMessage(), 100);
  };

  // Format text with code blocks and bold
  const formatText = (text) => {
    // Convert code blocks
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    
    // Convert inline code
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Convert bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    
    // Convert line breaks
    text = text.replace(/\n/g, '<br>');
    
    return text;
  };

  // Download SVG
  const downloadSVG = (path) => {
    window.open(`${API_URL}${path}`, '_blank');
  };

  return (
    <div className="app">
      {/* Background Particles */}
      <div className="bg-particles">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${Math.random() * 100 + 50}px`,
              height: `${Math.random() * 100 + 50}px`,
              animationDelay: `${Math.random() * 20}s`,
              animationDuration: `${Math.random() * 10 + 15}s`
            }}
          />
        ))}
      </div>

      {/* Main Chat Container */}
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="header-content">
            <div className="header-left">
              <div className="logo-circle">⚡</div>
              <div className="header-text">
                <h1>Circuit AI Assistant</h1>
                <p>
                  <span className="status-dot"></span>
                  Online • Ready to help with Arduino circuits
                </p>
              </div>
            </div>
            <div className="header-actions">
              <button className="icon-button" title="Clear Chat" onClick={() => {
                setMessages([]);
                setShowWelcome(true);
              }}>
                🗑️
              </button>
              <button className="icon-button" title="Help" onClick={() => {
                handleQuickAction('Help me understand how to use this chatbot');
              }}>
                ❓
              </button>
            </div>
          </div>
        </div>

        {/* Chat Body */}
        <div className="chat-body" ref={chatBodyRef}>
          {/* Welcome Screen */}
          {showWelcome && messages.length === 0 && (
            <div className="welcome-screen">
              <div className="welcome-icon">🔌</div>
              <h2>Welcome to Circuit AI!</h2>
              <p>Your intelligent Arduino circuit assistant. Ask me anything about circuits, components, or get step-by-step guidance!</p>
              
              <div className="quick-actions">
                <div className="quick-action-card" onClick={() => handleQuickAction('Show me how to blink an LED with Arduino')}>
                  <div className="icon">💡</div>
                  <h3>LED Blink</h3>
                  <p>Learn to blink an LED with Arduino</p>
                </div>
                <div className="quick-action-card" onClick={() => handleQuickAction('How do I use an ultrasonic sensor?')}>
                  <div className="icon">📡</div>
                  <h3>Ultrasonic Sensor</h3>
                  <p>Measure distance with sensors</p>
                </div>
                <div className="quick-action-card" onClick={() => handleQuickAction('What is Arduino Nano?')}>
                  <div className="icon">🔧</div>
                  <h3>Arduino Basics</h3>
                  <p>Learn about Arduino components</p>
                </div>
                <div className="quick-action-card" onClick={() => handleQuickAction('Show me all available circuits')}>
                  <div className="icon">📚</div>
                  <h3>Browse Circuits</h3>
                  <p>Explore circuit library</p>
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.sender}`}>
              <div className="message-avatar">
                {message.sender === 'user' ? '👤' : '🤖'}
              </div>
              <div className="message-content">
                <div dangerouslySetInnerHTML={{ __html: formatText(message.text) }} />
                
                {/* Circuit Diagram */}
                {message.diagram && (
                  <div className="circuit-diagram">
                    <div className="circuit-header">
                      <h4>📊 Circuit Diagram Generated</h4>
                      <button 
                        className="download-btn"
                        onClick={() => downloadSVG(message.diagram)}
                      >
                        ⬇ Download SVG
                      </button>
                    </div>
                    <div className="circuit-image">
                      <img 
                        src={`${API_URL}${message.diagram}`} 
                        alt="Circuit Diagram"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentElement.innerHTML += '<p style="color: #ef4444; text-align: center;">❌ Could not load diagram</p>';
                        }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="message-time">{message.timestamp}</div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="message bot">
              <div className="message-avatar">🤖</div>
              <div className="message-content">
                <div className="typing-indicator">
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                  <div className="typing-dot"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="chat-input-container">
          <div className="input-wrapper">
            <div className="input-box">
              <textarea
                className="chat-input"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about circuits, components, or Arduino projects..."
                rows="1"
                disabled={isTyping}
              />
            </div>
            <button 
              className="send-button" 
              onClick={sendMessage}
              disabled={isTyping || !inputValue.trim()}
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;