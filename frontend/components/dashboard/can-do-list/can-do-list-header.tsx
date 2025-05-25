'use client';

interface CanDoListHeaderProps {
  isSubscribed: boolean;
}

export default function CanDoListHeader({ isSubscribed }: CanDoListHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold mb-2">Your Can-Do List</h1>
      <p className="text-sm text-muted-foreground">
        Your list is encrypted and can only be read with your password.
        {isSubscribed && <span className="ml-2 text-green-600">● Live updates enabled</span>}
      </p>
    </div>
  );
}
