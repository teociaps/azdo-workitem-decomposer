import { useEffect, RefObject } from 'react';

export interface FocusLockOptions {
  customFocusableSelector?: string;
  initialFocusSelector?: string;
  onEscape?: () => void;
}

const DEFAULT_FOCUSABLE_SELECTOR =
  'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A React hook that creates a focus trap within a modal or dialog element.
 * It prevents keyboard focus from leaving the specified element when active,
 * managing tab order and providing escape key handling.
 *
 * @param modalRef - Reference to the HTML element that should contain the focus trap
 * @param isActive - Whether the focus lock should be active
 * @param options - Configuration options for the focus lock
 * @param options.customFocusableSelector - Custom CSS selector for focusable elements (defaults to a predefined selector)
 * @param options.onEscape - Optional callback to be executed when the Escape key is pressed
 * @param options.initialFocusSelector - CSS selector for an element that should receive focus when the modal becomes active
 * @param dependencies - Additional dependencies that should trigger the initial focus effect when changed
 *
 * @remarks
 * The focus lock has two main features:
 * 1. It traps focus within the modal when using Tab and Shift+Tab navigation
 * 2. It can automatically set focus to a specific element when the modal activates
 *
 * The focus trap is only active when `isActive` is true and the modal reference is valid.
 */
export function useFocusLock(
  modalRef: RefObject<HTMLElement>,
  isActive: boolean,
  options?: FocusLockOptions,
  dependencies: readonly unknown[] = [],
): void {
  const focusableSelector = options?.customFocusableSelector || DEFAULT_FOCUSABLE_SELECTOR;

  // Effect for focus locking (Tab and Shift+Tab) and Escape key
  useEffect(() => {
    if (!isActive || !modalRef.current) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && options?.onEscape) {
        options.onEscape();
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return;
      }

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((el) => el.offsetParent !== null); // Filter for visibility

      if (focusableElements.length === 0) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentActiveElement = document.activeElement as HTMLElement;

      if (!modalRef.current.contains(currentActiveElement)) {
        // Focus is outside the modal, lock it.
        event.preventDefault();
        if (event.shiftKey) {
          lastElement.focus();
        } else {
          firstElement.focus();
        }
        return;
      }

      // Focus is inside the modal, cycle it.
      if (event.shiftKey) {
        // Shift + Tab
        if (currentActiveElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (currentActiveElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [focusableSelector, isActive, modalRef, options]);

  // Effect for initial focus if an initialFocusSelector is provided
  useEffect(() => {
    if (isActive && modalRef.current && options?.initialFocusSelector) {
      const elementToFocus = modalRef.current.querySelector<HTMLElement>(
        options.initialFocusSelector,
      );

      if (elementToFocus) {
        const activeElement = document.activeElement;
        // Only set focus if no element within the modal is already focused,
        // or if body is focused, or if the active element is outside the modal.
        if (
          !activeElement ||
          activeElement === document.body ||
          !modalRef.current.contains(activeElement)
        ) {
          elementToFocus.focus();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, modalRef, options?.initialFocusSelector, ...dependencies]); // Only run if isActive, modalRef, initialFocusSelector, or custom dependencies change.
}
