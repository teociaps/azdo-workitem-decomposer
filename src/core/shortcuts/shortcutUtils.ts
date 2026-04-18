import { ShortcutCode, SHORTCUT_CONFIGURATION } from './shortcutConfiguration';

/**
 * Gets the keyboard shortcut display string for a given ShortcutCode
 * @param code The ShortcutCode enum value
 * @returns The formatted keyboard shortcut string (e.g., "Alt+N", "Esc")
 */
export function getShortcutDisplay(code: ShortcutCode): string {
  const shortcutDef = SHORTCUT_CONFIGURATION.find((s) => s.code === code);
  if (!shortcutDef) {
    return '';
  }

  // Format the key combo for display (handle special keys)
  const keyCombo = shortcutDef.key;
  return formatKeyCombo(keyCombo);
}

/**
 * Formats a key combo string for display on different platforms
 * @param keyCombo The key combo string (e.g., "Alt+N", "Ctrl+Delete")
 * @returns The formatted key combo for display
 */
export function formatKeyCombo(keyCombo: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

  return keyCombo
    .split('+')
    .map((part) => {
      switch (part) {
        case 'Ctrl':
          return isMac ? '⌘' : 'Ctrl';
        case 'Alt':
          return isMac ? '⌥' : 'Alt';
        case 'Shift':
          return isMac ? '⇧' : 'Shift';
        case 'Meta':
          return isMac ? '⌘' : 'Win';
        case 'ArrowUp':
          return '↑';
        case 'ArrowDown':
          return '↓';
        case 'ArrowLeft':
          return '←';
        case 'ArrowRight':
          return '→';
        case 'Escape':
          return 'Esc';
        case 'Delete':
          return 'Del';
        case 'Enter':
          return 'Enter';
        case ' ':
          return 'Space';
        case 'PageUp':
          return 'PgUp';
        case 'PageDown':
          return 'PgDn';
        default:
          return part;
      }
    })
    .join('+');
}
