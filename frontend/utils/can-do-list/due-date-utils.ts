/**
 * Utility functions for handling task due dates
 */

/**
 * Parse due date hashtags from content
 * Supports formats: #due2024-12-25, #duetoday, #duetomorrow, #dueweek
 */
export interface ParsedDueDate {
  content: string;
  dueDate?: Date;
}

export function parseDueDateFromContent(content: string): ParsedDueDate {
  let cleanedContent = content;
  let dueDate: Date | undefined;

  // Parse specific date format: #due2024-12-25
  const dateRegex = /#due(\d{4}-\d{2}-\d{2})/gi;
  const dateMatches = [...content.matchAll(dateRegex)];
  
  for (const match of dateMatches) {
    const fullMatch = match[0]; // e.g., "#due2024-12-25"
    const dateString = match[1]; // e.g., "2024-12-25"
    
    const parsedDate = new Date(dateString + 'T00:00:00.000Z');
    if (!isNaN(parsedDate.getTime())) {
      dueDate = parsedDate;
      cleanedContent = cleanedContent.replace(fullMatch, '').trim();
    }
  }

  // Parse relative date formats if no specific date was found
  if (!dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Parse #duetoday
    const todayRegex = /#duetoday/gi;
    if (todayRegex.test(content)) {
      dueDate = today;
      cleanedContent = cleanedContent.replace(todayRegex, '').trim();
    }
    
    // Parse #duetomorrow
    const tomorrowRegex = /#duetomorrow/gi;
    if (tomorrowRegex.test(content)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      dueDate = tomorrow;
      cleanedContent = cleanedContent.replace(tomorrowRegex, '').trim();
    }
    
    // Parse #dueweek
    const weekRegex = /#dueweek/gi;
    if (weekRegex.test(content)) {
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      dueDate = nextWeek;
      cleanedContent = cleanedContent.replace(weekRegex, '').trim();
    }
  }

  // Clean up extra spaces
  cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();

  return {
    content: cleanedContent,
    dueDate
  };
}

/**
 * Format due date for display
 * @param date - The due date
 * @returns Formatted string for display
 */
export function formatDueDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  
  // For dates further away, show the actual date
  return date.toLocaleDateString();
}

/**
 * Get due date status color class
 * @param dueDate - The due date
 * @returns CSS class names for styling based on due date status
 */
export function getDueDateColorClass(dueDate?: Date): string {
  if (!dueDate) return 'bg-secondary text-secondary-foreground';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const targetDate = new Date(dueDate);
  targetDate.setHours(0, 0, 0, 0);
  
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'bg-red-100 text-red-700'; // Overdue
  if (diffDays === 0) return 'bg-orange-100 text-orange-700'; // Due today
  if (diffDays === 1) return 'bg-yellow-100 text-yellow-700'; // Due tomorrow
  if (diffDays <= 7) return 'bg-blue-100 text-blue-700'; // Due this week
  
  return 'bg-gray-100 text-gray-700'; // Due later
}

/**
 * Get examples of supported due date formats for help text
 */
export function getDueDateExamples(): string[] {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  
  return [
    '#duetoday (due today)',
    '#duetomorrow (due tomorrow)',
    '#dueweek (due in 1 week)',
    `#due${today.getFullYear()}-12-25 (due on specific date)`
  ];
} 