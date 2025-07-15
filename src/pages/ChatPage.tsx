import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Upload, FileText, Play, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';
import FileUploadSection from '@/components/FileUploadSection';
import ViolationsPanel from '@/components/ViolationsPanel';
import ChatInterface from '@/components/ChatInterface';
import CodeSnippetsPanel from '@/components/CodeSnippetsPanel';

export default function ChatPage() {
  const { state, dispatch, addChatMessage } = useAppContext();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('chat');

  const handleStartChat = async () => {
    if (!state.uploadedFile) {
      toast({
        title: "No file uploaded",
        description: "Please upload a C++ file first",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch('/api/gemini/init-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          projectId: state.projectId,
          filePath: state.uploadedFile.path,
          modelSettings: state.modelSettings 
        }),
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'SET_SESSION_ID', payload: data.sessionId });
        addChatMessage('Chat session started. File received and ready for violations.', 'system');
        toast({
          title: "Success",
          description: "Chat session initialized successfully",
        });
      } else {
        throw new Error('Failed to initialize chat');
      }
    } catch (error) {
      console.error('Start chat error:', error);
      toast({
        title: "Error",
        description: "Failed to start chat session",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleFixViolations = async () => {
    if (state.selectedViolations.length === 0) {
      toast({
        title: "No violations selected",
        description: "Please select violations to fix",
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
      addChatMessage(`Fixing ${state.selectedViolations.length} selected violations...`, 'user');
      
      const response = await fetch('/api/gemini/fix-violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: state.sessionId,
          violations: state.selectedViolations,
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
            setActiveTab('snippets');
          }
        }
      } else {
        throw new Error('Failed to fix violations');
      }
    } catch (error) {
      console.error('Fix violations error:', error);
      toast({
        title: "Error",
        description: "Failed to fix violations",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleApplyFixes = async () => {
    if (state.fixedSnippets.length === 0) {
      toast({
        title: "No fixes to apply",
        description: "Please generate fixes first",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch('/api/apply-fixes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          currentVersion: state.currentVersion,
          fixedSnippets: state.fixedSnippets.filter(s => s.applied !== false)
        }),
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({ type: 'INCREMENT_VERSION' });
        dispatch({ type: 'SET_VIOLATIONS', payload: data.remainingViolations });
        dispatch({ type: 'SET_FIXED_SNIPPETS', payload: [] });
        
        toast({
          title: "Success",
          description: `Fixes applied successfully. New version: v${state.currentVersion + 1}`,
        });
      } else {
        throw new Error('Failed to apply fixes');
      }
    } catch (error) {
      console.error('Apply fixes error:', error);
      toast({
        title: "Error",
        description: "Failed to apply fixes",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleDenumberFile = async () => {
    if (!state.projectId) {
      toast({
        title: "No project",
        description: "No active project to denumber",
        variant: "destructive",
      });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await fetch('/api/denumber-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          version: state.currentVersion
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Create download link
        const link = document.createElement('a');
        link.href = `/api/download/${data.fileName}`;
        link.download = data.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast({
          title: "Success",
          description: "File denumbered and download started",
        });
      } else {
        throw new Error('Failed to denumber file');
      }
    } catch (error) {
      console.error('Denumber file error:', error);
      toast({
        title: "Error",
        description: "Failed to denumber file",
        variant: "destructive",
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">MISRA Fixing Copilot</h1>
          <div className="flex items-center gap-4">
            {state.uploadedFile && (
              <Badge variant="secondary">
                v{state.currentVersion} - {state.uploadedFile.name}
              </Badge>
            )}
            <Link to="/settings">
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <FileUploadSection />
            
            {/* Action Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleStartChat}
                  disabled={!state.uploadedFile || state.isLoading}
                  className="w-full"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Chat
                </Button>
                
                <Button 
                  onClick={handleFixViolations}
                  disabled={state.selectedViolations.length === 0 || state.isLoading}
                  variant="secondary"
                  className="w-full"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Fix Violations ({state.selectedViolations.length})
                </Button>
                
                <Button 
                  onClick={handleApplyFixes}
                  disabled={state.fixedSnippets.length === 0 || state.isLoading}
                  variant="outline"
                  className="w-full"
                >
                  Apply Fixes ({state.fixedSnippets.length})
                </Button>
                
                <Button 
                  onClick={handleDenumberFile}
                  disabled={!state.projectId || state.isLoading}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Final
                </Button>
              </CardContent>
            </Card>

            {/* Progress */}
            {state.isLoading && (
              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Processing...</span>
                    </div>
                    <Progress value={undefined} className="w-full" />
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Center Panel - Main Content */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="chat">Chat</TabsTrigger>
                <TabsTrigger value="violations">
                  Violations ({state.violations.length})
                </TabsTrigger>
                <TabsTrigger value="snippets">
                  Snippets ({state.fixedSnippets.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="mt-6">
                <ChatInterface />
              </TabsContent>
              
              <TabsContent value="violations" className="mt-6">
                <ViolationsPanel />
              </TabsContent>
              
              <TabsContent value="snippets" className="mt-6">
                <CodeSnippetsPanel />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}