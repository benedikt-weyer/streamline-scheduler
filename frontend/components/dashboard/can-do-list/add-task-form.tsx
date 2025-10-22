'use client';

import { Button } from '@/components/ui/button';
import { TaggedInput, Tag } from '@/components/ui/tagged-input';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';
import { useState } from 'react';

interface AddTaskFormValues {
  content: string;
}

interface AddTaskFormProps {
  readonly form: UseFormReturn<{ content: string }>;
  readonly onSubmit: (values: { content: string; projectId?: string; myDay?: boolean }) => Promise<void>;
  readonly isLoading: boolean;
  readonly projects?: { id: string; name: string; }[];
}

export default function AddTaskForm({ form, onSubmit, isLoading, projects = [] }: AddTaskFormProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  const handleSubmit = async (values: AddTaskFormValues) => {
    // Combine content with tags for submission
    let submissionContent = (values.content || '').trim();
    let selectedProjectId: string | undefined;
    let isMyDay: boolean = false;
    
    // Add tag information back as hashtags for the backend and extract project ID and My Day status
    tags.forEach(tag => {
      if (tag.type === 'project') {
        selectedProjectId = tag.projectId;
        // Don't add project tags to content as they're handled separately
      } else if (tag.type === 'my-day') {
        isMyDay = tag.myDay || false;
        // Don't add my-day tags to content as they're handled separately
      } else {
        submissionContent += ` ${tag.text}`;
      }
    });
    
    await onSubmit({ content: submissionContent, projectId: selectedProjectId, myDay: isMyDay });
    
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
                    placeholder="Add a new task... (type # to see options, #pro for projects, #day for My Day)"
                    disabled={isLoading}
                    tags={tags}
                    onTagsChange={setTags}
                    projects={projects}
                    autoComplete='off'
                    autoCapitalize='off'
                    autoCorrect='off'
                    spellCheck={false}
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
