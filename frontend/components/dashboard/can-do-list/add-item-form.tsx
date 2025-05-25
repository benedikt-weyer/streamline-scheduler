'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { UseFormReturn } from 'react-hook-form';

interface AddItemFormValues {
  content: string;
  estimatedDuration?: string;
}

interface AddItemFormProps {
  readonly form: UseFormReturn<{ content: string; estimatedDuration?: string }>; // ensure estimatedDuration is string
  readonly onSubmit: (values: { content: string; estimatedDuration?: string }) => Promise<void>;
  readonly isLoading: boolean;
}

export default function AddItemForm({ form, onSubmit, isLoading }: AddItemFormProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex gap-2 mb-6">
        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem className="flex-grow">
              <FormControl>
                <Input
                  placeholder="Add a new item..."
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="estimatedDuration"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  placeholder="min"
                  className="w-20"
                  {...field}
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isLoading}>
          Add
        </Button>
      </form>
    </Form>
  );
}
