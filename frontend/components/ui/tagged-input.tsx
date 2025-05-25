'use client';

import { useState, useRef, forwardRef, useImperativeHandle, useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Clock, Info } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';

export interface Tag {
  id: string;
  text: string;
  duration?: number; // in minutes, for duration tags
  type: 'duration' | 'custom'; // extensible for different tag types
}

interface TaggedInputProps {
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  onTagsChange?: (tags: Tag[]) => void;
  tags?: Tag[];
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  availableTagSuggestions?: TagSuggestion[];
  autoComplete?: string;
  autoCorrect?: 'on' | 'off';
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  spellCheck?: boolean;
}

export interface TagSuggestion {
  id: string;
  text: string;
  description?: string;
  type: 'duration' | 'custom';
  duration?: number; // for duration suggestions
}

export interface TaggedInputRef {
  focus: () => void;
  getValue: () => string;
  setValue: (value: string) => void;
  getTags: () => Tag[];
  setTags: (tags: Tag[]) => void;
  clearTags: () => void;
}

export const TaggedInput = forwardRef<TaggedInputRef, TaggedInputProps>(
  ({ 
    placeholder, 
    disabled, 
    className, 
    value, 
    onChange, 
    onTagsChange,
    tags: externalTags,
    onKeyDown: externalOnKeyDown,
    availableTagSuggestions = [],
    ...props 
  }, ref) => {
    const [internalTags, setInternalTags] = useState<Tag[]>([]);
    const [internalValue, setInternalValue] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<TagSuggestion[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Use ref to track previous availableTagSuggestions to prevent unnecessary re-renders
    const prevAvailableTagSuggestionsRef = useRef<TagSuggestion[]>([]);
    const allSuggestionsRef = useRef<TagSuggestion[]>([]);

    // Use external state if provided, otherwise use internal state
    const tags = externalTags ?? internalTags;
    const inputValue = value ?? internalValue;

    // Default tag suggestions - common duration tags and overview - memoized to prevent re-renders
    const defaultSuggestions: TagSuggestion[] = useMemo(() => [
      // Overview/help suggestions
      { id: 'help-duration', text: '#d...', description: 'Duration tags - #d15m, #d1h, #d2h30m', type: 'custom' },
      { id: 'help-custom', text: '#...', description: 'Custom tags - #urgent, #meeting, #personal', type: 'custom' },
      
      // Common duration tags
      { id: 'duration-15m', text: '#d15m', description: '15 minutes', type: 'duration', duration: 15 },
      { id: 'duration-30m', text: '#d30m', description: '30 minutes', type: 'duration', duration: 30 },
      { id: 'duration-1h', text: '#d1h', description: '1 hour', type: 'duration', duration: 60 },
      { id: 'duration-1h30m', text: '#d1h30m', description: '1 hour 30 minutes', type: 'duration', duration: 90 },
      { id: 'duration-2h', text: '#d2h', description: '2 hours', type: 'duration', duration: 120 },
      { id: 'duration-3h', text: '#d3h', description: '3 hours', type: 'duration', duration: 180 },
    ], []);

    // Update allSuggestionsRef when needed to avoid infinite re-renders
    // Always ensure the ref has the current suggestions
    const currentSuggestionsKey = JSON.stringify(availableTagSuggestions);
    const prevSuggestionsKey = JSON.stringify(prevAvailableTagSuggestionsRef.current);
    
    if (prevSuggestionsKey !== currentSuggestionsKey || allSuggestionsRef.current.length === 0) {
      prevAvailableTagSuggestionsRef.current = availableTagSuggestions;
      allSuggestionsRef.current = [...defaultSuggestions, ...availableTagSuggestions];
    }

    // Update dropdown state when input changes
    useEffect(() => {
      if (!inputValue || disabled) {
        setShowDropdown(false);
        setFilteredSuggestions([]);
        setSelectedSuggestionIndex(-1);
        return;
      }
      
      const cursorPosition = inputRef.current?.selectionStart ?? inputValue.length;
      const textBeforeCursor = inputValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      const shouldShow = lastWord.startsWith('#') && lastWord.length >= 1;
      
      if (!shouldShow) {
        setShowDropdown(false);
        setFilteredSuggestions([]);
        setSelectedSuggestionIndex(-1);
        return;
      }
      
      // Get current suggestions from ref to avoid stale closures
      const currentSuggestions = allSuggestionsRef.current;
      
      // If it's just a hashtag, show all suggestions (overview)
      if (lastWord === '#') {
        setShowDropdown(true);
        setFilteredSuggestions(currentSuggestions);
        setSelectedSuggestionIndex(-1);
        return;
      }
      
      // Filter suggestions based on what the user typed
      const filtered = currentSuggestions.filter(suggestion => 
        suggestion.text.toLowerCase().startsWith(lastWord.toLowerCase())
      );
      
      setShowDropdown(filtered.length > 0);
      setFilteredSuggestions(filtered);
      setSelectedSuggestionIndex(-1);
    }, [inputValue, disabled]); // Only depend on inputValue and disabled

    // Handle clicks outside dropdown to close it
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
            inputRef.current && !inputRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectSuggestion = (suggestion: TagSuggestion) => {
      // Don't select help/overview suggestions
      if (suggestion.id.startsWith('help-')) {
        return;
      }
      
      const cursorPosition = inputRef.current?.selectionStart ?? inputValue.length;
      const textBeforeCursor = inputValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      const afterCursor = inputValue.slice(cursorPosition);
      
      // Find the start position of the hashtag word
      const hashtagStartPos = cursorPosition - lastWord.length;
      const beforeHashtag = inputValue.slice(0, hashtagStartPos);
      
      // Remove the hashtag entirely and clean up spacing
      let newValue = beforeHashtag.trimEnd();
      if (afterCursor.trim()) {
        newValue += (newValue ? ' ' : '') + afterCursor.trimStart();
      }
      
      setValue(newValue);
      
      // Create the tag
      const newTag: Tag = {
        id: Date.now().toString(),
        text: suggestion.text,
        duration: suggestion.duration,
        type: suggestion.type
      };
      
      // Update tags state - override existing duration tag if it's a duration type
      setTags(prev => {
        if (suggestion.type === 'duration') {
          const filteredTags = prev.filter(tag => tag.type !== 'duration');
          return [...filteredTags, newTag];
        } else {
          return [...prev, newTag];
        }
      });
      
      setShowDropdown(false);
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = newValue.length - (afterCursor.trim() ? afterCursor.trimStart().length : 0);
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    };

    const setTags = (newTags: Tag[] | ((prev: Tag[]) => Tag[])) => {
      const updatedTags = typeof newTags === 'function' ? newTags(tags) : newTags;
      if (onTagsChange) {
        onTagsChange(updatedTags);
      } else {
        setInternalTags(updatedTags);
      }
    };

    const setValue = (newValue: string) => {
      if (onChange) {
        onChange(newValue);
      } else {
        setInternalValue(newValue);
      }
    };

    // Parse duration hashtags similar to the existing parser
    const parseDurationTag = (text: string): { duration: number; displayText: string } | null => {
      const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/i;
      const match = durationRegex.exec(text);
      
      if (!match) return null;
      
      const timeString = match[1];
      const duration = parseTimeString(timeString);
      
      if (duration === null) return null;
      
      return {
        duration,
        displayText: `${duration}m`
      };
    };

    // Parse time string to minutes
    const parseTimeString = (timeString: string): number | null => {
      // Handle pure minutes: "15" or "15m"
      const minutesOnlyRegex = /^(\d+)m?$/;
      const minutesOnlyMatch = minutesOnlyRegex.exec(timeString);
      if (minutesOnlyMatch) {
        return parseInt(minutesOnlyMatch[1], 10);
      }
      
      // Handle hours only: "1h"
      const hoursOnlyRegex = /^(\d+)h$/;
      const hoursOnlyMatch = hoursOnlyRegex.exec(timeString);
      if (hoursOnlyMatch) {
        return parseInt(hoursOnlyMatch[1], 10) * 60;
      }
      
      // Handle hours and minutes: "1h15m" or "1h15"
      const hoursMinutesRegex = /^(\d+)h(\d+)m?$/;
      const hoursMinutesMatch = hoursMinutesRegex.exec(timeString);
      if (hoursMinutesMatch) {
        const hours = parseInt(hoursMinutesMatch[1], 10);
        const minutes = parseInt(hoursMinutesMatch[2], 10);
        return hours * 60 + minutes;
      }
      
      return null;
    };

    const handleDropdownNavigation = (e: React.KeyboardEvent<HTMLInputElement>): boolean => {
      if (!showDropdown || filteredSuggestions.length === 0) return false;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => {
          let next = prev < filteredSuggestions.length - 1 ? prev + 1 : 0;
          // Skip help suggestions when navigating
          while (filteredSuggestions[next]?.id.startsWith('help-') && next !== prev) {
            next = next < filteredSuggestions.length - 1 ? next + 1 : 0;
          }
          return next;
        });
        return true;
      }
      
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => {
          let next = prev > 0 ? prev - 1 : filteredSuggestions.length - 1;
          // Skip help suggestions when navigating
          while (filteredSuggestions[next]?.id.startsWith('help-') && next !== prev) {
            next = next > 0 ? next - 1 : filteredSuggestions.length - 1;
          }
          return next;
        });
        return true;
      }
      
      if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault();
        selectSuggestion(filteredSuggestions[selectedSuggestionIndex]);
        return true;
      }
      
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        setSelectedSuggestionIndex(-1);
        return true;
      }

      return false;
    };

    const handleSpaceKeyForDurationTag = (e: React.KeyboardEvent<HTMLInputElement>): void => {
      const currentValue = inputValue;
      const cursorPosition = inputRef.current?.selectionStart ?? 0;
      
      // Get the word before the cursor
      const textBeforeCursor = currentValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      // Check if the last word contains a duration hashtag
      const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/i;
      const match = durationRegex.exec(lastWord);
      
      if (!match) return;

      const hashtagText = match[0]; // The full hashtag match (e.g., "#d15m")
      const parsedTag = parseDurationTag(hashtagText);
      
      if (!parsedTag) return;

      e.preventDefault();
      
      // Create a new tag
      const newTag: Tag = {
        id: Date.now().toString(),
        text: hashtagText,
        duration: parsedTag.duration,
        type: 'duration'
      };
      
      // Update tags state - override existing duration tag
      setTags(prev => {
        // Remove any existing duration tags and add the new one
        const filteredTags = prev.filter(tag => tag.type !== 'duration');
        return [...filteredTags, newTag];
      });
      
      // Remove only the hashtag portion from the input and add a space
      const hashtagStartPos = cursorPosition - lastWord.length + lastWord.indexOf(hashtagText);
      const beforeHashtag = currentValue.slice(0, hashtagStartPos);
      const afterCursor = currentValue.slice(cursorPosition);
      const newValue = beforeHashtag + ' ' + afterCursor;
      setValue(newValue);
      
      // Focus the input and set cursor position
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = hashtagStartPos + 1;
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
          inputRef.current.focus();
        }
      }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Call external onKeyDown first if provided
      externalOnKeyDown?.(e);
      
      if (e.defaultPrevented) return;

      // Handle dropdown navigation first
      if (handleDropdownNavigation(e)) return;

      // Handle space key for duration tags
      if (e.key === ' ') {
        handleSpaceKeyForDurationTag(e);
      }
    };

    const removeTag = (tagId: string) => {
      setTags(prev => prev.filter(tag => tag.id !== tagId));
    };

    // Expose methods through ref
    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      getValue: () => inputValue,
      setValue,
      getTags: () => tags,
      setTags: (newTags: Tag[]) => setTags(newTags),
      clearTags: () => setTags([])
    }));

    return (
      <div className={cn("relative", className)}>
        {/* Input field */}
        <Input
          {...props}
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
        
        {/* Dropdown suggestions */}
        {showDropdown && filteredSuggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 z-50 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto mt-1"
          >
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                className={cn(
                  "px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground flex items-center justify-between",
                  selectedSuggestionIndex === index && "bg-accent text-accent-foreground",
                  suggestion.id.startsWith('help-') && "bg-muted/50 cursor-default hover:bg-muted/50"
                )}
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="flex items-center gap-2">
                  {suggestion.id.startsWith('help-') && (
                    <Info className="h-3 w-3 text-muted-foreground" />
                  )}
                  {!suggestion.id.startsWith('help-') && suggestion.type === 'duration' && (
                    <Clock className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className={cn(
                    "font-mono text-sm",
                    suggestion.id.startsWith('help-') && "text-muted-foreground font-normal"
                  )}>
                    {suggestion.text}
                  </span>
                </div>
                {suggestion.description && (
                  <span className={cn(
                    "text-xs text-muted-foreground",
                    suggestion.id.startsWith('help-') && "font-medium"
                  )}>
                    {suggestion.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Tags display - reserved space at bottom */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {tags.map(tag => (
              <Badge
                key={tag.id}
                variant="secondary"
                className="flex items-center gap-1 text-xs"
              >
                {tag.type === 'duration' && <Clock className="h-3 w-3" />}
                {tag.type === 'duration' ? `${tag.duration}m` : tag.text}
                <button
                  type="button"
                  onClick={() => removeTag(tag.id)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    );
  }
);

TaggedInput.displayName = 'TaggedInput';
