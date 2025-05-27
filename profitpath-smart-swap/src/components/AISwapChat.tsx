import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { Send } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface SwapInterpretation {
  fromChain: string | null;
  toChain: string | null;
  fromToken: string;
  toToken: string;
  amount: string;
  solanaAddress?: string;
}

interface AISwapChatProps {
  onSwapInterpretation?: (interpretation: SwapInterpretation) => void;
  isCrossChain?: boolean;
}

const AISwapChat: React.FC<AISwapChatProps> = ({ onSwapInterpretation, isCrossChain }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I can help you swap tokens across chains. Just tell me what you want to do.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    try {
      // Prepare chat history for backend (excluding the current input)
      const history = [...messages, { role: 'user', content: userMessage }];
      const response = await fetch('http://localhost:4000/ai/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, isCrossChain, history }),
      });
      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      // Always call onSwapInterpretation if AI says isComplete
      if (onSwapInterpretation && data.context && data.context.isComplete) {
        console.log('[AI DEBUG] Calling onSwapInterpretation with:', data.context);
        onSwapInterpretation(data.context);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-slate-900 rounded-2xl border border-purple-800/40 shadow-xl">
      <ScrollArea className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, idx) => (
          <div key={idx} className={cn('mb-3 flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'px-4 py-2 rounded-xl max-w-[75%] whitespace-pre-line',
              msg.role === 'user'
                ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white'
                : 'bg-slate-800 text-purple-200 border border-purple-700'
            )}>
              {msg.content}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </ScrollArea>
      <form
        className="flex items-center gap-2 border-t border-purple-800/40 bg-slate-900 p-3"
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage();
        }}
      >
        <Input
          className="flex-1 bg-slate-800 text-white border-purple-700 focus:outline-none"
          placeholder="Type your message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          autoFocus
        />
        <Button
          type="submit"
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </form>
    </div>
  );
};

export default AISwapChat;