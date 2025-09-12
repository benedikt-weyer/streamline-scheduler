<script lang="ts">
	import { authStore } from '$lib/stores/auth';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { 
		calendars, 
		calendarEvents, 
		isLoadingCalendars, 
		isLoadingEvents, 
		calendarError,
		calendarActions, 
		eventActions, 
		visibleCalendars, 
		visibleEvents 
	} from '$lib/stores/calendar';
	import CalendarHeader from '$lib/components/calendar/calendar-header.svelte';
	import CalendarGrid from '$lib/components/calendar/calendar-grid.svelte';
	import CalendarSidebar from '$lib/components/calendar/calendar-sidebar.svelte';
	import CalendarEventDialog from '$lib/components/calendar/calendar-event-dialog.svelte';
	import { getDaysOfWeek, getEventsInWeek } from '$lib/utils/calendar-helpers';
	import type { CalendarEvent, EventFormValues } from '$lib/types/calendar';

	let currentWeek = $state(getCurrentWeek());
	let selectedEvent = $state<CalendarEvent | null>(null);
	let isEventDialogOpen = $state(false);

	// Get current week starting Monday
	function getCurrentWeek() {
		const today = new Date();
		const day = today.getDay();
		const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
		const monday = new Date(today);
		monday.setDate(diff);
		monday.setHours(0, 0, 0, 0);
		return monday;
	}

	// Derived values
	let daysOfWeek = $derived(getDaysOfWeek(currentWeek));
	let eventsInCurrentWeek = $derived(getEventsInWeek($visibleEvents, daysOfWeek[0]));

	onMount(async () => {
		console.log('🗓️ Calendar page mounting!');
		console.log('Auth store state:', $authStore);
		console.log('Calendar loading state:', $isLoadingCalendars);
		
		// Load calendar data if we have an encryption key
		// Auth checking is handled by the dashboard layout
		if ($authStore.encryptionKey) {
			console.log('Loading calendar data with encryption key...');
			await calendarActions.loadCalendars($authStore.encryptionKey);
			await eventActions.loadEvents($authStore.encryptionKey);
		} else {
			console.log('No encryption key available, skipping calendar data load');
		}
	});

	function openNewEventDialog(day?: Date, isAllDay = false) {
		selectedEvent = null;
		isEventDialogOpen = true;
	}

	function openEditDialog(event: CalendarEvent) {
		selectedEvent = event;
		isEventDialogOpen = true;
	}

	function closeEventDialog() {
		selectedEvent = null;
		isEventDialogOpen = false;
	}

	async function handleEventSubmit(values: EventFormValues) {
		if (!$authStore.encryptionKey) return;

		const eventData = {
			title: values.title,
			description: values.description,
			location: values.location,
			startTime: new Date(`${values.startDate}T${values.startTime}`),
			endTime: new Date(`${values.endDate}T${values.endTime}`),
			isAllDay: values.isAllDay,
			calendarId: values.calendarId,
			recurrencePattern: values.recurrenceFrequency && values.recurrenceFrequency !== 'none' ? {
				frequency: values.recurrenceFrequency,
				endDate: values.recurrenceEndDate ? new Date(values.recurrenceEndDate) : undefined,
				interval: values.recurrenceInterval || 1,
				daysOfWeek: values.daysOfWeek
			} : undefined
		};

		if (values.id) {
			// Update existing event
			await eventActions.updateEvent(values.id, eventData, $authStore.encryptionKey);
		} else {
			// Create new event
			await eventActions.createEvent(eventData, $authStore.encryptionKey);
		}
	}

	async function handleEventDelete(id: string) {
		await eventActions.deleteEvent(id);
	}

	async function handleCalendarCreate(name: string, color: string) {
		if (!$authStore.encryptionKey) return;
		await calendarActions.createCalendar(name, color, $authStore.encryptionKey);
	}

	async function handleCalendarEdit(id: string, name: string, color: string) {
		if (!$authStore.encryptionKey) return;
		await calendarActions.updateCalendar(id, name, color, $authStore.encryptionKey);
	}

	async function handleCalendarDelete(id: string) {
		await calendarActions.deleteCalendar(id);
	}

	function handleCalendarToggle(id: string, isVisible: boolean) {
		calendarActions.toggleCalendarVisibility(id, isVisible);
	}

	function handleSetDefaultCalendar(id: string) {
		// TODO: Implement set default calendar
		console.log('Set default calendar:', id);
	}

	function handleEventUpdate(event: CalendarEvent) {
		// TODO: Implement drag and drop event updates
		console.log('Update event:', event);
	}
</script>

<svelte:head>
	<title>Calendar - Streamline Scheduler</title>
</svelte:head>

<!-- Full-screen calendar app -->
<div class="min-h-screen bg-gray-50">
	<!-- Top Navigation Bar -->
	<nav class="bg-white shadow-sm border-b border-gray-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between h-16">
				<div class="flex items-center">
					<a href="/" class="flex-shrink-0 flex items-center">
						<h1 class="text-xl font-bold text-gray-900">Streamline Scheduler</h1>
					</a>
					<div class="ml-10 flex items-center space-x-8">
						<a href="/dashboard/can-do-list" class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
							Can-Do List
						</a>
						<a href="/dashboard/calendar" class="bg-indigo-100 text-indigo-700 px-3 py-2 rounded-md text-sm font-medium">
							Calendar
						</a>
						<a href="/dashboard/scheduler" class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
							Scheduler
						</a>
						<a href="/dashboard/settings" class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium">
							Settings
						</a>
					</div>
				</div>
				<div class="flex items-center">
					<button 
						onclick={() => { authStore.signOut(); goto('/'); }}
						class="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
					>
						Sign Out
					</button>
				</div>
			</div>
		</div>
	</nav>

	<!-- Calendar Content -->
	{#if $isLoadingCalendars}
		<div class="flex h-screen items-center justify-center">
			<div class="text-center">
				<div class="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto mb-4"></div>
				<p class="text-gray-600">Loading calendar...</p>
			</div>
		</div>
	{:else}
		<div class="flex h-screen">
			<!-- Calendar Sidebar -->
			<div class="w-80 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
				<CalendarSidebar
					calendars={$calendars}
					onCalendarToggle={handleCalendarToggle}
					onCalendarCreate={handleCalendarCreate}
					onCalendarEdit={handleCalendarEdit}
					onCalendarDelete={handleCalendarDelete}
					onSetDefaultCalendar={handleSetDefaultCalendar}
				/>
			</div>
			
			<!-- Main Calendar Content -->
			<div class="flex-1 flex flex-col overflow-hidden">
				<!-- Calendar Header -->
				<div class="px-6 py-4 bg-white border-b border-gray-200">
					<CalendarHeader 
						currentWeek={currentWeek}
						setCurrentWeek={(week) => currentWeek = week}
						openNewEventDialog={openNewEventDialog}
					/>
				</div>
					
				{#if $calendarError}
					<div class="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-md">
						{$calendarError}
					</div>
				{/if}
				
				<!-- Calendar Grid -->
				<div class="flex-1 px-6 py-4 overflow-y-auto bg-gray-50">
					{#if $isLoadingEvents}
						<div class="text-center py-8">Loading your encrypted calendar...</div>
					{:else}
						<CalendarGrid 
							days={daysOfWeek}
							events={eventsInCurrentWeek}
							calendars={$visibleCalendars}
							openEditDialog={openEditDialog}
							openNewEventDialog={openNewEventDialog}
							onEventUpdate={handleEventUpdate}
						/>
					{/if}
				</div>
			</div>

			<!-- Event Dialog -->
			<CalendarEventDialog
				isOpen={isEventDialogOpen}
				selectedEvent={selectedEvent}
				calendars={$visibleCalendars}
				defaultCalendarId={$calendars.find(cal => cal.isDefault)?.id}
				onSubmit={handleEventSubmit}
				onDelete={handleEventDelete}
				onClose={closeEventDialog}
			/>
		</div>
	{/if}
</div>
