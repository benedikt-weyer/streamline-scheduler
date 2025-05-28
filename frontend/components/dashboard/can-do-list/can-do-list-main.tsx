'use client';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useProjects } from '@/hooks/can-do-list/useProjects';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseDurationFromContent } from '@/utils/can-do-list/duration-parser';

import ErrorDisplay from './error-display';
import AddItemForm from './add-item-form';
import LoadingState from './loading-state';
import EmptyState from './empty-state';
import ItemList from './item-list';
import AuthenticationRequired from './authentication-required';
import ProjectSidebarDynamic from './project-bar/project-sidebar-dynamic';

// Define schema for new item validation
const addItemSchema = z.object({
  content: z.string().min(1, { message: "Item content is required" }),
});

type AddItemFormValues = {
  content: string;
};

export default function CanDoListMain() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error } = useError();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);

  // Use the main can-do list hook
  const {
    items,
    isLoading: isLoadingItems,
    loadItems,
    handleAddItem,
    handleUpdateItem,
    handleToggleComplete,
    handleDeleteItem
  } = useCanDoList(encryptionKey);

  // Use projects hook
  const {
    projects,
    isLoading: isLoadingProjects,
    loadProjects,
    handleAddProject,
    handleUpdateProject,
    handleDeleteProject,
    handleBulkReorderProjects,
    handleUpdateProjectCollapsedState
  } = useProjects(encryptionKey);

  const isLoading = isLoadingItems || isLoadingProjects;

  // Initialize form with react-hook-form and zod validation
  const form = useForm<{ content: string }>({
    resolver: zodResolver(addItemSchema),
    defaultValues: {
      content: ''
    }
  });

  // Load items and projects when encryption key becomes available
  useEffect(() => {
    console.log('[CanDoListMain] useEffect triggered with encryptionKey:', !!encryptionKey);
    if (encryptionKey) {
      console.log('[CanDoListMain] Loading projects and items...');
      loadProjects(encryptionKey);
      // Always load all items for count calculations
      loadItems(encryptionKey);
    }
  }, [encryptionKey, loadItems, loadProjects]);

  // Debug projects state
  useEffect(() => {
    console.log('[CanDoListMain] Projects state updated:', projects.length, projects.map(p => p.name));
  }, [projects]);

  // Handle project selection
  const handleProjectSelect = (projectId?: string) => {
    setSelectedProjectId(projectId);
  };

  // Filter items based on selected project
  const filteredItems = useMemo(() => {
    if (selectedProjectId) {
      return items.filter(item => item.projectId === selectedProjectId);
    } else {
      // Show items without project (inbox)
      return items.filter(item => !item.projectId);
    }
  }, [items, selectedProjectId]);

  // Calculate item counts per project
  const itemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count inbox items (items without project)
    counts['inbox'] = items.filter(item => !item.projectId).length;
    
    // Count items per project
    projects.forEach(project => {
      counts[project.id] = items.filter(item => item.projectId === project.id).length;
    });
    
    return counts;
  }, [items, projects]);

  // Add a new item using react-hook-form
  const onSubmit = async (values: AddItemFormValues) => {
    // Parse duration hashtags from content
    const parsed = parseDurationFromContent(values.content);
    const success = await handleAddItem(parsed.content, parsed.duration, selectedProjectId);
    if (success) {
      form.reset();
    }
  };

  // Handle update action
  const onUpdateItem = async (id: string, content: string, estimatedDuration?: number, projectId?: string) => {
    await handleUpdateItem(id, content, estimatedDuration, projectId);
  };

  // Handle toggle complete action
  const onToggleComplete = async (id: string, completed: boolean) => {
    await handleToggleComplete(id, completed);
  };

  // Handle delete action
  const onDeleteItem = async (id: string) => {
    await handleDeleteItem(id);
  };

  return (
    <>
      <AuthenticationRequired 
        isLoadingKey={isLoadingKey} 
        encryptionKey={encryptionKey} 
      />
      
      {(encryptionKey || isLoadingKey) && (
        <div className="flex h-screen w-full">
          <ProjectSidebarDynamic
            projects={projects}
            selectedProjectId={selectedProjectId}
            onProjectSelect={handleProjectSelect}
            onAddProject={handleAddProject}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onBulkReorderProjects={handleBulkReorderProjects}
            onUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
            isLoading={isLoading}
            itemCounts={itemCounts}
          />
          
          <div className="flex-1 overflow-hidden">
            <div className="max-w-2xl mx-auto p-4 h-full overflow-y-auto">
              <h1 className="text-2xl font-bold mb-2">
                {selectedProjectId 
                  ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Project'
                  : 'Inbox'
                }
              </h1>
              <ErrorDisplay error={error} />
              <AddItemForm 
                form={form} 
                onSubmit={onSubmit} 
                isLoading={isLoading} 
              />
              <LoadingState isLoading={isLoading} />
              <EmptyState isLoading={isLoading} itemsLength={filteredItems.length} />
              <ItemList 
                items={filteredItems}
                isLoading={isLoading}
                onToggleComplete={onToggleComplete}
                onDeleteItem={onDeleteItem}
                onUpdateItem={onUpdateItem}
                projects={projects}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
