/**
 * Centralized Keyboard Shortcut Configuration
 *
 * This file contains ALL keyboard shortcuts in the application as a flat list.
 * Each shortcut can have multiple variants for different UI contexts.
 *
 * When a variant is active, it overrides and disables the base shortcut and any
 * sibling variants for the same key combination in lower-priority contexts.
 */

import { ShortcutDefinition, createKeyCombo } from './ShortcutManager';

/* eslint-disable no-unused-vars */
export enum ShortcutCode {
  ARROW_UP = 'ARROW_UP',
  ARROW_DOWN = 'ARROW_DOWN',
  ARROW_LEFT = 'ARROW_LEFT',
  ARROW_RIGHT = 'ARROW_RIGHT',
  HOME = 'HOME',
  END = 'END',
  PAGE_UP = 'PAGE_UP',
  PAGE_DOWN = 'PAGE_DOWN',
  F2 = 'F2',
  ALT_N = 'ALT_N',
  ALT_DELETE = 'ALT_DELETE',
  ALT_ARROW_LEFT = 'ALT_ARROW_LEFT',
  ALT_ARROW_RIGHT = 'ALT_ARROW_RIGHT',
  ALT_SHIFT_N = 'ALT_SHIFT_N',
  ALT_SHIFT_H = 'ALT_SHIFT_H',
  ALT_SHIFT_S = 'ALT_SHIFT_S',
  ALT_COMMA = 'ALT_COMMA',
  ALT_H = 'ALT_H',
  ENTER = 'ENTER',
  ESCAPE = 'ESCAPE',
}
/* eslint-enable no-unused-vars */

export const SHORTCUT_CONFIGURATION: ShortcutDefinition[] = [
  {
    key: createKeyCombo('ArrowUp'),
    label: 'Navigate up',
    code: ShortcutCode.ARROW_UP,
    variants: [
      { context: 'mainPanel', label: 'Move to previous sibling' },
      { context: 'typePickerModal', label: 'Move to previous option' },
      { context: 'dropdown', label: 'Move to previous item' },
    ],
  },
  {
    key: createKeyCombo('ArrowDown'),
    label: 'Navigate down',
    code: ShortcutCode.ARROW_DOWN,
    variants: [
      { context: 'mainPanel', label: 'Move to next sibling' },
      { context: 'typePickerModal', label: 'Move to next option' },
      { context: 'dropdown', label: 'Move to next item' },
    ],
  },
  {
    key: createKeyCombo('ArrowLeft'),
    label: 'Navigate left',
    code: ShortcutCode.ARROW_LEFT,
    variants: [
      { context: 'mainPanel', label: 'Move to parent node' },
      { context: 'typePickerModal', label: 'Move to previous type option and select it' },
    ],
  },
  {
    key: createKeyCombo('ArrowRight'),
    label: 'Navigate right',
    code: ShortcutCode.ARROW_RIGHT,
    variants: [
      { context: 'mainPanel', label: 'Move to first child' },
      { context: 'typePickerModal', label: 'Move to next type option and select it' },
    ],
  },
  {
    key: createKeyCombo('Home'),
    label: 'Navigate to beginning',
    code: ShortcutCode.HOME,
    variants: [{ context: 'mainPanel', label: 'Move to first root node' }],
  },
  {
    key: createKeyCombo('End'),
    label: 'Navigate to end',
    code: ShortcutCode.END,
    variants: [{ context: 'mainPanel', label: 'Move to last root node' }],
  },
  {
    key: createKeyCombo('PageUp'),
    label: 'Navigate page up',
    code: ShortcutCode.PAGE_UP,
    variants: [{ context: 'mainPanel', label: 'Move up 10 nodes' }],
  },
  {
    key: createKeyCombo('PageDown'),
    label: 'Navigate page down',
    code: ShortcutCode.PAGE_DOWN,
    variants: [{ context: 'mainPanel', label: 'Move down 10 nodes' }],
  },
  {
    key: createKeyCombo('F2'),
    label: 'Edit node',
    code: ShortcutCode.F2,
    variants: [{ context: 'mainPanel', label: 'Edit focused node' }],
  },
  {
    key: createKeyCombo('n', { alt: true }),
    label: 'Create new node',
    code: ShortcutCode.ALT_N,
    variants: [{ context: 'mainPanel', label: 'Create child node in panel' }],
  },
  {
    key: createKeyCombo('Delete', { alt: true }),
    label: 'Remove node',
    code: ShortcutCode.ALT_DELETE,
    variants: [{ context: 'mainPanel', label: 'Remove focused node' }],
  },
  {
    key: createKeyCombo('ArrowLeft', { alt: true }),
    label: 'Promote node',
    code: ShortcutCode.ALT_ARROW_LEFT,
    variants: [{ context: 'mainPanel', label: 'Promote focused node' }],
  },
  {
    key: createKeyCombo('ArrowRight', { alt: true }),
    label: 'Demote node',
    code: ShortcutCode.ALT_ARROW_RIGHT,
    variants: [{ context: 'mainPanel', label: 'Demote focused node' }],
  },
  {
    key: createKeyCombo('N', { alt: true, shift: true }),
    label: 'Add root item',
    code: ShortcutCode.ALT_SHIFT_N,
    variants: [{ context: 'mainPanel', label: 'Add root item' }],
  },
  {
    key: createKeyCombo('H', { alt: true, shift: true }),
    label: 'Open hierarchy viewer',
    code: ShortcutCode.ALT_SHIFT_H,
    variants: [{ context: 'mainPanel', label: 'Open or close hierarchy viewer' }],
  },
  {
    key: createKeyCombo('S', { alt: true, shift: true }),
    label: 'Save hierarchy',
    code: ShortcutCode.ALT_SHIFT_S,
    variants: [{ context: 'mainPanel', label: 'Save current hierarchy' }],
  },
  {
    key: createKeyCombo(',', { alt: true }),
    label: 'Open settings',
    code: ShortcutCode.ALT_COMMA,
    variants: [{ context: 'global', label: 'Open settings' }],
  },
  {
    key: createKeyCombo('h', { alt: true }),
    label: 'Show help',
    code: ShortcutCode.ALT_H,
    variants: [{ context: 'global', label: 'Show keyboard shortcuts help' }],
  },
  {
    key: createKeyCombo('Enter'),
    label: 'Confirm action',
    code: ShortcutCode.ENTER,
    variants: [
      { context: 'mainPanel', label: 'Confirm rename edit' },
      { context: 'dropdown', label: 'Select item' },
      { context: 'typePickerModal', label: 'Confirm choices and close modal' },
    ],
  },
  {
    key: createKeyCombo('Escape'),
    label: 'Cancel action',
    code: ShortcutCode.ESCAPE,
    variants: [
      { context: 'mainPanel', label: 'Cancel rename edit' },
      { context: 'typePickerModal', label: 'Close modal' },
      { context: 'settingsModal', label: 'Close modal' },
      { context: 'dropdown', label: 'Close dropdown' },
    ],
  },
];
