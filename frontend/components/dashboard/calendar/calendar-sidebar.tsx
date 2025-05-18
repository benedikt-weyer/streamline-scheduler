'use client';

import { useState } from 'react';
import { Plus, Edit, Trash, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar } from '@/utils/types';

interface CalendarSidebarProps {
  calendars: Calendar[];
  onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  onCalendarCreate: (name: string, color: string) => void;
  onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  onCalendarDelete: (calendarId: string) => void;
  onSetDefaultCalendar: (calendarId: string) => void; // New prop for setting default calendar
}

export function CalendarSidebar({
  calendars,
  onCalendarToggle,
  onCalendarCreate,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar
}: CalendarSidebarProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [newCalendarColor, setNewCalendarColor] = useState('#4f46e5'); // Default indigo color
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(null);

  // Predefined color options
  const colorOptions = [
    { name: 'Indigo', value: '#4f46e5' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Green', value: '#22c55e' },
    { name: 'Yellow', value: '#eab308' },
    { name: 'Purple', value: '#a855f7' },
    { name: 'Pink', value: '#ec4899' },
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Orange', value: '#f97316' },
    { name: 'Teal', value: '#14b8a6' },
  ];

  const handleCreateCalendar = () => {
    if (newCalendarName.trim()) {
      onCalendarCreate(newCalendarName.trim(), newCalendarColor);
      setNewCalendarName('');
      setNewCalendarColor('#4f46e5');
      setIsCreateDialogOpen(false);
    }
  };

  const openEditDialog = (calendar: Calendar) => {
    setSelectedCalendar(calendar);
    setNewCalendarName(calendar.name);
    setNewCalendarColor(calendar.color);
    setIsEditDialogOpen(true);
  };

  const handleEditCalendar = () => {
    if (selectedCalendar && newCalendarName.trim()) {
      onCalendarEdit(selectedCalendar.id, newCalendarName.trim(), newCalendarColor);
      setSelectedCalendar(null);
      setNewCalendarName('');
      setNewCalendarColor('#4f46e5');
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteCalendar = () => {
    if (selectedCalendar) {
      onCalendarDelete(selectedCalendar.id);
      setSelectedCalendar(null);
      setIsEditDialogOpen(false);
    }
  };

  const handleSetDefaultCalendar = () => {
    if (selectedCalendar && !selectedCalendar.isDefault) {
      onSetDefaultCalendar(selectedCalendar.id);
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="w-60 border-r p-2 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">My Calendars</h2>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          size="icon"
          variant="ghost"
          title="Add Calendar"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {calendars.map((calendar) => (
          <div key={calendar.id} className="flex items-center justify-between group">
            <div 
              className="flex items-center gap-2 cursor-pointer flex-grow overflow-hidden"
              onClick={() => onCalendarToggle(calendar.id, !calendar.isVisible)}
            >
              <button
                className="rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the parent onClick
                  onCalendarToggle(calendar.id, !calendar.isVisible);
                }}
              >
                <div 
                  className={`w-3 h-3 rounded-full border-2 flex items-center justify-center`}
                  style={{ 
                    borderColor: calendar.color,
                    backgroundColor: calendar.isVisible ? calendar.color : 'transparent'
                  }}
                ></div>
              </button>
              <div className="min-w-0 flex-1">
                <span className={`${calendar.isVisible ? 'text-gray-900' : 'text-gray-500'} truncate block`}>
                  {calendar.name}
                </span>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the container's onClick
                openEditDialog(calendar);
              }}
              size="icon"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1"
              title="Edit Calendar"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Create Calendar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Calendar</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="calendarName" className="text-sm font-medium">Calendar Name</label>
              <Input
                id="calendarName"
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
                placeholder="My Calendar"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Color</label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((color) => (
                  <button
                    key={color.value}
                    className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 ${
                      newCalendarColor === color.value ? 'ring-2 ring-offset-2 ring-offset-gray-100 ring-blue-500' : ''
                    }`}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setNewCalendarColor(color.value)}
                    title={color.name}
                  ></button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCalendar}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Calendar Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Calendar</DialogTitle>
            {selectedCalendar?.isDefault && (
              <div className="text-sm text-amber-600 mt-1 px-2 py-1 bg-amber-50 rounded-md">
                This is your default calendar. It will be pre-selected when creating new events.
              </div>
            )}
          </DialogHeader>
          {selectedCalendar && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="editCalendarName" className="text-sm font-medium">Calendar Name</label>
                <Input
                  id="editCalendarName"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="My Calendar"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 ${
                        newCalendarColor === color.value ? 'ring-2 ring-offset-2 ring-offset-gray-100 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewCalendarColor(color.value)}
                      title={color.name}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button 
                        variant="destructive" 
                        onClick={handleDeleteCalendar}
                        disabled={selectedCalendar?.isDefault || calendars.length <= 1}
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(selectedCalendar?.isDefault || calendars.length <= 1) && (
                    <TooltipContent>
                      {selectedCalendar?.isDefault 
                        ? "Default calendars cannot be deleted. Set another calendar as default first."
                        : "You must have at least one calendar."
                      }
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              {!selectedCalendar?.isDefault && (
                <Button
                  variant="outline"
                  onClick={handleSetDefaultCalendar}
                  className="flex items-center"
                >
                  <Star className="h-4 w-4 mr-2 text-amber-500" fill="currentColor" />
                  Set as Default
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleEditCalendar}>Save</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
