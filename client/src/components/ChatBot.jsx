import { useState, useRef, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';

const CATEGORY_ICONS = {
  portfolio: 'dashboard',
  resources: 'group',
  utilization: 'speed',
  attendance: 'calendar_month',
  compliance: 'fact_check',
  analytics: 'insights',
  help: 'smart_toy',
  error: 'error',
};

const SUGGESTED_QUESTIONS = [
  'What are the total hours?',
  'Show squad allocation',
  'Who is overloaded?',
  'What\'s the attendance rate?',
  'Who missed timesheets?',
];

export default function ChatBot() {
  const { selectedMonths } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Hello! I\'m the PMO Assistant. Ask me about hours, resources, squads, attendance, or compliance.', category: 'help' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = useCallback(async (text) => {
    const msg = text || input.trim();
    if (!msg) return;

    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const qs = selectedMonths.length > 0 ? `?months=${selectedMonths.join(',')}` : '';
      const res = await fetch(`/api/chatbot${qs}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'bot', text: data.reply, category: data.category }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, I couldn\'t connect to the server.', category: 'error' }]);
    } finally {
      setLoading(false);
    }
  }, [input, selectedMonths]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Simple markdown-like rendering: **bold** and \n to <br>
  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-on-surface">{part.slice(2, -2)}</strong>;
      }
      // Split by newlines
      return part.split('\n').map((line, j) => (
        <span key={`${i}-${j}`}>{j > 0 && <br />}{line}</span>
      ));
    });
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${
          isOpen ? 'bg-slate-700 rotate-0' : 'bg-[#004ac6] hover:bg-[#003494]'
        }`}
      >
        <span className="material-symbols-outlined text-white text-2xl">
          {isOpen ? 'close' : 'smart_toy'}
        </span>
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-[#004ac6] px-5 py-4 flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-lg">smart_toy</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">PMO Assistant</h3>
              <p className="text-[10px] text-white/70">Ask anything about your PMO data</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[9px] text-white/60 font-bold">ONLINE</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-[#004ac6]/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                    <span className="material-symbols-outlined text-[#004ac6] text-sm">
                      {CATEGORY_ICONS[msg.category] || 'smart_toy'}
                    </span>
                  </div>
                )}
                <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#004ac6] text-white rounded-br-md'
                    : 'bg-white text-slate-700 rounded-bl-md border border-slate-200 shadow-sm'
                }`}>
                  {renderText(msg.text)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-[#004ac6]/10 flex items-center justify-center shrink-0 mt-1 mr-2">
                  <span className="material-symbols-outlined text-[#004ac6] text-sm animate-spin">sync</span>
                </div>
                <div className="bg-white px-4 py-3 rounded-2xl rounded-bl-md border border-slate-200 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested questions (only show if few messages) */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 border-t border-slate-100 bg-white flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-[10px] font-semibold text-[#004ac6] bg-[#004ac6]/5 px-2.5 py-1 rounded-full hover:bg-[#004ac6]/10 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-slate-200 bg-white shrink-0">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={loading}
                className="flex-1 bg-slate-100 text-sm text-slate-800 rounded-full px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#004ac6]/30 placeholder-slate-400 disabled:opacity-50"
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="w-10 h-10 rounded-full bg-[#004ac6] flex items-center justify-center hover:bg-[#003494] transition-colors disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-white text-lg">send</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
