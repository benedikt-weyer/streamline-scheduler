<script lang="ts">
	import type { CalendarEvent, Calendar, EventFormValues, RecurrenceFrequencyType } from '$lib/types/calendar';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';

	interface Props {
		isOpen: boolean;
		selectedEvent: CalendarEvent | null;
		calendars: Calendar[];
		defaultCalendarId?: string;
		onSubmit: (values: EventFormValues) => Promise<void>;
		onDelete?: (id: string) => Promise<void>;
		onClose: () => void;
	}

	let { 
		isOpen, 
		selectedEvent, 
		calendars, 
		defaultCalendarId, 
		onSubmit, 
		onDelete, 
		onClose 
	}: Props = $props();

	let formData = $state<EventFormValues>({
		title: '',
		description: '',
		location: '',
		startDate: '',
		startTime: '',
		endDate: '',
		endTime: '',
		isAllDay: false,
		calendarId: defaultCalendarId || '',
		recurrenceFrequency: 'none' as RecurrenceFrequencyType
	});

	let isSubmitting = $state(false);

	// Update form when selectedEvent changes
	$effect(() => {
		if (selectedEvent) {
			const startDate = selectedEvent.startTime.toISOString().split('T')[0];
			const startTime = selectedEvent.startTime.toTimeString().split(' ')[0].slice(0, 5);
			const endDate = selectedEvent.endTime.toISOString().split('T')[0];
			const endTime = selectedEvent.endTime.toTimeString().split(' ')[0].slice(0, 5);

			formData = {
				id: selectedEvent.id,
				title: selectedEvent.title,
				description: selectedEvent.description || '',
				location: selectedEvent.location || '',
				startDate,
				startTime,
				endDate,
				endTime,
				isAllDay: selectedEvent.isAllDay || false,
				calendarId: selectedEvent.calendarId,
				recurrenceFrequency: selectedEvent.recurrencePattern?.frequency || 'none'
			};
		} else {
			// Reset form for new event
			const now = new Date();
			const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
			
			formData = {
				title: '',
				description: '',
				location: '',
				startDate: now.toISOString().split('T')[0],
				startTime: now.toTimeString().split(' ')[0].slice(0, 5),
				endDate: oneHourLater.toISOString().split('T')[0],
				endTime: oneHourLater.toTimeString().split(' ')[0].slice(0, 5),
				isAllDay: false,
				calendarId: defaultCalendarId || (calendars[0]?.id || ''),
				recurrenceFrequency: 'none'
			};
		}
	});

	async function handleSubmit() {
		if (!formData.title.trim()) return;
		
		isSubmitting = true;
		try {
			await onSubmit(formData);
			onClose();
		} catch (error) {
			console.error('Error submitting event:', error);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleDelete() {
		if (!selectedEvent || !onDelete) return;
		
		if (confirm('Are you sure you want to delete this event?')) {
			try {
				await onDelete(selectedEvent.id);
				onClose();
			} catch (error) {
				console.error('Error deleting event:', error);
			}
		}
	}

	function handleAllDayChange() {
		if (formData.isAllDay) {
			formData.startTime = '00:00';
			formData.endTime = '23:59';
		}
	}
</script>

<Dialog bind:open={isOpen} onOpenChange={onClose}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle>
				{selectedEvent ? 'Edit Event' : 'Create Event'}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
			<!-- Title -->
			<div>
				<Label for="title">Title *</Label>
				<Input
					id="title"
					bind:value={formData.title}
					placeholder="Event title"
					required
				/>
			</div>

			<!-- Calendar Selection -->
			<div>
				<Label for="calendar">Calendar</Label>
				<select bind:value={formData.calendarId} class="w-full p-2 border rounded">
					{#each calendars as calendar}
						<option value={calendar.id}>{calendar.name}</option>
					{/each}
				</select>
			</div>

			<!-- All Day Toggle -->
			<div class="flex items-center space-x-2">
				<input 
					id="allDay" 
					type="checkbox"
					bind:checked={formData.isAllDay}
					onchange={handleAllDayChange}
				/>
				<Label for="allDay">All day</Label>
			</div>

			<!-- Date and Time -->
			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="startDate">Start Date</Label>
					<Input
						id="startDate"
						type="date"
						bind:value={formData.startDate}
						required
					/>
				</div>
				<div>
					<Label for="startTime">Start Time</Label>
					<Input
						id="startTime"
						type="time"
						bind:value={formData.startTime}
						disabled={formData.isAllDay}
						required
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-4">
				<div>
					<Label for="endDate">End Date</Label>
					<Input
						id="endDate"
						type="date"
						bind:value={formData.endDate}
						required
					/>
				</div>
				<div>
					<Label for="endTime">End Time</Label>
					<Input
						id="endTime"
						type="time"
						bind:value={formData.endTime}
						disabled={formData.isAllDay}
						required
					/>
				</div>
			</div>

			<!-- Description -->
			<div>
				<Label for="description">Description</Label>
				<Textarea
					id="description"
					bind:value={formData.description}
					placeholder="Event description"
					rows={3}
				/>
			</div>

			<!-- Location -->
			<div>
				<Label for="location">Location</Label>
				<Input
					id="location"
					bind:value={formData.location}
					placeholder="Event location"
				/>
			</div>

			<!-- Recurrence -->
			<div>
				<Label for="recurrence">Repeat</Label>
				<select bind:value={formData.recurrenceFrequency} class="w-full p-2 border rounded">
					<option value="none">Never</option>
					<option value="daily">Daily</option>
					<option value="weekly">Weekly</option>
					<option value="monthly">Monthly</option>
					<option value="yearly">Yearly</option>
				</select>
			</div>

			<!-- Actions -->
			<div class="flex justify-between">
				<div>
					{#if selectedEvent && onDelete}
						<Button 
							type="button" 
							variant="destructive" 
							onclick={handleDelete}
						>
							Delete
						</Button>
					{/if}
				</div>
				<div class="space-x-2">
					<Button type="button" variant="outline" onclick={onClose}>
						Cancel
					</Button>
					<Button 
						type="submit" 
						disabled={isSubmitting || !formData.title.trim()}
					>
						{isSubmitting ? 'Saving...' : selectedEvent ? 'Update' : 'Create'}
					</Button>
				</div>
			</div>
		</form>
	</DialogContent>
</Dialog>
