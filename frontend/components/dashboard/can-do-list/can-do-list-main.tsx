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
import { parsePriorityFromContent } from '@/utils/can-do-list/priority-utils';
import { parseDueDateFromContent } from '@/utils/can-do-list/due-date-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

import ErrorDisplay from './error-display';
import AddTaskForm from './add-task-form';
import LoadingState from './loading-state';
import EmptyState from './empty-state';
import TaskList from './task-list';
import RecommendedTaskList from './recommended-task-list';
import AuthenticationRequired from './authentication-required';
import ProjectSidebarDynamic from './project-bar/project-sidebar-dynamic';
import ProjectSelectorMobile from './project-selector-mobile';

// Define schema for new task validation
const addTaskSchema = z.object({
  content: z.string().min(1, { message: "Task content is required" }),
});

type AddTaskFormValues = {
  content: string;
};

export default function CanDoListMain() {
  const { encryptionKey, isLoading: isLoadingKey } = useEncryptionKey();
  const { error } = useError();
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [isRecommendedSelected, setIsRecommendedSelected] = useState(false);

  // Use the main can-do list hook
  const {
    tasks,
    isLoading: isLoadingTasks,
    loadTasks,
    handleAddTask,
    handleUpdateTask,
    handleToggleComplete,
    handleDeleteTask,
    handleBulkDeleteCompleted,
    handleReorderTasks
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

  const isLoading = isLoadingTasks || isLoadingProjects;

  // Initialize form with react-hook-form and zod validation
  const form = useForm<{ content: string }>({
    resolver: zodResolver(addTaskSchema),
    defaultValues: {
      content: ''
    }
  });

  // Load tasks and projects when encryption key becomes available
  useEffect(() => {
    console.log('[CanDoListMain] useEffect triggered with encryptionKey:', !!encryptionKey);
    if (encryptionKey) {
      console.log('[CanDoListMain] Loading projects and tasks...');
      loadProjects(encryptionKey);
      // Always load all tasks for count calculations
      loadTasks(encryptionKey);
    }
  }, [encryptionKey, loadTasks, loadProjects]);

  // Debug projects state
  useEffect(() => {
    console.log('[CanDoListMain] Projects state updated:', projects.length, projects.map(p => p.name));
  }, [projects]);

  // Handle project selection
  const handleProjectSelect = (projectId?: string) => {
    setSelectedProjectId(projectId);
    setIsRecommendedSelected(false);
  };

  // Handle recommended tasks selection
  const handleRecommendedSelect = () => {
    setIsRecommendedSelected(true);
    setSelectedProjectId(undefined);
    setActiveTab('active'); // Recommended tasks are always active
  };

  // Filter tasks based on selected project and tab
  const filteredTasks = useMemo(() => {
    let baseTasks;
    if (selectedProjectId) {
      baseTasks = tasks.filter(task => task.projectId === selectedProjectId);
    } else {
      // Show tasks without project (inbox)
      baseTasks = tasks.filter(task => !task.projectId);
    }
    
    // Filter by tab
    return baseTasks.filter(task => {
      if (activeTab === 'active') {
        return !task.completed;
      } else {
        return task.completed;
      }
    });
  }, [tasks, selectedProjectId, activeTab]);

  // Get active and completed counts for current project
  const { activeCount, completedCount } = useMemo(() => {
    let baseTasks;
    if (selectedProjectId) {
      baseTasks = tasks.filter(task => task.projectId === selectedProjectId);
    } else {
      baseTasks = tasks.filter(task => !task.projectId);
    }
    
    const active = baseTasks.filter(task => !task.completed).length;
    const completed = baseTasks.filter(task => task.completed).length;
    
    return { activeCount: active, completedCount: completed };
  }, [tasks, selectedProjectId]);

  // Calculate task counts per project
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count inbox tasks (tasks without project)
    counts['inbox'] = tasks.filter(task => !task.projectId).length;
    
    // Count tasks per project
    projects.forEach(project => {
      counts[project.id] = tasks.filter(task => task.projectId === project.id).length;
    });
    
    return counts;
  }, [tasks, projects]);

  // Add a new task using react-hook-form
  const onSubmit = async (values: AddTaskFormValues) => {
    // Parse duration hashtags from content
    const parsedDuration = parseDurationFromContent(values.content);
    // Parse priority hashtags from content  
    const parsedPriority = parsePriorityFromContent(parsedDuration.content);
    // Parse due date hashtags from content
    const parsedDueDate = parseDueDateFromContent(parsedPriority.content);
    
    const success = await handleAddTask(
      parsedDueDate.content, 
      parsedDuration.duration, 
      selectedProjectId,
      parsedPriority.importance,
      parsedPriority.urgency,
      parsedDueDate.dueDate
    );
    if (success) {
      form.reset();
    }
  };

  // Handle update action
  const onUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, importance?: number, urgency?: number, dueDate?: Date) => {
    await handleUpdateTask(id, content, estimatedDuration, projectId, importance, urgency, dueDate);
  };

  // Handle toggle complete action
  const onToggleComplete = async (id: string, completed: boolean) => {
    await handleToggleComplete(id, completed);
  };

  // Handle delete action
  const onDeleteTask = async (id: string) => {
    await handleDeleteTask(id);
  };

  // Handle bulk delete completed tasks
  const handleBulkDelete = async () => {
    const deletedCount = await handleBulkDeleteCompleted(selectedProjectId);
    if (deletedCount > 0) {
      // If we deleted tasks and are on completed tab, stay on the tab
      // The tasks will automatically be removed from the view
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
          {/* Mobile Layout */}
          <div className="md:hidden w-full flex flex-col">
            {/* Mobile Header */}
            <div className="border-b p-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">
                {isRecommendedSelected 
                  ? 'Recommended Tasks'
                  : selectedProjectId 
                    ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Project'
                    : 'Inbox'
                }
              </h1>
              <ProjectSelectorMobile
                projects={projects}
                tasks={tasks}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectSelect}
                onRecommendedSelect={handleRecommendedSelect}
                taskCounts={taskCounts}
                isRecommendedSelected={isRecommendedSelected}
              />
            </div>

            {/* Mobile Task List */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto p-4">
                <ErrorDisplay error={error} />
                
                {isRecommendedSelected ? (
                  // Show recommended tasks view on mobile
                  <RecommendedTaskList
                    tasks={tasks}
                    projects={projects}
                    isLoading={isLoading}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                  />
                ) : (
                  // Show regular project/inbox view on mobile
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
                    <AddTaskForm 
                      form={form} 
                      onSubmit={onSubmit} 
                      isLoading={isLoading} 
                    />
                    <LoadingState isLoading={isLoading} />
                    <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                    <TaskList 
                      tasks={filteredTasks}
                      isLoading={isLoading}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onUpdateTask={onUpdateTask}
                      onReorderTasks={handleReorderTasks}
                      projects={projects}
                      currentProjectId={selectedProjectId}
                    />
                  </TabsContent>

                  <TabsContent value="completed" className="mt-0">
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {completedCount} completed {completedCount === 1 ? 'task' : 'tasks'}
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
                          Delete All
                        </Button>
                      )}
                    </div>
                    <LoadingState isLoading={isLoading} />
                    <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                    <TaskList 
                      tasks={filteredTasks}
                      isLoading={isLoading}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onUpdateTask={onUpdateTask}
                      onReorderTasks={handleReorderTasks}
                      projects={projects}
                      currentProjectId={selectedProjectId}
                    />
                  </TabsContent>
                </Tabs>
                )}
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex h-screen w-full">
            <div className="w-1/4 lg:w-1/5">
              <ProjectSidebarDynamic
                projects={projects}
                tasks={tasks}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectSelect}
                onRecommendedSelect={handleRecommendedSelect}
                onAddProject={handleAddProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onBulkReorderProjects={handleBulkReorderProjects}
                onUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
                isLoading={isLoading}
                itemCounts={taskCounts}
                isRecommendedSelected={isRecommendedSelected}
              />
            </div>

            <div className="flex-1 overflow-hidden">
              <div className="max-w-3xl mx-auto p-6 h-full overflow-y-auto">
                <h1 className="text-2xl font-bold mb-2">
                  {isRecommendedSelected 
                    ? 'Recommended Tasks'
                    : selectedProjectId 
                      ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Project'
                      : 'Inbox'
                  }
                </h1>
                <ErrorDisplay error={error} />
                
                {isRecommendedSelected ? (
                  // Show recommended tasks view
                  <RecommendedTaskList
                    tasks={tasks}
                    projects={projects}
                    isLoading={isLoading}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                  />
                ) : (
                  // Show regular project/inbox view
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
                    <AddTaskForm 
                      form={form} 
                      onSubmit={onSubmit} 
                      isLoading={isLoading} 
                    />
                    <LoadingState isLoading={isLoading} />
                    <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                    <TaskList 
                      tasks={filteredTasks}
                      isLoading={isLoading}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onUpdateTask={onUpdateTask}
                      onReorderTasks={handleReorderTasks}
                      projects={projects}
                      currentProjectId={selectedProjectId}
                    />
                  </TabsContent>

                  <TabsContent value="completed" className="mt-0">
                    <div className="mb-4 flex justify-between items-center">
                      <p className="text-sm text-muted-foreground">
                        {completedCount} completed {completedCount === 1 ? 'task' : 'tasks'}
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
                    <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                    <TaskList 
                      tasks={filteredTasks}
                      isLoading={isLoading}
                      onToggleComplete={onToggleComplete}
                      onDeleteTask={onDeleteTask}
                      onUpdateTask={onUpdateTask}
                      onReorderTasks={handleReorderTasks}
                      projects={projects}
                      currentProjectId={selectedProjectId}
                    />
                  </TabsContent>
                </Tabs>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
