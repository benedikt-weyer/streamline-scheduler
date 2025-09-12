<script lang="ts">
	import type { CalendarEvent, Calendar } from '$lib/types/calendar';
	import { generateTimeSlots } from '$lib/utils/calendar';
	import { formatTime, formatDate } from '$lib/utils/calendar-helpers';

	interface Props {
		days: Date[];
		events: CalendarEvent[];
		calendars?: Calendar[];
		openEditDialog: (event: CalendarEvent) => void;
		openNewEventDialog: (day: Date, isAllDay?: boolean) => void;
		onEventUpdate?: (updatedEvent: CalendarEvent) => void;
	}

	let { days, events, calendars = [], openEditDialog, openNewEventDialog, onEventUpdate }: Props = $props();

	const timeSlots = generateTimeSlots(6, 23); // 6 AM to 11 PM

	function getEventsForDay(day: Date): CalendarEvent[] {
		return events.filter(event => {
			const eventDate = new Date(event.startTime);
			return (
				eventDate.getFullYear() === day.getFullYear() &&
				eventDate.getMonth() === day.getMonth() &&
				eventDate.getDate() === day.getDate()
			);
		});
	}

	function getEventStyle(event: CalendarEvent): string {
		const calendar = calendars?.find(cal => cal.id === event.calendarId);
		const color = calendar?.color || '#3b82f6';
		
		// Calculate position and height based on time
		const startHour = event.startTime.getHours();
		const startMinute = event.startTime.getMinutes();
		const endHour = event.endTime.getHours();
		const endMinute = event.endTime.getMinutes();
		
		const startPosition = ((startHour - 6) * 60 + startMinute) / 60; // Hours from 6 AM
		const duration = ((endHour - startHour) * 60 + (endMinute - startMinute)) / 60; // Duration in hours
		
		return `
			top: ${startPosition * 48}px;
			height: ${Math.max(duration * 48, 20)}px;
			background-color: ${color}15;
			border-left: 3px solid ${color};
		`;
	}

	function handleTimeSlotClick(day: Date, timeSlot: string) {
		const [hour] = timeSlot.split(':');
		const clickedTime = new Date(day);
		clickedTime.setHours(parseInt(hour), 0, 0, 0);
		openNewEventDialog(clickedTime, false);
	}

	function handleAllDayClick(day: Date) {
		openNewEventDialog(day, true);
	}
</script>

<div class="flex-1 overflow-auto border rounded-lg">
	<!-- Header row with days -->
	<div class="grid grid-cols-8 sticky top-0 bg-background border-b">
		<div class="p-2 text-xs font-medium text-muted-foreground border-r">Time</div>
		{#each days as day}
			<div class="p-2 text-center border-r last:border-r-0">
				<div class="text-xs font-medium text-muted-foreground">
					{formatDate(day).split(',')[0]}
				</div>
				<div class="text-sm font-semibold">
					{day.getDate()}
				</div>
			</div>
		{/each}
	</div>

	<!-- All-day events row -->
	<div class="grid grid-cols-8 border-b bg-muted/10">
		<div class="p-2 text-xs font-medium text-muted-foreground border-r">All Day</div>
		{#each days as day}
			<div 
				class="p-1 min-h-[32px] border-r last:border-r-0 cursor-pointer hover:bg-muted/20"
				onclick={() => handleAllDayClick(day)}
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && handleAllDayClick(day)}
			>
				{#each getEventsForDay(day).filter(e => e.isAllDay) as event}
					<div 
						class="text-xs p-1 mb-1 rounded truncate cursor-pointer"
						style="background-color: {calendars?.find(cal => cal.id === event.calendarId)?.color || '#3b82f6'}20; border-left: 3px solid {calendars?.find(cal => cal.id === event.calendarId)?.color || '#3b82f6'};"
						onclick={(e) => { e.stopPropagation(); openEditDialog(event); }}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && (() => { e.stopPropagation(); openEditDialog(event); })()}
					>
						{event.title}
					</div>
				{/each}
			</div>
		{/each}
	</div>

	<!-- Time slots grid -->
	<div class="relative">
		{#each timeSlots as timeSlot, index}
			<div class="grid grid-cols-8 border-b last:border-b-0" style="height: 48px;">
				<div class="p-2 text-xs text-muted-foreground border-r bg-muted/5 flex items-start">
					{timeSlot}
				</div>
				{#each days as day, dayIndex}
					<div 
						class="relative border-r last:border-r-0 hover:bg-muted/10 cursor-pointer"
						onclick={() => handleTimeSlotClick(day, timeSlot)}
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && handleTimeSlotClick(day, timeSlot)}
					>
						<!-- Events for this time slot -->
						{#if index === 0}
							{#each getEventsForDay(day).filter(e => !e.isAllDay) as event}
								<div 
									class="absolute left-0 right-0 z-10 mx-1 px-2 py-1 text-xs rounded shadow-sm cursor-pointer overflow-hidden"
									style={getEventStyle(event)}
									onclick={(e) => { e.stopPropagation(); openEditDialog(event); }}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && (() => { e.stopPropagation(); openEditDialog(event); })()}
								>
									<div class="font-medium truncate">{event.title}</div>
									<div class="text-xs opacity-80">
										{formatTime(event.startTime)} - {formatTime(event.endTime)}
									</div>
								</div>
							{/each}
						{/if}
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>
