<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Calendar, ChevronLeft, ChevronRight } from 'lucide-svelte';

	interface Props {
		currentWeek: Date;
		openNewEventDialog: () => void;
		setCurrentWeek?: (week: Date) => void;
	}

	let { currentWeek, openNewEventDialog, setCurrentWeek }: Props = $props();

	function goToPreviousWeek() {
		const newWeek = new Date(currentWeek);
		newWeek.setDate(newWeek.getDate() - 7);
		setCurrentWeek?.(newWeek);
	}

	function goToNextWeek() {
		const newWeek = new Date(currentWeek);
		newWeek.setDate(newWeek.getDate() + 7);
		setCurrentWeek?.(newWeek);
	}

	function goToCurrentWeek() {
		const today = new Date();
		const day = today.getDay();
		const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
		const monday = new Date(today);
		monday.setDate(diff);
		monday.setHours(0, 0, 0, 0);
		setCurrentWeek?.(monday);
	}

	function formatCurrentWeek() {
		const monthNames = ["January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"];
		
		return `${monthNames[currentWeek.getMonth()]} ${currentWeek.getFullYear()}`;
	}

	function getWeekNumber() {
		const firstDayOfYear = new Date(currentWeek.getFullYear(), 0, 1);
		const pastDaysOfYear = (currentWeek.getTime() - firstDayOfYear.getTime()) / 86400000;
		return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
	}
</script>

<div class="flex justify-between items-center my-2">
	<div class="flex items-center space-x-2">
		<div class="flex items-center border rounded-md overflow-hidden mr-4">
			<Button onclick={goToCurrentWeek} size="sm" variant="outline" class="flex items-center gap-1 rounded-r-none border-0">
				<Calendar class="h-4 w-4" />
				<span>Today</span>
			</Button>
			<div class="h-6 w-px bg-border my-auto"></div>
			<Button onclick={goToPreviousWeek} size="sm" variant="outline" class="rounded-none border-0 px-2">
				<ChevronLeft class="h-4 w-4" />
			</Button>
			<Button onclick={goToNextWeek} size="sm" variant="outline" class="rounded-l-none border-0 px-2">
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
		<h2 class="text-lg font-medium">
			{formatCurrentWeek()} - Week {getWeekNumber()}
		</h2>
	</div>
	<div>
		<Button onclick={openNewEventDialog} size="sm">
			Add Event
		</Button>
	</div>
</div>
