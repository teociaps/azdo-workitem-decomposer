import logger from '../common/logger';

export type ContextName =
  | 'global'
  | 'settingsModal'
  | 'typePickerModal'
  | 'dropdown'
  | 'actionBar'
  | 'mainPanel';

export function createKeyCombo(
  key: string,
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  } = {},
): string {
  const parts: string[] = [];
  if (modifiers.ctrl) parts.push('Ctrl');
  if (modifiers.alt) parts.push('Alt');
  if (modifiers.shift) parts.push('Shift');
  if (modifiers.meta) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export interface ShortcutVariant {
  context: ContextName;
  callback?: (() => void) | null;
  label: string;
}

export interface ShortcutDefinition {
  key: string;
  label: string;
  variants: ShortcutVariant[];
}

const CONTEXT_PRIORITY: Record<ContextName, number> = {
  global: 1000,
  settingsModal: 40,
  typePickerModal: 30,
  dropdown: 20,
  actionBar: 15,
  mainPanel: 10,
};

const shortcutManagerLogger = logger.createChild('ShortcutManager');

/**
 * Manages keyboard shortcuts for the application.
 * It handles loading shortcut configurations, registering and unregistering contexts,
 * managing callbacks for shortcuts, and listening for keyboard events.
 * This class follows a singleton pattern.
 */
export class ShortcutManager {
  private static instance: ShortcutManager | null = null;
  private shortcuts: ShortcutDefinition[] = [];
  private contextStack: ContextName[] = [];
  private callbacks: Map<string, () => void> = new Map();
  private keydownListener: ((_event: KeyboardEvent) => void) | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * Gets the singleton instance of the ShortcutManager.
   * @returns The singleton instance.
   */
  static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager();
    }
    return ShortcutManager.instance;
  }

  /**
   * Loads the shortcut configuration and initializes the manager.
   * @param shortcuts - An array of shortcut definitions.
   */
  loadConfiguration(shortcuts: ShortcutDefinition[]): void {
    this.shortcuts = [...shortcuts];
    this.isInitialized = true;
    this.setupGlobalListener();
    shortcutManagerLogger.debug(
      '⌨️ ShortcutManager configuration loaded with',
      shortcuts.length,
      'shortcuts',
    );
  }

  /**
   * Checks if the shortcut configuration has been loaded.
   * @returns True if the configuration is loaded, false otherwise.
   */
  isConfigurationLoaded(): boolean {
    return this.isInitialized && this.shortcuts.length > 0;
  }

  /**
   * Registers a new context, inserting it into the context stack based on its priority.
   * If the context is already registered, this method does nothing.
   * @param contextName - The name of the context to register.
   */
  registerContext(contextName: ContextName): void {
    if (!this.contextStack.includes(contextName)) {
      const priority = CONTEXT_PRIORITY[contextName];
      const insertIndex = this.contextStack.findIndex((ctx) => CONTEXT_PRIORITY[ctx] < priority);

      if (insertIndex === -1) {
        this.contextStack.push(contextName);
      } else {
        this.contextStack.splice(insertIndex, 0, contextName);
      }
    }
    this.setupGlobalListener();
  }

  /**
   * Unregisters a context from the context stack.
   * If the context stack becomes empty, the global keyboard listener is removed.
   * @param contextName - The name of the context to unregister.
   */
  unregisterContext(contextName: ContextName): void {
    const index = this.contextStack.indexOf(contextName);
    if (index !== -1) {
      this.contextStack.splice(index, 1);
    }

    if (this.contextStack.length === 0) {
      this.removeGlobalListener();
    }
  }

  /**
   * Registers multiple shortcut callbacks for a specific context.
   * @param contextName - The context to which the shortcuts belong.
   * @param shortcuts - A record mapping shortcut keys (e.g., "Ctrl+S") to their callback functions.
   */
  registerShortcuts(contextName: ContextName, shortcuts: Record<string, () => void>): void {
    Object.entries(shortcuts).forEach(([key, callback]) => {
      const callbackKey = `${key}:${contextName}`;
      this.callbacks.set(callbackKey, callback);
    });
  }

  /**
   * Unregisters multiple shortcut callbacks for a specific context.
   * @param contextName - The context from which to unregister the shortcuts.
   * @param keys - An array of shortcut keys (e.g., "Ctrl+S") to unregister.
   */
  unregisterShortcuts(contextName: ContextName, keys: string[]): void {
    keys.forEach((key) => {
      const callbackKey = `${key}:${contextName}`;
      this.callbacks.delete(callbackKey);
    });
  }

  /**
   * Sets or removes a callback for a specific shortcut variant (key and context combination).
   * @param key - The shortcut key (e.g., "Ctrl+S").
   * @param contextName - The context name.
   * @param callback - The callback function to set, or null to remove the existing callback (disable the shortcut).
   */
  setVariantCallback(key: string, contextName: ContextName, callback: (() => void) | null): void {
    const callbackKey = `${key}:${contextName}`;

    if (callback === null) {
      // Remove callback (disable shortcut)
      this.callbacks.delete(callbackKey);
    } else {
      // Set callback
      this.callbacks.set(callbackKey, callback);
    }
  }

  /**
   * Retrieves all active shortcuts (those with registered callbacks) for a specific context.
   * @param contextName - The name of the context.
   * @returns An array of shortcut objects, each containing the key, label, and variant details.
   */
  getShortcutsForContext(contextName: ContextName): {
    key: string;
    label: string;
    variant: ShortcutVariant;
  }[] {
    const result: {
      key: string;
      label: string;
      variant: ShortcutVariant;
    }[] = [];

    this.shortcuts.forEach((shortcut) => {
      const variant = shortcut.variants.find((v) => v.context === contextName);
      if (variant) {
        const callbackKey = `${shortcut.key}:${contextName}`;
        const hasCallback = this.callbacks.has(callbackKey);

        if (hasCallback) {
          result.push({
            key: shortcut.key,
            label: shortcut.label,
            variant,
          });
        }
      }
    });

    return result;
  }

  /**
   * Retrieves all active shortcuts, grouped by their context.
   * Only includes shortcuts that have a registered callback.
   * @returns A record where keys are context names and values are arrays of active shortcut objects for that context.
   */
  getAllShortcutsByContext(): Record<
    ContextName,
    {
      key: string;
      label: string;
      variant: ShortcutVariant;
    }[]
  > {
    const result: Record<
      ContextName,
      {
        key: string;
        label: string;
        variant: ShortcutVariant;
      }[]
    > = {} as Record<
      ContextName,
      {
        key: string;
        label: string;
        variant: ShortcutVariant;
      }[]
    >;
    const contexts: ContextName[] = [
      'global',
      'settingsModal',
      'typePickerModal',
      'dropdown',
      'actionBar',
      'mainPanel',
    ];

    contexts.forEach((context) => {
      result[context] = this.getShortcutsForContext(context);
    });

    return result;
  }

  /**
   * Retrieves all configured shortcut variants for a specific context directly from the loaded configuration.
   * This method does not check for active callbacks, making it suitable for displaying all defined shortcuts (e.g., in a help modal).
   * @param contextName - The name of the context.
   * @returns An array of configured shortcut objects for the given context. Returns an empty array if configuration is not loaded.
   */
  getAllConfiguredShortcutsForContext(contextName: ContextName): {
    key: string;
    label: string;
    variant: ShortcutVariant;
  }[] {
    const result: { key: string; label: string; variant: ShortcutVariant }[] = [];
    if (!this.isConfigurationLoaded()) {
      shortcutManagerLogger.warn(
        'Configuration not loaded. Cannot get configured shortcuts for context.',
      );
      return result;
    }

    this.shortcuts.forEach((shortcutDef) => {
      const variant = shortcutDef.variants.find((v) => v.context === contextName);
      if (variant) {
        result.push({
          key: shortcutDef.key,
          label: shortcutDef.label,
          variant,
        });
      }
    });
    return result;
  }

  /**
   * Retrieves a map of all configured shortcuts, grouped by context, directly from the loaded configuration.
   * This is intended for use in UI elements like help modals that need to display all defined shortcuts.
   * It does not check for active callbacks.
   * @returns A record where keys are context names and values are arrays of configured shortcut objects for that context.
   * Returns an empty object if configuration is not loaded.
   */
  getAllConfiguredShortcutsByContext(): Record<
    ContextName,
    {
      key: string;
      label: string;
      variant: ShortcutVariant;
    }[]
  > {
    const result: Record<
      ContextName,
      {
        key: string;
        label: string;
        variant: ShortcutVariant;
      }[]
    > = {} as Record<ContextName, { key: string; label: string; variant: ShortcutVariant }[]>;

    if (!this.isConfigurationLoaded()) {
      shortcutManagerLogger.warn(
        'Configuration not loaded. Cannot get all configured shortcuts by context.',
      );
      return result;
    }

    const contextsToDisplay: ContextName[] = [
      'global',
      'settingsModal',
      'mainPanel',
      'typePickerModal',
      'dropdown',
      'actionBar',
    ];

    contextsToDisplay.forEach((context) => {
      const shortcutsForContext = this.getAllConfiguredShortcutsForContext(context);
      if (shortcutsForContext.length > 0) {
        result[context] = shortcutsForContext;
      }
    });

    return result;
  }

  /**
   * Gets the currently active context with the highest priority.
   * @returns The name of the active context, or null if no context is active.
   */
  getActiveContext(): ContextName | null {
    return this.contextStack.length > 0 ? this.contextStack[0] : null;
  }

  /**
   * Gets a copy of the current context stack, ordered by priority (highest first).
   * @returns An array of active context names.
   */
  getActiveContexts(): ContextName[] {
    return [...this.contextStack];
  }

  /**
   * Checks if a specific context is currently active in the context stack.
   * @param contextName - The name of the context to check.
   * @returns True if the context is active, false otherwise.
   */
  isContextActive(contextName: ContextName): boolean {
    return this.contextStack.includes(contextName);
  }

  private setupGlobalListener(): void {
    if (this.keydownListener || !this.isInitialized) return;

    this.keydownListener = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (this.isInputElement(target)) return;

      const resolvedShortcut = this.resolveShortcut(event);
      if (resolvedShortcut) {
        event.preventDefault();
        event.stopPropagation();
        resolvedShortcut();
      }
    };

    document.addEventListener('keydown', this.keydownListener);
    shortcutManagerLogger.debug('⌨️ Global keyboard listener attached');
  }

  private removeGlobalListener(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
      shortcutManagerLogger.debug('⌨️ Global keyboard listener removed');
    }
  }

  private isInputElement(target: HTMLElement): boolean {
    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.contentEditable === 'true' ||
      target.isContentEditable
    );
  }

  private resolveShortcut(event: KeyboardEvent): (() => void) | null {
    const keyCombo = this.createKeyComboFromEvent(event);
    const contextsToCheck = this.getContextsToCheck();

    for (const contextName of contextsToCheck) {
      const callbackKey = `${keyCombo}:${contextName}`;
      const callback = this.callbacks.get(callbackKey);

      if (callback) {
        return callback;
      }
    }

    return null;
  }

  private getContextsToCheck(): ContextName[] {
    if (this.contextStack.length === 0) return [];

    const contextsToCheck: ContextName[] = [];
    const highestPriorityContext = this.contextStack.find((ctx) => ctx !== 'global');

    if (highestPriorityContext) {
      contextsToCheck.push(highestPriorityContext);
    }

    if (this.contextStack.includes('global')) {
      contextsToCheck.push('global');
    }

    return contextsToCheck;
  }

  private createKeyComboFromEvent(event: KeyboardEvent): string {
    const parts: string[] = [];

    if (event.ctrlKey && !this.isMacOS()) {
      parts.push('Ctrl');
    }
    if (event.metaKey && this.isMacOS()) {
      parts.push('Cmd');
    }
    if (event.altKey) {
      parts.push('Alt');
    }
    if (event.shiftKey) {
      parts.push('Shift');
    }

    parts.push(event.key);
    return parts.join('+');
  }

  private isMacOS(): boolean {
    return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  }

  /**
   * Retrieves a copy of all loaded shortcut definitions.
   * @returns An array of all shortcut definitions.
   */
  public getAllShortcuts(): ShortcutDefinition[] {
    return [...this.shortcuts];
  }

  /**
   * Cleans up the ShortcutManager instance by removing listeners, clearing stored data,
   * and resetting its state. This also nullifies the singleton instance.
   */
  destroy(): void {
    this.removeGlobalListener();
    this.shortcuts = [];
    this.contextStack = [];
    this.callbacks.clear();
    this.isInitialized = false;
    ShortcutManager.instance = null;
  }
}

export const shortcutManager = ShortcutManager.getInstance();
