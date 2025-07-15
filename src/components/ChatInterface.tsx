import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

export default function ChatInterface() {
  const { state, dispatch, addChatMessage } = useAppContext();
  const { toast } = useToast();
  const [feedbackText, setFeedbackText] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [state.chatHistory]);

  const handleRetryWithFeedback = async () => {
    if (!feedbackText.trim()) {
      toast({
        title: "No feedback provided",
        description: "Please enter feedback before retrying",
        variant: "destructive",
      });
      return;
    }

    if (state.selectedViolations.length === 0) {
      toast({
        title: "No violations selected",
        description: "Please select violations to retry",
        variant: "destructive",
      });
      return;
    }

    if (!state.sessionId) {
      toast({
        title: "No active session",
        description: "Please start a chat session first",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      addChatMessage(`Retrying with feedback: ${feedbackText}`, 'user');
      
      const response = await fetch('/api/gemini/fix-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          violations: state.selectedViolations,
          feedback: feedbackText,
          modelSettings: state.modelSettings
        }),
      });

      if (response.ok) {
        const reader = response.body?.getReader();
        if (reader) {
          let fullResponse = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = new TextDecoder().decode(value);
            fullResponse += chunk;
          }
          
          addChatMessage(fullResponse, 'assistant');
          
          // Parse fixed snippets
          const parseResponse = await fetch('/api/parse-fixed-snippets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ response: fullResponse }),
          });
          
          if (parseResponse.ok) {
            const snippets = await parseResponse.json();
            dispatch({ type: 'SET_FIXED_SNIPPETS', payload: snippets });
          }
          
          setFeedbackText('');
          setShowFeedbackInput(false);
        }
      } else {
        throw new Error('Failed to retry with feedback');
      }
    } catch (error) {
      console.error('Retry with feedback error:', error);
      toast({
        title: "Error",
        description: "Failed to retry with feedback",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const getMessageIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      case 'system':
        return <Settings className="w-4 h-4" />;
      default:
        return <Bot className="w-4 h-4" />;
    }
  };

  const getMessageColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-blue-100 border-blue-200';
      case 'assistant':
        return 'bg-green-100 border-green-200';
      case 'system':
        return 'bg-gray-100 border-gray-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  const formatMessage = (content: string) => {
    // Basic formatting for code blocks
    if (content.includes('```')) {
      const parts = content.split('```');
      return parts.map((part, index) => {
        if (index % 2 === 1) {
          // This is a code block
          return (
            <pre key={index} className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm my-2">
              <code>{part}</code>
            </pre>
          );
        }
        return <span key={index}>{part}</span>;
      });
    }
    
    return content;
  };

  if (state.chatHistory.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Chat with Gemini</h3>
          <p className="text-muted-foreground text-center">
            Upload your files and start a chat session to begin fixing MISRA violations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Chat History</CardTitle>
          <div className="flex items-center gap-2">
            {state.sessionId && (
              <Badge variant="secondary" className="text-xs">
                Session Active
              </Badge>
            )}
            {state.isLoading && (
              <Badge variant="outline" className="text-xs">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Processing...
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col">
        <ScrollArea ref={scrollAreaRef} className="flex-1 pr-4">
          <div className="space-y-4">
            {state.chatHistory.map((message) => (
              <div
                key={message.id}
                className={`border rounded-lg p-4 ${getMessageColor(message.type)}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getMessageIcon(message.type)}
                  <span className="text-sm font-medium capitalize">{message.type}</span>
                  <span className="text-xs text-muted-foreground">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm whitespace-pre-wrap">
                  {formatMessage(message.content)}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Feedback Section */}
        <div className="mt-4 space-y-3 border-t pt-4">
          {!showFeedbackInput ? (
            <Button
              onClick={() => setShowFeedbackInput(true)}
              variant="outline"
              className="w-full"
              disabled={state.isLoading || state.selectedViolations.length === 0}
            >
              Retry with Feedback
            </Button>
          ) : (
            <div className="space-y-2">
              <Textarea
                placeholder="Enter feedback for improving the fixes..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleRetryWithFeedback}
                  disabled={state.isLoading || !feedbackText.trim()}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Send Feedback
                </Button>
                <Button
                  onClick={() => {
                    setShowFeedbackInput(false);
                    setFeedbackText('');
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}