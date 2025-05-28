'use client';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useProjects } from '@/hooks/can-do-list/can-do-projects/useProjects';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseDurationFromContent } from '@/utils/can-do-list/duration-parser';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');

  // Use the main can-do list hook
  const {
    items,
    isLoading: isLoadingItems,
    loadItems,
    handleAddItem,
    handleUpdateItem,
    handleToggleComplete,
    handleDeleteItem,
    handleBulkDeleteCompleted
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

  // Filter items based on selected project and tab
  const filteredItems = useMemo(() => {
    let baseItems;
    if (selectedProjectId) {
      baseItems = items.filter(item => item.projectId === selectedProjectId);
    } else {
      // Show items without project (inbox)
      baseItems = items.filter(item => !item.projectId);
    }
    
    // Filter by tab
    return baseItems.filter(item => {
      if (activeTab === 'active') {
        return !item.completed;
      } else {
        return item.completed;
      }
    });
  }, [items, selectedProjectId, activeTab]);

  // Get active and completed counts for current project
  const { activeCount, completedCount } = useMemo(() => {
    let baseItems;
    if (selectedProjectId) {
      baseItems = items.filter(item => item.projectId === selectedProjectId);
    } else {
      baseItems = items.filter(item => !item.projectId);
    }
    
    const active = baseItems.filter(item => !item.completed).length;
    const completed = baseItems.filter(item => item.completed).length;
    
    return { activeCount: active, completedCount: completed };
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

  // Handle bulk delete completed items
  const handleBulkDelete = async () => {
    const deletedCount = await handleBulkDeleteCompleted(selectedProjectId);
    if (deletedCount > 0) {
      // If we deleted items and are on completed tab, stay on the tab
      // The items will automatically be removed from the view
    }
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
              
              <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    Active
                    {activeCount > 0 && (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
                        {activeCount}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="flex items-center gap-2">
                    Completed
                    {completedCount > 0 && (
                      <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs">
                        {completedCount}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
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
                </TabsContent>

                <TabsContent value="completed" className="mt-0">
                  <div className="mb-4 flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">
                      {completedCount} completed {completedCount === 1 ? 'item' : 'items'}
                    </p>
                    {completedCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={isLoading}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Completed
                      </Button>
                    )}
                  </div>
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
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
