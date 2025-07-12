import { useState, useCallback, useRef, useEffect } from 'react';
import { logger } from '../common/logger';

const autosaveLogger = logger.createChild('AutoSaveManager');

export interface ToastState {
  isVisible: boolean;
  type: 'loading' | 'success' | 'error';
  message: string;
}

export interface AutoSaveConfig {
  /**
   * Debounce delay in milliseconds before triggering autosave
   * @default 1000
   */
  debounceMs?: number;
  /**
   * Duration in milliseconds for success toast to remain visible
   * @default 3000
   */
  successDurationMs?: number;
  /**
   * Duration in milliseconds for error toast auto-dismissal (if enabled)
   * @default 5000
   */
  errorDurationMs?: number;
  /**
   * Whether error toasts should auto-dismiss or require manual dismissal
   * @default false (errors persist until manually dismissed)
   */
  autoDismissErrors?: boolean;
  /**
   * Custom success message
   * @default 'Settings saved successfully!'
   */
  successMessage?: string;
  /**
   * Custom loading message
   * @default 'Saving settings...'
   */
  loadingMessage?: string;
  /**
   * Whether to log autosave operations
   * @default true
   */
  enableLogging?: boolean;
}

export interface AutoSaveResult<T> {
  /**
   * Current toast state for UI rendering
   */
  toastState: ToastState;
  /**
   * Whether a save operation is currently in progress
   */
  isSaving: boolean;
  /**
   * Trigger autosave for the provided data
   */
  triggerAutoSave: (_data: T) => void;
  /**
   * Manually save data immediately (bypasses debouncing)
   */
  saveImmediately: (_data: T) => Promise<void>;
  /**
   * Manually dismiss the current toast
   */
  dismissToast: () => void;
  /**
   * Reset the autosave state and clear any pending operations
   */
  reset: () => void;
  /**
   * Check if there are pending unsaved changes
   */
  hasPendingChanges: boolean;
}

/**
 * Advanced hook for managing autosave functionality with comprehensive state management
 *
 * @param saveFunction - Async function that performs the actual save operation
 * @param config - Configuration options for autosave behavior
 * @returns Object containing autosave state and control functions
 */
export function useAutoSaveWithToast<T>(
  saveFunction: (_data: T) => Promise<void>,
  config: AutoSaveConfig = {},
): AutoSaveResult<T> {
  const {
    debounceMs = 1000,
    successDurationMs = 3000,
    errorDurationMs = 5000,
    autoDismissErrors = false,
    successMessage = 'Settings saved successfully!',
    loadingMessage = 'Saving settings...',
    enableLogging = true,
  } = config;

  // State management
  const [toastState, setToastState] = useState<ToastState>({
    isVisible: false,
    type: 'loading',
    message: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Refs for cleanup and timer management
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  // Cleanup function for all timers
  const clearAllTimers = useCallback(() => {
    [debounceTimerRef, successTimerRef, errorTimerRef].forEach((timerRef) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    });
  }, []);

  // Safe state updater that checks if component is still mounted
  const safeSetState = useCallback((setter: Function, value: unknown) => {
    if (!isUnmountedRef.current) {
      setter(value);
    }
  }, []);

  // Toast state management with safe updates
  const updateToastState = useCallback(
    (type: ToastState['type'], message: string) => {
      safeSetState(setToastState, {
        isVisible: true,
        type,
        message,
      });
    },
    [safeSetState],
  );

  const dismissToast = useCallback(() => {
    safeSetState(setToastState, (prev: ToastState) => ({ ...prev, isVisible: false }));
    // Clear success/error timers when manually dismissing
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
      successTimerRef.current = null;
    }
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, [safeSetState]);

  // Core save operation with comprehensive error handling
  const performSave = useCallback(
    async (data: T) => {
      if (isUnmountedRef.current) return;

      // Clear any existing toast before starting new operation
      if (toastState.isVisible) {
        dismissToast();
        // Brief pause to allow toast dismissal animation
        await new Promise((resolve) => setTimeout(resolve, 150));
      }

      safeSetState(setIsSaving, true);
      safeSetState(setHasPendingChanges, false);

      // Show loading state immediately
      updateToastState('loading', loadingMessage);

      try {
        await saveFunction(data);

        if (isUnmountedRef.current) return;

        // Show success state
        updateToastState('success', successMessage);

        if (enableLogging) {
          autosaveLogger.info('AutoSave operation completed successfully');
        }

        // Auto-dismiss success toast
        successTimerRef.current = setTimeout(() => {
          if (!isUnmountedRef.current) {
            dismissToast();
          }
        }, successDurationMs);
      } catch (error) {
        if (isUnmountedRef.current) return;

        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

        if (enableLogging) {
          autosaveLogger.error('AutoSave operation failed:', error);
        }

        updateToastState('error', `Save failed: ${errorMessage}`);

        // Auto-dismiss error toast if configured
        if (autoDismissErrors) {
          errorTimerRef.current = setTimeout(() => {
            if (!isUnmountedRef.current) {
              dismissToast();
            }
          }, errorDurationMs);
        }
      } finally {
        if (!isUnmountedRef.current) {
          safeSetState(setIsSaving, false);
        }
      }
    },
    [
      toastState.isVisible,
      dismissToast,
      safeSetState,
      updateToastState,
      loadingMessage,
      saveFunction,
      successMessage,
      enableLogging,
      successDurationMs,
      autoDismissErrors,
      errorDurationMs,
    ],
  );

  // Debounced autosave trigger
  const triggerAutoSave = useCallback(
    (data: T) => {
      safeSetState(setHasPendingChanges, true);

      // Clear existing debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set up new debounced save
      debounceTimerRef.current = setTimeout(() => {
        if (!isUnmountedRef.current) {
          performSave(data);
        }
      }, debounceMs);
    },
    [performSave, debounceMs, safeSetState],
  );

  // Immediate save (bypasses debouncing)
  const saveImmediately = useCallback(
    async (data: T) => {
      // Cancel any pending debounced save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      await performSave(data);
    },
    [performSave],
  );

  // Reset all state and clear timers
  const reset = useCallback(() => {
    clearAllTimers();

    safeSetState(setToastState, {
      isVisible: false,
      type: 'loading',
      message: '',
    });
    safeSetState(setIsSaving, false);
    safeSetState(setHasPendingChanges, false);
  }, [clearAllTimers, safeSetState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isUnmountedRef.current = true;
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    toastState,
    isSaving,
    hasPendingChanges,
    triggerAutoSave,
    saveImmediately,
    dismissToast,
    reset,
  };
}
