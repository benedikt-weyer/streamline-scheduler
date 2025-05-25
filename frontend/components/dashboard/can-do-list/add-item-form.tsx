'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { useState, useRef } from 'react';
import { X } from 'lucide-react';

interface DurationTag {
  id: string;
  text: string;
  duration: number; // in minutes
}

interface AddItemFormValues {
  content: string;
}

interface AddItemFormProps {
  readonly form: UseFormReturn<{ content: string }>;
  readonly onSubmit: (values: { content: string }) => Promise<void>;
  readonly isLoading: boolean;
}

export default function AddItemForm({ form, onSubmit, isLoading }: AddItemFormProps) {
  const [tags, setTags] = useState<DurationTag[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Parse time string to minutes (extracted from duration-parser.ts)
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
    if (e.key === ' ') {
      const currentValue = form.getValues('content');
      const cursorPosition = inputRef.current?.selectionStart ?? 0;
      
      // Get the word before the cursor
      const textBeforeCursor = currentValue.slice(0, cursorPosition);
      const words = textBeforeCursor.split(' ');
      const lastWord = words[words.length - 1];
      
      // Check if the last word is a duration hashtag
      const parsedTag = parseDurationTag(lastWord);
      if (parsedTag) {
        e.preventDefault();
        
        // Create a new tag
        const newTag: DurationTag = {
          id: Date.now().toString(),
          text: lastWord,
          duration: parsedTag.duration
        };
        
        // Update tags state - override existing duration tag
        setTags(prev => {
          // Remove any existing duration tags and add the new one
          const filteredTags = prev.filter(tag => !tag.text.startsWith('#d'));
          return [...filteredTags, newTag];
        });
        
        // Remove the hashtag from the input and add a space
        const newValue = currentValue.slice(0, cursorPosition - lastWord.length) + 
                        currentValue.slice(cursorPosition) + ' ';
        form.setValue('content', newValue.trim());
        
        // Focus the input and set cursor position
        setTimeout(() => {
          if (inputRef.current) {
            const newCursorPos = cursorPosition - lastWord.length + 1;
            inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
            inputRef.current.focus();
          }
        }, 0);
      }
    }
  };

  const removeTag = (tagId: string) => {
    setTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const handleSubmit = async (values: AddItemFormValues) => {
    // Combine content with tags for submission
    let submissionContent = values.content.trim();
    
    // Add tag information back as hashtags for the backend
    tags.forEach(tag => {
      submissionContent += ` ${tag.text}`;
    });
    
    await onSubmit({ content: submissionContent });
    
    // Clear tags after successful submission
    setTags([]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 mb-6">
        {/* Input and submit button */}
        <div className="flex gap-2">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormControl>
                  <Input
                    {...field}
                    ref={inputRef}
                    placeholder="Add a new item... (use #d15m for duration)"
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading}>
            Add
          </Button>
        </div>
        
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
                  ⏱ {tag.duration}m
                  <button
                    type="button"
                    onClick={() => removeTag(tag.id)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    disabled={isLoading}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </form>
    </Form>
  );
}
