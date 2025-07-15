import React, { useState } from 'react';
import { Check, AlertTriangle, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext, type Violation } from '@/context/AppContext';

export default function ViolationsPanel() {
  const { state, dispatch, toggleViolation } = useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterRule, setFilterRule] = useState('all');

  const filteredViolations = state.violations.filter(violation => {
    const matchesSearch = 
      violation.warning.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.misra.toLowerCase().includes(searchTerm.toLowerCase()) ||
      violation.line.toString().includes(searchTerm);
    
    const matchesLevel = filterLevel === 'all' || violation.level === filterLevel;
    const matchesRule = filterRule === 'all' || violation.misra === filterRule;
    
    return matchesSearch && matchesLevel && matchesRule;
  });

  const uniqueLevels = [...new Set(state.violations.map(v => v.level))];
  const uniqueRules = [...new Set(state.violations.map(v => v.misra))];

  const handleSelectAll = () => {
    const allSelected = filteredViolations.every(v => 
      state.selectedViolations.some(sv => 
        `${sv.file}-${sv.line}-${sv.misra}` === `${v.file}-${v.line}-${v.misra}`
      )
    );

    if (allSelected) {
      // Deselect all filtered violations
      filteredViolations.forEach(toggleViolation);
    } else {
      // Select all filtered violations that aren't already selected
      filteredViolations.forEach(violation => {
        const isSelected = state.selectedViolations.some(sv => 
          `${sv.file}-${sv.line}-${sv.misra}` === `${violation.file}-${violation.line}-${violation.misra}`
        );
        if (!isSelected) {
          toggleViolation(violation);
        }
      });
    }
  };

  const isViolationSelected = (violation: Violation) => {
    return state.selectedViolations.some(sv => 
      `${sv.file}-${sv.line}-${sv.misra}` === `${violation.file}-${violation.line}-${violation.misra}`
    );
  };

  const getSeverityColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
      case 'required':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
      case 'advisory':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (state.violations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertTriangle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Violations Found</h3>
          <p className="text-muted-foreground text-center">
            Upload a MISRA report to see violations that need fixing.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>MISRA Violations</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {state.selectedViolations.length} of {state.violations.length} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
            >
              {filteredViolations.every(v => isViolationSelected(v)) ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </div>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search violations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={filterLevel} onValueChange={setFilterLevel}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              {uniqueLevels.map(level => (
                <SelectItem key={level} value={level}>{level}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterRule} onValueChange={setFilterRule}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by rule" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Rules</SelectItem>
              {uniqueRules.map(rule => (
                <SelectItem key={rule} value={rule}>{rule}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-3">
            {filteredViolations.map((violation, index) => {
              const isSelected = isViolationSelected(violation);
              const violationKey = `${violation.file}-${violation.line}-${violation.misra}`;
              
              return (
                <div
                  key={`${violationKey}-${index}`}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => toggleViolation(violation)}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleViolation(violation)}
                      className="mt-1"
                    />
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-xs ${getSeverityColor(violation.level)}`}
                        >
                          {violation.level}
                        </Badge>
                        
                        <Badge variant="secondary" className="text-xs">
                          {violation.misra}
                        </Badge>
                        
                        <Badge variant="outline" className="text-xs">
                          Line {violation.line}
                        </Badge>
                      </div>
                      
                      <p className="text-sm font-medium">
                        {violation.warning}
                      </p>
                      
                      <div className="text-xs text-muted-foreground">
                        <p>File: {violation.file}</p>
                        {violation.path && <p>Path: {violation.path}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {filteredViolations.length === 0 && searchTerm && (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No violations match your search criteria.</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}