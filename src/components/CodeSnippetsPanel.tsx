import React, { useState } from 'react';
import { Check, X, Code, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppContext } from '@/context/AppContext';
import { useToast } from '@/hooks/use-toast';

export default function CodeSnippetsPanel() {
  const { state, dispatch } = useAppContext();
  const { toast } = useToast();
  const [expandedSnippets, setExpandedSnippets] = useState<Set<string>>(new Set());

  const toggleSnippet = (lineNumber: string) => {
    const newExpanded = new Set(expandedSnippets);
    if (newExpanded.has(lineNumber)) {
      newExpanded.delete(lineNumber);
    } else {
      newExpanded.add(lineNumber);
    }
    setExpandedSnippets(newExpanded);
  };

  const toggleSnippetSelection = (lineNumber: string) => {
    const updatedSnippets = state.fixedSnippets.map(snippet => 
      snippet.lineNumber === lineNumber 
        ? { ...snippet, applied: snippet.applied !== false }
        : snippet
    );
    dispatch({ type: 'SET_FIXED_SNIPPETS', payload: updatedSnippets });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast({
        title: "Copied",
        description: "Code snippet copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const expandAll = () => {
    setExpandedSnippets(new Set(state.fixedSnippets.map(s => s.lineNumber)));
  };

  const collapseAll = () => {
    setExpandedSnippets(new Set());
  };

  const selectAll = () => {
    const updatedSnippets = state.fixedSnippets.map(snippet => ({
      ...snippet,
      applied: true
    }));
    dispatch({ type: 'SET_FIXED_SNIPPETS', payload: updatedSnippets });
  };

  const deselectAll = () => {
    const updatedSnippets = state.fixedSnippets.map(snippet => ({
      ...snippet,
      applied: false
    }));
    dispatch({ type: 'SET_FIXED_SNIPPETS', payload: updatedSnippets });
  };

  const selectedCount = state.fixedSnippets.filter(s => s.applied !== false).length;

  if (state.fixedSnippets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Code className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Code Snippets</h3>
          <p className="text-muted-foreground text-center">
            Generate fixes for MISRA violations to see code snippets here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Fixed Code Snippets</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {selectedCount} of {state.fixedSnippets.length} selected
            </Badge>
          </div>
        </div>
        
        <div className="flex items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={expandAll}
          >
            <Eye className="w-4 h-4 mr-1" />
            Expand All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={collapseAll}
          >
            <EyeOff className="w-4 h-4 mr-1" />
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={selectedCount === state.fixedSnippets.length ? deselectAll : selectAll}
          >
            <Check className="w-4 h-4 mr-1" />
            {selectedCount === state.fixedSnippets.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {state.fixedSnippets.map((snippet) => {
              const isExpanded = expandedSnippets.has(snippet.lineNumber);
              const isSelected = snippet.applied !== false;
              
              return (
                <Card key={snippet.lineNumber} className="border">
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={() => toggleSnippet(snippet.lineNumber)}
                  >
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSnippetSelection(snippet.lineNumber)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <Badge variant="outline" className="text-xs">
                                Line {snippet.lineNumber}
                              </Badge>
                              <p className="text-sm text-muted-foreground mt-1">
                                Click to {isExpanded ? 'collapse' : 'expand'} code
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(snippet.code);
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            
                            {isSelected ? (
                              <Badge variant="default" className="text-xs">
                                <Check className="w-3 h-3 mr-1" />
                                Selected
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <X className="w-3 h-3 mr-1" />
                                Excluded
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto">
                          <pre className="text-sm">
                            <code>{snippet.code}</code>
                          </pre>
                        </div>
                        
                        <div className="mt-3 flex items-center gap-2">
                          <Button
                            variant={isSelected ? "secondary" : "default"}
                            size="sm"
                            onClick={() => toggleSnippetSelection(snippet.lineNumber)}
                          >
                            {isSelected ? (
                              <>
                                <X className="w-4 h-4 mr-1" />
                                Exclude
                              </>
                            ) : (
                              <>
                                <Check className="w-4 h-4 mr-1" />
                                Include
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(snippet.code)}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}