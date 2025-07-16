import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const API_BASE = 'http://localhost:3001/api';

export interface ModelSettings {
  temperature: number;
  topP: number;
  maxTokens: number;
  modelName: string;
  safetySettings: boolean;
}

export interface Violation {
  File: string;
  Path: string;
  Line: number;
  Warning: string;
  Level: string;
  Misra: string;
  selected?: boolean;
}

export interface ChatMessage {
  type: 'user-request' | 'gemini-response' | 'system';
  content: string;
  timestamp: string;
}

export interface CodeSnippet {
  id: string;
  lineNumbers: string[];
  code: string;
  applied: boolean;
}

export interface AppState {
  // Project info
  projectId: string | null;
  cppFile: File | null;
  excelFile: File | null;
  numberedContent: string;
  currentVersion: string;
  originalFile: string;
  workingFile: string;
  
  // Violations
  violations: Violation[];
  selectedViolations: Violation[];
  
  // Chat
  chatHistory: ChatMessage[];
  isLoading: boolean;
  
  // Code snippets from Gemini
  codeSnippets: CodeSnippet[];
  
  // Settings
  modelSettings: ModelSettings;
  
  // Applied fixes
  appliedFixes: any[];
}

type AppAction =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_PROJECT_ID'; payload: string }
  | { type: 'SET_CPP_FILE'; payload: File }
  | { type: 'SET_EXCEL_FILE'; payload: File }
  | { type: 'SET_VIOLATIONS'; payload: Violation[] }
  | { type: 'TOGGLE_VIOLATION'; payload: Violation }
  | { type: 'SET_SELECTED_VIOLATIONS'; payload: Violation[] }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CODE_SNIPPETS'; payload: CodeSnippet[] }
  | { type: 'UPDATE_MODEL_SETTINGS'; payload: Partial<ModelSettings> }
  | { type: 'RESET_STATE' };

const initialState: AppState = {
  projectId: null,
  cppFile: null,
  excelFile: null,
  numberedContent: '',
  currentVersion: 'v0',
  originalFile: '',
  workingFile: '',
  violations: [],
  selectedViolations: [],
  chatHistory: [],
  isLoading: false,
  codeSnippets: [],
  modelSettings: {
    temperature: 0.5,
    topP: 0.95,
    maxTokens: 65535,
    modelName: 'gemini-1.5-flash',
    safetySettings: false,
  },
  appliedFixes: [],
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, ...action.payload };
    
    case 'SET_PROJECT_ID':
      return { ...state, projectId: action.payload };
    
    case 'SET_CPP_FILE':
      return { ...state, cppFile: action.payload };
    
    case 'SET_EXCEL_FILE':
      return { ...state, excelFile: action.payload };
    
    case 'SET_VIOLATIONS':
      return { ...state, violations: action.payload };
    
    case 'TOGGLE_VIOLATION':
      const isSelected = state.selectedViolations.some(v => 
        v.File === action.payload.File && v.Line === action.payload.Line && v.Misra === action.payload.Misra
      );
      
      return {
        ...state,
        selectedViolations: isSelected
          ? state.selectedViolations.filter(v => 
              !(v.File === action.payload.File && v.Line === action.payload.Line && v.Misra === action.payload.Misra)
            )
          : [...state.selectedViolations, action.payload]
      };
    
    case 'SET_SELECTED_VIOLATIONS':
      return { ...state, selectedViolations: action.payload };
    
    case 'ADD_CHAT_MESSAGE':
      return { 
        ...state, 
        chatHistory: [...state.chatHistory, action.payload]
      };
    
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    
    case 'SET_CODE_SNIPPETS':
      return { ...state, codeSnippets: action.payload };
    
    case 'UPDATE_MODEL_SETTINGS':
      return { 
        ...state, 
        modelSettings: { ...state.modelSettings, ...action.payload }
      };
    
    case 'RESET_STATE':
      return initialState;
    
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // API functions
  uploadCppFile: (file: File) => Promise<any>;
  uploadExcelFile: (file: File) => Promise<any>;
  initializeGeminiChat: () => Promise<any>;
  fixViolations: (selectedViolations: Violation[], feedback?: string) => Promise<any>;
  applyFixes: (snippetIds: string[]) => Promise<any>;
  denumberFile: () => Promise<any>;
  // Helper functions
  addChatMessage: (content: string, type: 'user-request' | 'gemini-response' | 'system') => void;
  toggleViolation: (violation: Violation) => void;
  loadSessionState: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { toast } = useToast();

  const setState = (updates: Partial<AppState>) => {
    dispatch({ type: 'SET_STATE', payload: updates });
  };

  const loadSessionState = async () => {
    try {
      if (!state.projectId) return;
      
      const response = await fetch(`${API_BASE}/session-state/${state.projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          setState({
            ...data.session,
            chatHistory: data.session.chatHistory || []
          });
        }
      }
    } catch (error) {
      console.error('Failed to load session state:', error);
    }
  };

  const uploadCppFile = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (state.projectId) {
        formData.append('projectId', state.projectId);
      }
      
      const response = await fetch(`${API_BASE}/upload/cpp-file`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setState({
          projectId: data.projectId,
          cppFile: file,
          numberedContent: data.numberedContent || '',
          ...data.session
        });
        
        toast({
          title: "Success",
          description: "C++ file uploaded and numbered successfully",
        });
        
        return data;
      }
      throw new Error('Upload failed');
    } catch (error) {
      console.error('Error uploading CPP file:', error);
      toast({
        title: "Error",
        description: "Failed to upload C++ file",
        variant: "destructive",
      });
      throw error;
    }
  };

  const uploadExcelFile = async (file: File) => {
    try {
      if (!state.projectId) {
        throw new Error('No project ID found. Please upload a C++ file first.');
      }
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', state.projectId);
      
      const response = await fetch(`${API_BASE}/upload/misra-report`, {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const data = await response.json();
        setState({
          excelFile: file,
          violations: data.violations || [],
          ...data.session
        });
        
        toast({
          title: "Success",
          description: `Found ${data.violations?.length || 0} violations`,
        });
        
        return data;
      }
      throw new Error('Upload failed');
    } catch (error) {
      console.error('Error uploading Excel file:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload MISRA report",
        variant: "destructive",
      });
      throw error;
    }
  };

  const initializeGeminiChat = async () => {
    try {
      if (!state.projectId) {
        throw new Error('No project ID found');
      }
      
      setState({ isLoading: true });
      
      const response = await fetch(`${API_BASE}/gemini/init-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.projectId,
          modelSettings: state.modelSettings,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        addChatMessage(data.response, 'gemini-response');
        
        toast({
          title: "Success",
          description: "Gemini chat initialized successfully",
        });
        
        return data;
      }
      throw new Error('Failed to initialize chat');
    } catch (error) {
      console.error('Error initializing Gemini chat:', error);
      toast({
        title: "Error",
        description: "Failed to initialize Gemini chat",
        variant: "destructive",
      });
      throw error;
    } finally {
      setState({ isLoading: false });
    }
  };

  const fixViolations = async (selectedViolations: Violation[], feedback?: string) => {
    try {
      if (!state.projectId) {
        throw new Error('No project ID found');
      }
      
      setState({ isLoading: true });
      
      addChatMessage(
        `Fixing ${selectedViolations.length} violations${feedback ? ` with feedback: ${feedback}` : ''}`,
        'user-request'
      );
      
      const response = await fetch(`${API_BASE}/gemini/fix-violations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.projectId,
          selectedViolations,
          feedback,
          modelSettings: state.modelSettings,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to start violation fixing');
      }
      
      // Handle Server-Sent Events for streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.text) {
                  fullResponse += data.text;
                  // Update chat with streaming response
                  setState({
                    chatHistory: state.chatHistory.map((msg, idx) => 
                      idx === state.chatHistory.length - 1 && msg.type === 'gemini-response'
                        ? { ...msg, content: fullResponse }
                        : msg
                    ).concat(state.chatHistory.length === 0 || state.chatHistory[state.chatHistory.length - 1].type !== 'gemini-response' 
                      ? [{
                          type: 'gemini-response',
                          content: fullResponse,
                          timestamp: new Date().toISOString()
                        }] : [])
                  });
                }
                if (data.done) {
                  // Parse code snippets from the full response
                  const snippets = parseCodeSnippets(data.fullResponse || fullResponse);
                  setState({ codeSnippets: snippets });
                  
                  toast({
                    title: "Success",
                    description: `Generated ${snippets.length} code snippets`,
                  });
                  break;
                }
                if (data.error) {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('Error parsing SSE data:', parseError);
              }
            }
          }
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error fixing violations:', error);
      toast({
        title: "Error",
        description: "Failed to fix violations",
        variant: "destructive",
      });
      throw error;
    } finally {
      setState({ isLoading: false });
    }
  };
  
  const parseCodeSnippets = (response: string) => {
    const codeBlocks = response.match(/```(?:cpp|c\+\+)?\s*\n(.*?)```/gs) || [];
    return codeBlocks.map((block, index) => {
      const code = block.replace(/```(?:cpp|c\+\+)?\s*\n/, '').replace(/```$/, '');
      const lines = code.split('\n').filter(line => line.trim());
      const lineNumbers = lines
        .map(line => {
          const match = line.match(/^(\d+[a-zA-Z]*):/)
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];
      
      return {
        id: (index + 1).toString(),
        lineNumbers,
        code,
        applied: false
      };
    });
  };

  const applyFixes = async (snippetIds: string[]) => {
    try {
      if (!state.projectId) {
        throw new Error('No project ID found');
      }
      
      setState({ isLoading: true });
      
      // Extract fixed snippets from selected code snippets
      const selectedSnippets = state.codeSnippets.filter(snippet => 
        snippetIds.includes(snippet.id)
      );
      
      const fixedSnippets: Record<string, string> = {};
      selectedSnippets.forEach(snippet => {
        const lines = snippet.code.split('\n');
        lines.forEach(line => {
          const match = line.match(/^(\d+[a-zA-Z]*):(.*)$/);
          if (match) {
            fixedSnippets[match[1]] = match[2];
          }
        });
      });
      
      const response = await fetch(`${API_BASE}/apply-fixes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.projectId,
          fixedSnippets,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setState({
          codeSnippets: state.codeSnippets.map(snippet => 
            snippetIds.includes(snippet.id) 
              ? { ...snippet, applied: true }
              : snippet
          ),
          currentVersion: data.newVersion,
          ...data.session
        });
        
        toast({
          title: "Success",
          description: `Applied fixes and created ${data.newVersion}`,
        });
        
        return data;
      }
      throw new Error('Failed to apply fixes');
    } catch (error) {
      console.error('Error applying fixes:', error);
      toast({
        title: "Error",
        description: "Failed to apply fixes",
        variant: "destructive",
      });
      throw error;
    } finally {
      setState({ isLoading: false });
    }
  };

  const denumberFile = async () => {
    try {
      if (!state.projectId) {
        throw new Error('No project ID found');
      }
      
      setState({ isLoading: true });
      
      const response = await fetch(`${API_BASE}/denumber-file`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: state.projectId,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        toast({
          title: "Success",
          description: "Final file created successfully",
        });
        
        return data;
      }
      throw new Error('Failed to denumber file');
    } catch (error) {
      console.error('Error denumbering file:', error);
      toast({
        title: "Error",
        description: "Failed to create final file",
        variant: "destructive",
      });
      throw error;
    } finally {
      setState({ isLoading: false });
    }
  };

  const addChatMessage = (content: string, type: 'user-request' | 'gemini-response' | 'system') => {
    const message: ChatMessage = {
      type,
      content,
      timestamp: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  };

  const toggleViolation = (violation: Violation) => {
    dispatch({ type: 'TOGGLE_VIOLATION', payload: violation });
  };

  // Load session state on mount if project ID exists
  useEffect(() => {
    loadSessionState();
  }, [state.projectId]);

  const contextValue: AppContextType = {
    state,
    dispatch,
    uploadCppFile,
    uploadExcelFile,
    initializeGeminiChat,
    fixViolations,
    applyFixes,
    denumberFile,
    addChatMessage,
    toggleViolation,
    loadSessionState,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}