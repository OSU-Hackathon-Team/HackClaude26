'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ShieldAlert, Loader2, X, MessageCircle } from 'lucide-react';

interface OncoBotProps {
  selectedOrgan: string | null;
  onClose?: () => void;
}

export function OncoBot({ selectedOrgan, onClose }: OncoBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([
    {
      role: 'assistant',
      content: `Hello. I am OncoBot, clinical assistant for OncoPath. I am currently locked to analyzing: ${selectedOrgan || "General Anatomy"}. How can I assist you with this structure today?`
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
     if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
  }, [messages, isTyping, isOpen]);

  // If the target organ changes context, alert the bot state!
  useEffect(() => {
     if (selectedOrgan) {
        setMessages(prev => [
            ...prev,
            { role: 'assistant', content: `[SYSTEM ALERT] Diagnosis context shifted. I am now strictly analyzing the ${selectedOrgan}. Please provide relevant queries.` }
        ]);
     }
  }, [selectedOrgan]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    
    const userPayload = input.trim();
    const newContext = [...messages, { role: 'user' as const, content: userPayload }];
    
    setMessages(newContext);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/oncobot', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            messages: newContext.filter(m => !m.content.startsWith('[SYSTEM ALERT]')), // filter out artificial system alerts from true prompt history
            selectedOrgan: selectedOrgan
         })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Server issue.");

      // Strip common markdown asterisks and hash marks
      const cleanText = (data.text || "").replace(/[*#]/g, "");

      setMessages(prev => [...prev, { role: 'assistant', content: cleanText }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) {
    return (
       <button 
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto absolute bottom-4 right-4 z-[60] flex items-center justify-center w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] text-white transition-all hover:scale-105 border border-blue-400/50"
       >
          <MessageCircle size={20} />
       </button>
    );
  }

  return (
    <div className="absolute right-4 bottom-4 w-[350px] h-[450px] flex flex-col pointer-events-auto bg-zinc-900/90 backdrop-blur-xl border border-zinc-700 shadow-[0_0_30px_rgba(0,0,0,0.8)] rounded-xl z-[60] overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="bg-zinc-800/80 border-b border-zinc-700 p-4 flex justify-between items-center shrink-0">
           <div className="flex items-center gap-2 text-blue-400">
               <Bot size={18} />
               <h3 className="font-bold text-sm tracking-widest uppercase">OncoBot AI</h3>
           </div>
           <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-white transition-colors">
              <X size={16} />
           </button>
        </div>
        
        {/* Context Strip */}
        <div className="bg-blue-900/20 px-4 py-2 border-b border-zinc-700/50 flex items-center gap-2 text-xs text-blue-300 font-medium shrink-0">
           <ShieldAlert size={14} className="text-blue-400" />
           Protection Active: Restricted to {selectedOrgan || 'General Anatomy'}
        </div>

        {/* Chat Log */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
            {messages.map((m, i) => (
                <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 mb-1 px-1 opacity-60 text-[10px] uppercase font-bold tracking-wider ${m.role === 'user' ? 'text-zinc-200 justify-end' : 'text-blue-300'}`}>
                        {m.role === 'user' ? <User size={10} /> : <Bot size={10} />}
                        {m.role === 'user' ? 'You' : 'OncoBot'}
                    </div>
                    <div className={`text-sm px-3 py-2 rounded-xl max-w-[90%] shadow-lg ${
                            m.role === 'user' 
                            ? 'bg-blue-600/80 text-white rounded-br-sm' 
                            : m.content.startsWith('[SYSTEM') 
                                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/30 font-medium text-xs' 
                                : 'bg-zinc-800/90 text-zinc-200 border border-zinc-700/50 rounded-bl-sm'
                        }`}>
                        {m.content}
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex items-center gap-2 text-blue-400 opacity-80 text-xs py-2">
                    <Loader2 size={14} className="animate-spin" /> Fetching diagnostics...
                </div>
            )}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-zinc-800/90 shrink-0 border-t border-zinc-700 flex gap-2">
           <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a clinical question..."
              className="flex-1 bg-zinc-950/50 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
           />
           <button 
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors p-2 rounded-lg text-white flex items-center justify-center shrink-0 w-10 h-10"
           >
              <Send size={16} />
           </button>
        </div>
    </div>
  );
}
