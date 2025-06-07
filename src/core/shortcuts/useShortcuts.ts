import { useEffect, useRef } from 'react';
import { shortcutManager, ContextName } from './ShortcutManager';
import { SHORTCUT_CONFIGURATION } from './shortcutConfiguration';

export interface ShortcutCallback {
  key: string; // e.g., "Alt+N", "ArrowLeft"
  callback: (() => void) | null; // null = disable this shortcut in this context
}

/**
 * A React hook that manages context-specific keyboard shortcuts with dynamic registration and cleanup.
 *
 * This hook handles the lifecycle of keyboard shortcuts within a specific context, including:
 * - Loading global shortcut configuration (once)
 * - Registering/unregistering the context based on enabled state
 * - Injecting/removing callback functions for shortcuts
 * - Automatic cleanup on component unmount
 *
 * @param contextName - The name identifier for the shortcut context
 * @param shortcuts - Array of shortcut definitions containing key mappings and their callback functions
 * @param enabled - Whether the shortcuts should be active (defaults to true)
 *
 * @example
 * ```typescript
 * const shortcuts = [
 *   { key: 'ctrl+s', callback: handleSave },
 *   { key: 'ctrl+z', callback: handleUndo }
 * ];
 *
 * useContextShortcuts('editor', shortcuts, isEditorActive);
 * ```
 *
 * @remarks
 * - The hook uses refs to track registration and injection state to prevent duplicate operations
 * - Configuration is loaded only once globally across all hook instances
 * - All shortcuts are automatically cleaned up when the component unmounts or when disabled
 * - Debug logging is included to track context and callback lifecycle events
 */
export function useContextShortcuts(
  contextName: ContextName,
  shortcuts: ShortcutCallback[],
  enabled = true,
): void {
  const contextRegisteredRef = useRef(false);
  const callbacksInjectedRef = useRef(false);

  // Load configuration ONCE globally
  useEffect(() => {
    if (!shortcutManager.isConfigurationLoaded()) {
      shortcutManager.loadConfiguration(SHORTCUT_CONFIGURATION);
    }
  }, []);

  // Register/unregister context based on enabled state
  useEffect(() => {
    if (enabled && !contextRegisteredRef.current) {
      shortcutManager.registerContext(contextName);
      contextRegisteredRef.current = true;
    } else if (!enabled && contextRegisteredRef.current) {
      shortcutManager.unregisterContext(contextName);
      contextRegisteredRef.current = false;
    }

    return () => {
      if (contextRegisteredRef.current) {
        shortcutManager.unregisterContext(contextName);
        contextRegisteredRef.current = false;
      }
    };
  }, [contextName, enabled]);

  // Inject/remove callbacks based on enabled state
  useEffect(() => {
    if (enabled && !callbacksInjectedRef.current) {
      shortcuts.forEach(({ key, callback }) => {
        shortcutManager.setVariantCallback(key, contextName, callback);
      });
      callbacksInjectedRef.current = true;
    } else if (!enabled && callbacksInjectedRef.current) {
      shortcuts.forEach(({ key }) => {
        shortcutManager.setVariantCallback(key, contextName, null);
      });
      callbacksInjectedRef.current = false;
    }

    return () => {
      // Cleanup callbacks on unmount
      if (callbacksInjectedRef.current) {
        shortcuts.forEach(({ key }) => {
          shortcutManager.setVariantCallback(key, contextName, null);
        });
        callbacksInjectedRef.current = false;
      }
    };
  }, [contextName, shortcuts, enabled]);
}
