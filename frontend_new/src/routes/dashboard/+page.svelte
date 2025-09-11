<script lang="ts">
	import { onMount } from 'svelte';
	import { dataStore } from '$lib/stores/data';
	
	let decryptedProjects = $state([]);
	let decryptedTasks = $state([]);
	let isLoading = $state(false);

	onMount(() => {
		// Subscribe to data changes
		const unsubscribe = dataStore.subscribe(state => {
			if (state.encryptionKey) {
				decryptedProjects = dataStore.getDecryptedProjects();
				decryptedTasks = dataStore.getDecryptedCanDoItems();
				isLoading = state.isLoading;
			}
		});

		return unsubscribe;
	});
</script>

<svelte:head>
	<title>Dashboard - Streamline Scheduler</title>
</svelte:head>

<div class="p-6">
	<div class="max-w-7xl mx-auto">
		<div class="md:flex md:items-center md:justify-between">
			<div class="flex-1 min-w-0">
				<h2 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
					Dashboard
				</h2>
			</div>
			<div class="mt-4 flex md:mt-0 md:ml-4">
				<button
					type="button"
					class="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Add Task
				</button>
				<button
					type="button"
					class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				>
					Add Project
				</button>
			</div>
		</div>

		{#if isLoading}
			<div class="mt-8 flex justify-center">
				<div class="inline-flex items-center px-4 py-2 font-semibold leading-6 text-sm shadow rounded-md text-blue-500 bg-blue-100">
					<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
					</svg>
					Loading...
				</div>
			</div>
		{:else}
			<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
				<!-- Projects Section -->
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="p-6">
						<h3 class="text-lg leading-6 font-medium text-gray-900">
							Projects ({decryptedProjects.length})
						</h3>
						<div class="mt-4">
							{#if decryptedProjects.length === 0}
								<p class="text-gray-500 text-sm">No projects yet. Create your first project to get started!</p>
							{:else}
								<div class="space-y-3">
									{#each decryptedProjects as project (project.id)}
										<div class="flex items-center p-3 bg-gray-50 rounded-lg">
											<div class="flex-shrink-0">
												<div 
													class="w-4 h-4 rounded-full"
													style="background-color: {project.color}"
												></div>
											</div>
											<div class="ml-3 flex-1">
												<p class="text-sm font-medium text-gray-900">{project.name}</p>
												{#if project.description}
													<p class="text-sm text-gray-500">{project.description}</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>

				<!-- Tasks Section -->
				<div class="bg-white overflow-hidden shadow rounded-lg">
					<div class="p-6">
						<h3 class="text-lg leading-6 font-medium text-gray-900">
							Recent Tasks ({decryptedTasks.length})
						</h3>
						<div class="mt-4">
							{#if decryptedTasks.length === 0}
								<p class="text-gray-500 text-sm">No tasks yet. Add your first task to get organized!</p>
							{:else}
								<div class="space-y-3">
									{#each decryptedTasks.slice(0, 5) as task (task.id)}
										<div class="flex items-center p-3 bg-gray-50 rounded-lg">
											<div class="flex-shrink-0">
												<input
													type="checkbox"
													checked={task.completed}
													class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
													readonly
												/>
											</div>
											<div class="ml-3 flex-1">
												<p class="text-sm font-medium text-gray-900 {task.completed ? 'line-through' : ''}">{task.title}</p>
												{#if task.description}
													<p class="text-sm text-gray-500">{task.description}</p>
												{/if}
												<div class="flex items-center mt-1">
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-{task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'green'}-100 text-{task.priority === 'high' ? 'red' : task.priority === 'medium' ? 'yellow' : 'green'}-800">
														{task.priority}
													</span>
													{#if task.due_date}
														<span class="ml-2 text-xs text-gray-500">Due: {new Date(task.due_date).toLocaleDateString()}</span>
													{/if}
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			</div>

			<!-- Quick Stats -->
			<div class="mt-8">
				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
					<div class="bg-white overflow-hidden shadow rounded-lg">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<svg class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="text-sm font-medium text-gray-500 truncate">Total Tasks</dt>
										<dd class="text-lg font-medium text-gray-900">{decryptedTasks.length}</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>

					<div class="bg-white overflow-hidden shadow rounded-lg">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<svg class="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
									</svg>
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="text-sm font-medium text-gray-500 truncate">Completed</dt>
										<dd class="text-lg font-medium text-gray-900">{decryptedTasks.filter(t => t.completed).length}</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>

					<div class="bg-white overflow-hidden shadow rounded-lg">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<svg class="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
									</svg>
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="text-sm font-medium text-gray-500 truncate">Projects</dt>
										<dd class="text-lg font-medium text-gray-900">{decryptedProjects.length}</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>

					<div class="bg-white overflow-hidden shadow rounded-lg">
						<div class="p-5">
							<div class="flex items-center">
								<div class="flex-shrink-0">
									<svg class="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</div>
								<div class="ml-5 w-0 flex-1">
									<dl>
										<dt class="text-sm font-medium text-gray-500 truncate">Pending</dt>
										<dd class="text-lg font-medium text-gray-900">{decryptedTasks.filter(t => !t.completed).length}</dd>
									</dl>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
