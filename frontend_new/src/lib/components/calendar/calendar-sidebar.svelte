<script lang="ts">
	import type { Calendar } from '$lib/types/calendar';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Plus, Edit, Trash, Star } from 'lucide-svelte';

	interface Props {
		calendars: Calendar[];
		onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
		onCalendarCreate: (name: string, color: string) => void;
		onCalendarEdit: (calendarId: string, name: string, color: string) => void;
		onCalendarDelete: (calendarId: string) => void;
		onSetDefaultCalendar: (calendarId: string) => void;
	}

	let { 
		calendars, 
		onCalendarToggle, 
		onCalendarCreate, 
		onCalendarEdit, 
		onCalendarDelete, 
		onSetDefaultCalendar 
	}: Props = $props();

	let isCreateDialogOpen = $state(false);
	let editingCalendar = $state<Calendar | null>(null);
	let newCalendarName = $state('');
	let newCalendarColor = $state('#3b82f6');

	const predefinedColors = [
		'#3b82f6', '#ef4444', '#10b981', '#f59e0b',
		'#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
	];

	function openCreateDialog() {
		newCalendarName = '';
		newCalendarColor = '#3b82f6';
		isCreateDialogOpen = true;
	}

	function openEditDialog(calendar: Calendar) {
		editingCalendar = calendar;
		newCalendarName = calendar.name;
		newCalendarColor = calendar.color;
	}

	function handleCreate() {
		if (newCalendarName.trim()) {
			onCalendarCreate(newCalendarName.trim(), newCalendarColor);
			isCreateDialogOpen = false;
		}
	}

	function handleEdit() {
		if (editingCalendar && newCalendarName.trim()) {
			onCalendarEdit(editingCalendar.id, newCalendarName.trim(), newCalendarColor);
			editingCalendar = null;
		}
	}

	function handleDelete(calendar: Calendar) {
		if (confirm(`Are you sure you want to delete "${calendar.name}"?`)) {
			onCalendarDelete(calendar.id);
		}
	}

	function toggleCalendar(calendar: Calendar) {
		onCalendarToggle(calendar.id, !calendar.isVisible);
	}

	function setAsDefault(calendar: Calendar) {
		onSetDefaultCalendar(calendar.id);
	}
</script>

<div class="w-64 bg-muted/20 border-r flex flex-col">
	<!-- Sidebar Header -->
	<div class="p-4 border-b">
		<h3 class="text-lg font-semibold mb-3">Calendars</h3>
		<Button onclick={openCreateDialog} size="sm" class="w-full">
			<Plus class="h-4 w-4 mr-2" />
			Add Calendar
		</Button>
	</div>

	<!-- Calendar List -->
	<div class="flex-1 overflow-auto p-4 space-y-2">
		{#each calendars as calendar (calendar.id)}
			<div class="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/30">
				<!-- Color indicator and visibility toggle -->
					<button
						class="w-4 h-4 rounded-full border-2 flex-shrink-0"
						style="background-color: {calendar.isVisible ? calendar.color : 'transparent'}; border-color: {calendar.color};"
						onclick={() => toggleCalendar(calendar)}
						aria-label={calendar.isVisible ? 'Hide calendar' : 'Show calendar'}
					></button>

				<!-- Calendar name -->
				<span class="flex-1 text-sm font-medium truncate" class:opacity-50={!calendar.isVisible}>
					{calendar.name}
				</span>

				<!-- Default indicator -->
				{#if calendar.isDefault}
					<Star class="h-3 w-3 text-yellow-500 fill-current" />
				{/if}

				<!-- Actions -->
				<div class="flex space-x-1">
					<Button
						variant="ghost"
						size="sm"
						class="h-6 w-6 p-0"
						onclick={() => openEditDialog(calendar)}
					>
						<Edit class="h-3 w-3" />
					</Button>
					
					{#if !calendar.isDefault}
						<Button
							variant="ghost"
							size="sm"
							class="h-6 w-6 p-0"
							onclick={() => setAsDefault(calendar)}
						>
							<Star class="h-3 w-3" />
						</Button>
					{/if}

					<Button
						variant="ghost"
						size="sm"
						class="h-6 w-6 p-0 text-destructive hover:text-destructive"
						onclick={() => handleDelete(calendar)}
					>
						<Trash class="h-3 w-3" />
					</Button>
				</div>
			</div>
		{/each}
	</div>
</div>

<!-- Create Calendar Dialog -->
<Dialog bind:open={isCreateDialogOpen}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Create New Calendar</DialogTitle>
		</DialogHeader>
		<div class="space-y-4">
			<div>
				<Label for="calendar-name">Calendar Name</Label>
				<Input
					id="calendar-name"
					bind:value={newCalendarName}
					placeholder="Enter calendar name"
				/>
			</div>
			<div>
				<Label>Color</Label>
				<div class="flex space-x-2 mt-2">
					{#each predefinedColors as color}
						<button
							class="w-8 h-8 rounded-full border-2"
							style="background-color: {color}; border-color: {newCalendarColor === color ? '#000' : color};"
							onclick={() => newCalendarColor = color}
							aria-label={`Select color ${color}`}
						></button>
					{/each}
				</div>
			</div>
			<div class="flex justify-end space-x-2">
				<Button variant="outline" onclick={() => isCreateDialogOpen = false}>
					Cancel
				</Button>
				<Button onclick={handleCreate} disabled={!newCalendarName.trim()}>
					Create
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>

<!-- Edit Calendar Dialog -->
<Dialog open={editingCalendar !== null} onOpenChange={() => editingCalendar = null}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Edit Calendar</DialogTitle>
		</DialogHeader>
		<div class="space-y-4">
			<div>
				<Label for="edit-calendar-name">Calendar Name</Label>
				<Input
					id="edit-calendar-name"
					bind:value={newCalendarName}
					placeholder="Enter calendar name"
				/>
			</div>
			<div>
				<Label>Color</Label>
				<div class="flex space-x-2 mt-2">
					{#each predefinedColors as color}
						<button
							class="w-8 h-8 rounded-full border-2"
							style="background-color: {color}; border-color: {newCalendarColor === color ? '#000' : color};"
							onclick={() => newCalendarColor = color}
							aria-label={`Select color ${color}`}
						></button>
					{/each}
				</div>
			</div>
			<div class="flex justify-end space-x-2">
				<Button variant="outline" onclick={() => editingCalendar = null}>
					Cancel
				</Button>
				<Button onclick={handleEdit} disabled={!newCalendarName.trim()}>
					Save Changes
				</Button>
			</div>
		</div>
	</DialogContent>
</Dialog>
