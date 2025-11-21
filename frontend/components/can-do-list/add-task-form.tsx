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
  readonly onSubmit: (values: { content: string; duration?: number; projectId?: string; impact?: number; urgency?: number; dueDate?: Date; myDay?: boolean }) => Promise<void>;
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
    let duration: number | undefined;
    let impact: number | undefined;
    let urgency: number | undefined;
    let dueDate: Date | undefined;
    
    // Extract tag information and only add custom tags back to content
    tags.forEach(tag => {
      if (tag.type === 'project') {
        selectedProjectId = tag.projectId;
        // Don't add project tags to content as they're handled separately
      } else if (tag.type === 'my-day') {
        isMyDay = tag.myDay || false;
        // Don't add my-day tags to content as they're handled separately
      } else if (tag.type === 'duration') {
        duration = tag.duration;
        // Don't add duration tags to content as they're handled separately
      } else if (tag.type === 'priority') {
        impact = tag.impact;
        urgency = tag.urgency;
        // Don't add priority tags to content as they're handled separately
      } else if (tag.type === 'due-date') {
        dueDate = tag.dueDate;
        // Don't add due date tags to content as they're handled separately
      } else {
        // Only custom tags get added back to content
        submissionContent += ` ${tag.text}`;
      }
    });
    
    await onSubmit({ 
      content: submissionContent, 
      duration,
      projectId: selectedProjectId, 
      impact,
      urgency,
      dueDate,
      myDay: isMyDay 
    });
    
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
