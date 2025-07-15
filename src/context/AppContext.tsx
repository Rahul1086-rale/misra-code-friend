import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface ModelSettings {
  temperature: number;
  top_p: number;
  max_tokens: number;
  model_name: string;
  safety_settings: boolean;
}

export interface Violation {
  file: string;
  path: string;
  line: number;
  warning: string;
  level: string;
  misra: string;
  selected?: boolean;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface FixedSnippet {
  lineNumber: string;
  code: string;
  applied?: boolean;
}

export interface AppState {
  // Project info
  projectId: string | null;
  uploadedFile: {
    name: string;
    path: string;
  } | null;
  currentVersion: number;
  
  // Violations
  violations: Violation[];
  selectedViolations: Violation[];
  
  // Chat
  chatHistory: ChatMessage[];
  isLoading: boolean;
  
  // Fixed snippets
  fixedSnippets: FixedSnippet[];
  
  // Settings
  modelSettings: ModelSettings;
  
  // Session
  sessionId: string | null;
}

type AppAction =
  | { type: 'SET_PROJECT_ID'; payload: string }
  | { type: 'SET_UPLOADED_FILE'; payload: { name: string; path: string } }
  | { type: 'SET_VIOLATIONS'; payload: Violation[] }
  | { type: 'TOGGLE_VIOLATION'; payload: string } // violation key
  | { type: 'SET_SELECTED_VIOLATIONS'; payload: Violation[] }
  | { type: 'ADD_CHAT_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FIXED_SNIPPETS'; payload: FixedSnippet[] }
  | { type: 'UPDATE_MODEL_SETTINGS'; payload: Partial<ModelSettings> }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'INCREMENT_VERSION' }
  | { type: 'RESET_STATE' }
  | { type: 'LOAD_SESSION_STATE'; payload: Partial<AppState> };

const initialState: AppState = {
  projectId: null,
  uploadedFile: null,
  currentVersion: 0,
  violations: [],
  selectedViolations: [],
  chatHistory: [],
  isLoading: false,
  fixedSnippets: [],
  modelSettings: {
    temperature: 0.5,
    top_p: 0.95,
    max_tokens: 65535,
    model_name: 'gemini-1.5-flash',
    safety_settings: false,
  },
  sessionId: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PROJECT_ID':
      return { ...state, projectId: action.payload };
    
    case 'SET_UPLOADED_FILE':
      return { ...state, uploadedFile: action.payload };
    
    case 'SET_VIOLATIONS':
      return { ...state, violations: action.payload };
    
    case 'TOGGLE_VIOLATION':
      const violation = state.violations.find(v => 
        `${v.file}-${v.line}-${v.misra}` === action.payload
      );
      if (!violation) return state;
      
      const isSelected = state.selectedViolations.some(v => 
        `${v.file}-${v.line}-${v.misra}` === action.payload
      );
      
      return {
        ...state,
        selectedViolations: isSelected
          ? state.selectedViolations.filter(v => 
              `${v.file}-${v.line}-${v.misra}` !== action.payload
            )
          : [...state.selectedViolations, violation]
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
    
    case 'SET_FIXED_SNIPPETS':
      return { ...state, fixedSnippets: action.payload };
    
    case 'UPDATE_MODEL_SETTINGS':
      return { 
        ...state, 
        modelSettings: { ...state.modelSettings, ...action.payload }
      };
    
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    
    case 'INCREMENT_VERSION':
      return { ...state, currentVersion: state.currentVersion + 1 };
    
    case 'RESET_STATE':
      return initialState;
    
    case 'LOAD_SESSION_STATE':
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  addChatMessage: (content: string, type: 'user' | 'assistant' | 'system') => void;
  toggleViolation: (violation: Violation) => void;
  loadSessionState: () => Promise<void>;
  saveSessionState: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { toast } = useToast();

  const addChatMessage = (content: string, type: 'user' | 'assistant' | 'system') => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      type,
      content,
      timestamp: new Date(),
    };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: message });
  };

  const toggleViolation = (violation: Violation) => {
    const key = `${violation.file}-${violation.line}-${violation.misra}`;
    dispatch({ type: 'TOGGLE_VIOLATION', payload: key });
  };

  const loadSessionState = async () => {
    try {
      const response = await fetch('/api/session-state');
      if (response.ok) {
        const sessionState = await response.json();
        dispatch({ type: 'LOAD_SESSION_STATE', payload: sessionState });
      }
    } catch (error) {
      console.error('Failed to load session state:', error);
    }
  };

  const saveSessionState = async () => {
    try {
      await fetch('/api/session-state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
    } catch (error) {
      console.error('Failed to save session state:', error);
      toast({
        title: "Error",
        description: "Failed to save session state",
        variant: "destructive",
      });
    }
  };

  // Load session state on mount
  useEffect(() => {
    loadSessionState();
  }, []);

  // Save session state when it changes
  useEffect(() => {
    if (state.projectId) {
      saveSessionState();
    }
  }, [state]);

  const contextValue: AppContextType = {
    state,
    dispatch,
    addChatMessage,
    toggleViolation,
    loadSessionState,
    saveSessionState,
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