'use client';

import { useState } from 'react';
import { Plus, Eye, EyeOff, Edit, Trash, Settings, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar } from '@/utils/types';

interface CalendarSidebarProps {
  calendars: Calendar[];
  onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  onCalendarCreate: (name: string, color: string) => void;
  onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  onCalendarDelete: (calendarId: string) => void;
}

export function CalendarSidebar({
  calendars,
  onCalendarToggle,
  onCalendarCreate,
  onCalendarEdit,
  onCalendarDelete
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
              className="flex items-center gap-2 cursor-pointer flex-grow"
              onClick={() => onCalendarToggle(calendar.id, !calendar.isVisible)}
            >
              <button
                className="rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the parent onClick
                  onCalendarToggle(calendar.id, !calendar.isVisible);
                }}
              >
                {calendar.isVisible ? (
                  <Eye className="h-4 w-4 text-blue-500" />
                ) : (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                )}
              </button>
              <div className="flex items-center min-w-0">
                <div 
                  className="flex-shrink-0 w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: calendar.color }}
                ></div>
                <div className="flex items-center min-w-0">
                  <span className={`${calendar.isVisible ? 'text-gray-900' : 'text-gray-500'} truncate max-w-[120px]`}>
                    {calendar.name}
                  </span>
                  {calendar.isDefault && (
                    <Star className="ml-1 h-3 w-3 text-amber-500 flex-shrink-0" fill="currentColor" />
                  )}
                </div>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation(); // Prevent triggering the container's onClick
                openEditDialog(calendar);
              }}
              size="icon"
              variant="ghost"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
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
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={handleDeleteCalendar}
              disabled={selectedCalendar?.isDefault || calendars.length <= 1}
            >
              <Trash className="h-4 w-4 mr-2" />
              Delete
            </Button>
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
