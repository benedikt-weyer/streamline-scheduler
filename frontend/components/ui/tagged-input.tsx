'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
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
    ...props 
  }, ref) => {
    const [internalTags, setInternalTags] = useState<Tag[]>([]);
    const [internalValue, setInternalValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Use external state if provided, otherwise use internal state
    const tags = externalTags ?? internalTags;
    const inputValue = value ?? internalValue;

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Call external onKeyDown first if provided
      externalOnKeyDown?.(e);
      
      if (e.defaultPrevented) return;

      if (e.key === ' ') {
        const currentValue = inputValue;
        const cursorPosition = inputRef.current?.selectionStart ?? 0;
        
        // Get the word before the cursor
        const textBeforeCursor = currentValue.slice(0, cursorPosition);
        const words = textBeforeCursor.split(' ');
        const lastWord = words[words.length - 1];
        
        // Check if the last word contains a duration hashtag
        const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/i;
        const match = durationRegex.exec(lastWord);
        
        if (match) {
          const hashtagText = match[0]; // The full hashtag match (e.g., "#d15m")
          const parsedTag = parseDurationTag(hashtagText);
          
          if (parsedTag) {
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
          }
        }
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
      <div className={cn("space-y-3", className)}>
        {/* Input field */}
        <Input
          {...props}
          ref={inputRef}
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        
        {/* Tags display - reserved space at bottom */}
        <div className="min-h-[32px] pt-1">
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag.id}
                  variant="secondary"
                  className="flex items-center gap-1 text-xs"
                >
                  {tag.type === 'duration' && '⏱ '}
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
      </div>
    );
  }
);

TaggedInput.displayName = 'TaggedInput';
