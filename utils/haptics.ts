/**
 * Tactile Haptic Feedback Utility
 * Provides subtle physical feedback matching native mobile interactions
 * Safely guards against platforms without vibration support.
 */

export type HapticType = 'selection' | 'tap' | 'reaction' | 'threshold' | 'delete' | 'send';

export const triggerHaptic = (type: HapticType): void => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'selection': // Message long-press hold activation
        navigator.vibrate(35);
        break;
      case 'reaction': // Selecting a reaction emoji
        navigator.vibrate(20);
        break;
      case 'threshold': // Swipe-to-reply activation trigger point
        navigator.vibrate(25);
        break;
      case 'send': // Outgoing send button touch
        navigator.vibrate(15);
        break;
      case 'delete': // Destructive message delete
        navigator.vibrate([25, 45, 25]);
        break;
      case 'tap': // Micro button tap
        navigator.vibrate(10);
        break;
      default:
        navigator.vibrate(12);
        break;
    }
  } catch {
    // Graceful fallback if forbidden by user agent policies
  }
};
