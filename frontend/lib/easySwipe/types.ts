/**
 * EasySwipe - A simple swipe gesture library
 * Types
 */

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeCallbacks {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: () => void;
  onSwipeMove?: (distance: number, direction: SwipeDirection | null) => void;
  onSwipeEnd?: () => void;
}

export interface SwipeConfig {
  threshold?: number; // Minimum distance in pixels to trigger swipe (default: 50)
  velocityThreshold?: number; // Minimum velocity to trigger swipe (default: 0.3)
  preventDefaultTouchMove?: boolean; // Prevent default touch move behavior (default: false)
  direction?: 'horizontal' | 'vertical' | 'all'; // Allowed swipe directions (default: 'all')
}

