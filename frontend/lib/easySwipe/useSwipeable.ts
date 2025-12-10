/**
 * EasySwipe - A simple swipe gesture library
 * React hook for swipe gestures
 */

import { useRef, useEffect, useCallback } from 'react';
import type { SwipeDirection, SwipeCallbacks, SwipeConfig } from './types';

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
}

const DEFAULT_CONFIG: Required<SwipeConfig> = {
  threshold: 50,
  velocityThreshold: 0.3,
  preventDefaultTouchMove: false,
  direction: 'all',
};

export function useSwipeable(callbacks: SwipeCallbacks, config: SwipeConfig = {}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const swipeStateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    isSwiping: false,
  });

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const getSwipeDirection = useCallback((deltaX: number, deltaY: number): SwipeDirection | null => {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine primary direction
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (mergedConfig.direction === 'vertical') return null;
      return deltaX > 0 ? 'right' : 'left';
    } else {
      // Vertical swipe
      if (mergedConfig.direction === 'horizontal') return null;
      return deltaY > 0 ? 'down' : 'up';
    }
  }, [mergedConfig.direction]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      currentY: touch.clientY,
      isSwiping: false,
    };

    if (callbacks.onSwipeStart) {
      callbacks.onSwipeStart();
    }
  }, [callbacks]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeStateRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStateRef.current.startX;
    const deltaY = touch.clientY - swipeStateRef.current.startY;

    swipeStateRef.current.currentX = touch.clientX;
    swipeStateRef.current.currentY = touch.clientY;

    // Check if we've moved enough to consider it a swipe
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 5 && !swipeStateRef.current.isSwiping) {
      swipeStateRef.current.isSwiping = true;
    }

    if (swipeStateRef.current.isSwiping) {
      const direction = getSwipeDirection(deltaX, deltaY);
      
      if (callbacks.onSwipeMove && direction) {
        // Pass the distance in the primary direction
        const primaryDistance = direction === 'left' || direction === 'right' ? deltaX : deltaY;
        callbacks.onSwipeMove(primaryDistance, direction);
      }

      if (mergedConfig.preventDefaultTouchMove) {
        e.preventDefault();
      }
    }
  }, [callbacks, getSwipeDirection, mergedConfig.preventDefaultTouchMove]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!swipeStateRef.current || !swipeStateRef.current.isSwiping) {
      swipeStateRef.current.isSwiping = false;
      if (callbacks.onSwipeEnd) {
        callbacks.onSwipeEnd();
      }
      return;
    }

    const deltaX = swipeStateRef.current.currentX - swipeStateRef.current.startX;
    const deltaY = swipeStateRef.current.currentY - swipeStateRef.current.startY;
    const deltaTime = Date.now() - swipeStateRef.current.startTime;
    
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime; // pixels per millisecond

    const direction = getSwipeDirection(deltaX, deltaY);

    // Check if swipe meets threshold requirements
    const meetsDistanceThreshold = distance >= mergedConfig.threshold;
    const meetsVelocityThreshold = velocity >= mergedConfig.velocityThreshold;

    if (direction && (meetsDistanceThreshold || meetsVelocityThreshold)) {
      // Trigger appropriate callback
      switch (direction) {
        case 'left':
          if (callbacks.onSwipeLeft) callbacks.onSwipeLeft();
          break;
        case 'right':
          if (callbacks.onSwipeRight) callbacks.onSwipeRight();
          break;
        case 'up':
          if (callbacks.onSwipeUp) callbacks.onSwipeUp();
          break;
        case 'down':
          if (callbacks.onSwipeDown) callbacks.onSwipeDown();
          break;
      }
    }

    swipeStateRef.current.isSwiping = false;
    
    if (callbacks.onSwipeEnd) {
      callbacks.onSwipeEnd();
    }
  }, [callbacks, getSwipeDirection, mergedConfig.threshold, mergedConfig.velocityThreshold]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !mergedConfig.preventDefaultTouchMove });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, mergedConfig.preventDefaultTouchMove]);

  return {
    ref: elementRef,
    isSwiping: swipeStateRef.current.isSwiping,
  };
}

