'use client';

import { useCanDoList } from '@/hooks/can-do-list/useCanDoList';
import { useProjects } from '@/hooks/can-do-list/can-do-projects/useProjects';
import { useEncryptionKey } from '@/hooks/cryptography/useEncryptionKey';
import { useError } from '@/utils/context/ErrorContext';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { parseDurationFromContent } from '@/utils/can-do-list/duration-parser';
import { parsePriorityFromContent } from '@/utils/can-do-list/priority-utils';
import { parseDueDateFromContent } from '@/utils/can-do-list/due-date-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Search, X } from 'lucide-react';
import { TaskSearchInput } from '@/components/dashboard/shared/task-search-input';
import { ScrollToTopButton } from '@/components/ui/scroll-to-top-button';
import Fuse from 'fuse.js';

import ErrorDisplay from './error-display';
import AddTaskForm from './add-task-form';
import LoadingState from './loading-state';
import EmptyState from './empty-state';
import TaskList from './task-list';
import RecommendedTaskList from './recommended-task-list';
import AuthenticationRequired from './authentication-required';
import ProjectSidebarDynamic from './project-bar/project-sidebar-dynamic';
import ProjectSelectorMobile from './project-selector-mobile';
import TaskListItem from './task-list-item';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';

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
  const [isAllTasksSelected, setIsAllTasksSelected] = useState(false);
  const [isMyDaySelected, setIsMyDaySelected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Refs for scroll containers
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const desktopScrollRef = useRef<HTMLDivElement>(null);

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
      loadProjects();
      // Always load all tasks for count calculations
      loadTasks();
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
    setIsAllTasksSelected(false);
    setIsMyDaySelected(false);
  };

  // Handle recommended tasks selection
  const handleRecommendedSelect = () => {
    setIsRecommendedSelected(true);
    setSelectedProjectId(undefined);
    setIsAllTasksSelected(false);
    setIsMyDaySelected(false);
    setActiveTab('active'); // Recommended tasks are always active
  };

  // Handle all tasks selection
  const handleAllTasksSelect = () => {
    setIsAllTasksSelected(true);
    setSelectedProjectId(undefined);
    setIsRecommendedSelected(false);
    setIsMyDaySelected(false);
  };

  // Handle My Day selection
  const handleMyDaySelect = () => {
    setIsMyDaySelected(true);
    setSelectedProjectId(undefined);
    setIsRecommendedSelected(false);
    setIsAllTasksSelected(false);
    setActiveTab('active'); // My Day tasks are always active
  };

  // Handle toggling My Day status for a task
  const handleToggleMyDay = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    
    const newMyDayStatus = !task.my_day;
    await handleUpdateTask(
      id, 
      task.content, 
      task.duration_minutes, 
      task.project_id, 
      undefined, // impact
      undefined, // urgency
      task.due_date ? new Date(task.due_date) : undefined, 
      task.blocked_by, 
      newMyDayStatus
    );
  };

  // Configure Fuse.js for fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'content', weight: 0.7 },
      { name: 'projectName', weight: 0.3 }
    ],
    threshold: 0.3, // Lower = more strict, higher = more fuzzy
    includeScore: true,
    minMatchCharLength: 1
  };

  // Filter tasks based on selected project, tab, and search query
  const filteredTasks = useMemo(() => {
    let baseTasks;
    if (isMyDaySelected) {
      // Show only My Day tasks
      baseTasks = tasks.filter(task => task.my_day);
    } else if (isAllTasksSelected) {
      // Show all tasks regardless of project
      baseTasks = tasks;
    } else if (selectedProjectId) {
      baseTasks = tasks.filter(task => task.project_id === selectedProjectId);
    } else {
      // Show tasks without project (inbox)
      baseTasks = tasks.filter(task => !task.project_id);
    }
    
    // Filter by tab
    const tabFilteredTasks = baseTasks.filter(task => {
      if (activeTab === 'active') {
        return !task.completed;
      } else {
        return task.completed;
      }
    });

    // Apply search filter if search query exists
    if (searchQuery.trim()) {
      // Add project names to tasks for search
      const searchableTasks = tabFilteredTasks.map(task => ({
        ...task,
        projectName: task.project_id 
          ? projects.find(p => p.id === task.project_id)?.name || ''
          : 'Inbox'
      }));

      const fuse = new Fuse(searchableTasks, fuseOptions);
      const searchResults = fuse.search(searchQuery.trim());
      return searchResults.map(result => result.item);
    }

    return tabFilteredTasks;
  }, [tasks, selectedProjectId, activeTab, isAllTasksSelected, isMyDaySelected, searchQuery, projects, isRecommendedSelected]);

  // Group tasks by project when in "All Tasks" mode
  const groupedTasks = useMemo(() => {
    if (!isAllTasksSelected) {
      return null; // Return null when not in "All Tasks" mode
    }

    // Helper function to build full project path
    const getProjectPath = (projectId: string): string => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return 'Unknown Project';
      
      if (!project.parent_id) {
        return project.name;
      }
      
      const parentPath = getProjectPath(project.parent_id);
      return `${parentPath} > ${project.name}`;
    };

    // Group filtered tasks by project
    const tasksByProject = new Map<string | undefined, CanDoItemDecrypted[]>();
    filteredTasks.forEach(task => {
      // Normalize null and undefined to be the same key for inbox tasks
      const projectId = task.project_id || undefined;
      if (!tasksByProject.has(projectId)) {
        tasksByProject.set(projectId, []);
      }
      tasksByProject.get(projectId)!.push(task);
    });

    // Create organized structure with project headers
    const organized: Array<{ type: 'project-header' | 'task'; data: ProjectDecrypted | CanDoItemDecrypted }> = [];

    // Add inbox section if there are inbox tasks
    const inboxTasks = tasksByProject.get(undefined) || [];
    if (inboxTasks.length > 0) {
      organized.push({ 
        type: 'project-header', 
        data: { id: 'inbox', name: 'Inbox', color: '#6b7280' } as ProjectDecrypted 
      });
      inboxTasks.forEach(task => organized.push({ type: 'task', data: task }));
    }

    // Add tasks grouped by projects with full paths
    projects
      .filter(project => tasksByProject.has(project.id))
      .sort((a, b) => getProjectPath(a.id).localeCompare(getProjectPath(b.id))) // Sort by full path
      .forEach(project => {
        const projectWithPath = {
          ...project,
          name: getProjectPath(project.id) // Override name with full path
        };
        organized.push({ type: 'project-header', data: projectWithPath });
        const projectTasks = tasksByProject.get(project.id) || [];
        projectTasks.forEach(task => organized.push({ type: 'task', data: task }));
      });

    return organized;
  }, [filteredTasks, projects, isAllTasksSelected]);

  // Get active and completed counts for current project
  const { activeCount, completedCount } = useMemo(() => {
    let baseTasks;
    if (isAllTasksSelected) {
      // Show all tasks regardless of project
      baseTasks = tasks;
    } else if (selectedProjectId) {
      baseTasks = tasks.filter(task => task.project_id === selectedProjectId);
    } else {
      baseTasks = tasks.filter(task => !task.project_id);
    }
    
    const active = baseTasks.filter(task => !task.completed).length;
    const completed = baseTasks.filter(task => task.completed).length;
    
    return { activeCount: active, completedCount: completed };
  }, [tasks, selectedProjectId, isAllTasksSelected]);

  // Calculate task counts per project
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Count inbox tasks (tasks without project) - only active tasks
    counts['inbox'] = tasks.filter(task => !task.project_id && !task.completed).length;
    
    // Count active tasks per project
    projects.forEach(project => {
      counts[project.id] = tasks.filter(task => task.project_id === project.id && !task.completed).length;
    });
    
    // Count all active tasks
    counts['all'] = tasks.filter(task => !task.completed).length;
    
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
      parsedPriority.impact,
      parsedPriority.urgency,
      parsedDueDate.dueDate
    );
    if (success) {
      form.reset();
    }
  };

  // Handle update action
  const onUpdateTask = async (id: string, content: string, estimatedDuration?: number, projectId?: string, impact?: number, urgency?: number, dueDate?: Date, blockedBy?: string, myDay?: boolean) => {
    await handleUpdateTask(id, content, estimatedDuration, projectId, impact, urgency, dueDate, blockedBy, myDay);
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
        <div className="fixed inset-0 top-16 flex w-full">
          {/* Mobile Layout */}
          <div className="md:hidden w-full flex flex-col">
            {/* Mobile Header */}
            <div className="border-b p-4 flex items-center justify-between">
              <h1 className="text-xl font-bold">
                {isMyDaySelected
                  ? 'My Day'
                  : isRecommendedSelected 
                    ? 'Recommended Tasks'
                    : isAllTasksSelected
                      ? 'All Tasks'
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
                onAllTasksSelect={handleAllTasksSelect}
                onMyDaySelect={handleMyDaySelect}
                taskCounts={taskCounts}
                isRecommendedSelected={isRecommendedSelected}
                isAllTasksSelected={isAllTasksSelected}
                isMyDaySelected={isMyDaySelected}
              />
            </div>

            {/* Mobile Task List */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="p-4 border-b bg-background relative z-10">
                <ErrorDisplay error={error} />
                
                {!isRecommendedSelected && (
                  // Show tabs for regular project/inbox view
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

                    {/* Add Task Form for Active Tab */}
                    {activeTab === 'active' && (
                      <AddTaskForm 
                        form={form} 
                        onSubmit={onSubmit} 
                        isLoading={isLoading} 
                      />
                    )}

                    {/* Bulk Delete Section for Completed Tab */}
                    {activeTab === 'completed' && (
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
                    )}
                  </Tabs>
                )}
              </div>

              {/* Scrollable Content Area */}
              <div 
                ref={mobileScrollRef}
                className="flex-1 overflow-y-auto p-4 relative"
              >
                {/* Top gradient shadow - fixed to the scrollable container */}
                <div className="sticky top-0 left-0 right-0 h-2 bg-gradient-to-b from-background to-transparent pointer-events-none z-30" />
                
                {/* Scroll to top button for mobile */}
                <ScrollToTopButton 
                  scrollContainerRef={mobileScrollRef}
                  size="sm"
                  className="md:hidden"
                />
                
                <div className="relative">
                {isRecommendedSelected ? (
                  // Show recommended tasks view on mobile
                  <RecommendedTaskList
                    tasks={tasks}
                    projects={projects}
                    isLoading={isLoading}
                    searchQuery={searchQuery}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                  />
                ) : (
                  // Show regular project/inbox view on mobile
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                    <TabsContent value="active" className="mt-0">
                      <LoadingState isLoading={isLoading} />
                      <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                      
                      {isAllTasksSelected && groupedTasks ? (
                        <div className="space-y-4">
                          {groupedTasks.map((item, index) => {
                            if (item.type === 'project-header') {
                              const project = item.data as ProjectDecrypted;
                              return (
                                <div key={`project-header-${project.id}`} className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span>{project.name}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              const task = item.data as CanDoItemDecrypted;
                              return (
                                <div key={`task-${task.id}`} className="ml-4">
                                  <TaskListItem
                                    task={task}
                                    onToggleComplete={onToggleComplete}
                                    onDeleteTask={onDeleteTask}
                                    onUpdateTask={onUpdateTask}
                                    onToggleMyDay={handleToggleMyDay}
                                    projects={projects}
                                    tasks={tasks}
                                  />
                                </div>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        <TaskList 
                          tasks={filteredTasks}
                          allTasks={tasks}
                          isLoading={isLoading}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onToggleMyDay={handleToggleMyDay}
                          onReorderTasks={handleReorderTasks}
                          projects={projects}
                          currentProjectId={selectedProjectId}
                        />
                      )}
                    </TabsContent>

                    <TabsContent value="completed" className="mt-0">
                      <LoadingState isLoading={isLoading} />
                      <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                      
                      {isAllTasksSelected && groupedTasks ? (
                        <div className="space-y-4">
                          {groupedTasks.map((item, index) => {
                            if (item.type === 'project-header') {
                              const project = item.data as ProjectDecrypted;
                              return (
                                <div key={`project-header-${project.id}`} className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span>{project.name}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              const task = item.data as CanDoItemDecrypted;
                              return (
                                <div key={`task-${task.id}`} className="ml-4">
                                  <TaskListItem
                                    task={task}
                                    onToggleComplete={onToggleComplete}
                                    onDeleteTask={onDeleteTask}
                                    onUpdateTask={onUpdateTask}
                                    onToggleMyDay={handleToggleMyDay}
                                    projects={projects}
                                    tasks={tasks}
                                  />
                                </div>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        <TaskList 
                          tasks={filteredTasks}
                          allTasks={tasks}
                          isLoading={isLoading}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onReorderTasks={handleReorderTasks}
                          projects={projects}
                          currentProjectId={selectedProjectId}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex w-full h-full">
            <div className="w-1/4 lg:w-1/5 h-full">
              <ProjectSidebarDynamic
                projects={projects}
                tasks={tasks}
                selectedProjectId={selectedProjectId}
                onProjectSelect={handleProjectSelect}
                onRecommendedSelect={handleRecommendedSelect}
                onAllTasksSelect={handleAllTasksSelect}
                onMyDaySelect={handleMyDaySelect}
                onAddProject={handleAddProject}
                onUpdateProject={handleUpdateProject}
                onDeleteProject={handleDeleteProject}
                onBulkReorderProjects={handleBulkReorderProjects}
                onUpdateProjectCollapsedState={handleUpdateProjectCollapsedState}
                isLoading={isLoading}
                itemCounts={taskCounts}
                isRecommendedSelected={isRecommendedSelected}
                isAllTasksSelected={isAllTasksSelected}
                isMyDaySelected={isMyDaySelected}
              />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="p-6 pb-0 bg-background relative z-10">
                {/* Title row with search */}
                <div className="flex items-center justify-between gap-3 mb-2">
                  {/* Title */}
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold">
                      {isMyDaySelected
                        ? 'My Day'
                        : isRecommendedSelected 
                          ? 'Recommended Tasks'
                          : isAllTasksSelected
                            ? 'All Tasks'
                            : selectedProjectId 
                              ? projects.find(p => p.id === selectedProjectId)?.name ?? 'Project'
                              : 'Inbox'
                      }
                    </h1>
                  </div>

                  {/* Search input */}
                  <TaskSearchInput
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                </div>
                <ErrorDisplay error={error} />
                
                {!isRecommendedSelected && (
                  // Show tabs for regular project/inbox view
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

                    {/* Add Task Form for Active Tab */}
                    {activeTab === 'active' && (
                      <AddTaskForm 
                        form={form} 
                        onSubmit={onSubmit} 
                        isLoading={isLoading} 
                      />
                    )}

                    {/* Bulk Delete Section for Completed Tab */}
                    {activeTab === 'completed' && (
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
                    )}
                  </Tabs>
                )}
              </div>

              {/* Scrollable Content Area */}
              <div 
                ref={desktopScrollRef}
                className="flex-1 overflow-y-auto px-6 pb-6 relative"
              >
                {/* Top gradient shadow - fixed to the scrollable container */}
                <div className="sticky top-0 left-0 right-0 h-3 bg-gradient-to-b from-background to-transparent pointer-events-none z-30" />
                
                <div className="relative">
                {isRecommendedSelected ? (
                  // Show recommended tasks view
                  <RecommendedTaskList
                    tasks={tasks}
                    projects={projects}
                    isLoading={isLoading}
                    searchQuery={searchQuery}
                    onToggleComplete={onToggleComplete}
                    onDeleteTask={onDeleteTask}
                    onUpdateTask={onUpdateTask}
                  />
                ) : (
                  // Show regular project/inbox view
                  <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'active' | 'completed')} className="w-full">
                    <TabsContent value="active" className="mt-0">
                      <LoadingState isLoading={isLoading} />
                      <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                      
                      {isAllTasksSelected && groupedTasks ? (
                        <div className="space-y-4">
                          {groupedTasks.map((item, index) => {
                            if (item.type === 'project-header') {
                              const project = item.data as ProjectDecrypted;
                              return (
                                <div key={`project-header-${project.id}`} className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span>{project.name}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              const task = item.data as CanDoItemDecrypted;
                              return (
                                <div key={`task-${task.id}`} className="ml-4">
                                  <TaskListItem
                                    task={task}
                                    onToggleComplete={onToggleComplete}
                                    onDeleteTask={onDeleteTask}
                                    onUpdateTask={onUpdateTask}
                                    onToggleMyDay={handleToggleMyDay}
                                    projects={projects}
                                    tasks={tasks}
                                  />
                                </div>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        <TaskList 
                          tasks={filteredTasks}
                          allTasks={tasks}
                          isLoading={isLoading}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onToggleMyDay={handleToggleMyDay}
                          onReorderTasks={handleReorderTasks}
                          projects={projects}
                          currentProjectId={selectedProjectId}
                        />
                      )}
                    </TabsContent>
                    
                    <TabsContent value="completed" className="mt-0">
                      <LoadingState isLoading={isLoading} />
                      <EmptyState isLoading={isLoading} itemsLength={filteredTasks.length} />
                      
                      {isAllTasksSelected && groupedTasks ? (
                        <div className="space-y-4">
                          {groupedTasks.map((item, index) => {
                            if (item.type === 'project-header') {
                              const project = item.data as ProjectDecrypted;
                              return (
                                <div key={`project-header-${project.id}`} className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
                                    <div
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color }}
                                    />
                                    <span>{project.name}</span>
                                  </div>
                                </div>
                              );
                            } else {
                              const task = item.data as CanDoItemDecrypted;
                              return (
                                <div key={`task-${task.id}`} className="ml-4">
                                  <TaskListItem
                                    task={task}
                                    onToggleComplete={onToggleComplete}
                                    onDeleteTask={onDeleteTask}
                                    onUpdateTask={onUpdateTask}
                                    onToggleMyDay={handleToggleMyDay}
                                    projects={projects}
                                    tasks={tasks}
                                  />
                                </div>
                              );
                            }
                          })}
                        </div>
                      ) : (
                        <TaskList 
                          tasks={filteredTasks}
                          allTasks={tasks}
                          isLoading={isLoading}
                          onToggleComplete={onToggleComplete}
                          onDeleteTask={onDeleteTask}
                          onUpdateTask={onUpdateTask}
                          onReorderTasks={handleReorderTasks}
                          projects={projects}
                          currentProjectId={selectedProjectId}
                        />
                      )}
                    </TabsContent>
                  </Tabs>
                )}
                </div>
              </div>
              
              {/* Scroll to top button for desktop - positioned outside scrollable area */}
              <ScrollToTopButton 
                scrollContainerRef={desktopScrollRef}
                size="lg"
                className="hidden md:block"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
