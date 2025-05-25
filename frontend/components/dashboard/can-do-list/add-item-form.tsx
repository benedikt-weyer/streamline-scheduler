'use client';

import { Button } from '@/components/ui/button';
import { TaggedInput, Tag } from '@/components/ui/tagged-input';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { useState } from 'react';

interface AddItemFormValues {
  content: string;
}

interface AddItemFormProps {
  readonly form: UseFormReturn<{ content: string }>;
  readonly onSubmit: (values: { content: string }) => Promise<void>;
  readonly isLoading: boolean;
}

export default function AddItemForm({ form, onSubmit, isLoading }: AddItemFormProps) {
  const [tags, setTags] = useState<Tag[]>([]);

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
      <form onSubmit={form.handleSubmit(handleSubmit)} className="mb-6">
        <div className="flex gap-2 items-start">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormControl>
                  <TaggedInput
                    {...field}
                    placeholder="Add a new item... (use #d15m for duration)"
                    disabled={isLoading}
                    tags={tags}
                    onTagsChange={setTags}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading} className="mt-0">
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
}
