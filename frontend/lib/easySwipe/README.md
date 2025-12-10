# EasySwipe

A simple, lightweight swipe gesture library for React.

## Features

- 🎯 Simple API with React hooks
- 📱 Touch gesture support
- ⚡ Configurable thresholds and velocity
- 🎨 Real-time swipe feedback via callbacks
- 🔒 Direction constraints (horizontal, vertical, or all)
- 🪶 Zero dependencies (except React)

## Usage

```tsx
import { useSwipeable } from '@/lib/easySwipe';

function MyComponent() {
  const { ref } = useSwipeable({
    onSwipeLeft: () => console.log('Swiped left!'),
    onSwipeRight: () => console.log('Swiped right!'),
    onSwipeMove: (distance, direction) => {
      // Update UI during swipe
      console.log(`Swiping ${direction}: ${distance}px`);
    },
  }, {
    threshold: 80, // Minimum distance to trigger swipe
    direction: 'horizontal', // Only allow horizontal swipes
  });

  return <div ref={ref}>Swipe me!</div>;
}
```

## API

### `useSwipeable(callbacks, config)`

#### Callbacks

- `onSwipeLeft()` - Called when user swipes left
- `onSwipeRight()` - Called when user swipes right
- `onSwipeUp()` - Called when user swipes up
- `onSwipeDown()` - Called when user swipes down
- `onSwipeStart()` - Called when swipe gesture starts
- `onSwipeMove(distance, direction)` - Called during swipe with current distance and direction
- `onSwipeEnd()` - Called when swipe gesture ends

#### Config

- `threshold` - Minimum distance in pixels to trigger swipe (default: 50)
- `velocityThreshold` - Minimum velocity to trigger swipe (default: 0.3)
- `preventDefaultTouchMove` - Prevent default touch move behavior (default: false)
- `direction` - Allowed swipe directions: 'horizontal' | 'vertical' | 'all' (default: 'all')

## Example: Task List Swipe Actions

```tsx
const { ref } = useSwipeable({
  onSwipeRight: () => completeTask(),
  onSwipeLeft: () => deleteTask(),
  onSwipeMove: (distance, direction) => {
    setSwipeOffset(distance);
  },
  onSwipeEnd: () => {
    setSwipeOffset(0);
  },
}, {
  threshold: 80,
  direction: 'horizontal',
});
```

