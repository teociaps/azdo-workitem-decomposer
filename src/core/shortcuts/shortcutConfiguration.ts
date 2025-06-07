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

// TODO: improve this along with the manager

export const SHORTCUT_CONFIGURATION: ShortcutDefinition[] = [
  {
    key: createKeyCombo('ArrowUp'),
    label: 'Navigate up',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to previous sibling',
      },
      {
        context: 'userModal',
        label: 'Move to previous option',
      },
      {
        context: 'dropdown',
        label: 'Move to previous item',
      },
    ],
  },
  {
    key: createKeyCombo('ArrowDown'),
    label: 'Navigate down',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to next sibling',
      },
      {
        context: 'userModal',
        label: 'Move to next option',
      },
      {
        context: 'dropdown',
        label: 'Move to next item',
      },
    ],
  },
  {
    key: createKeyCombo('ArrowLeft'),
    label: 'Navigate left',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to parent node',
      },
      {
        context: 'userModal',
        label: 'Go left in modal',
      },
    ],
  },
  {
    key: createKeyCombo('ArrowRight'),
    label: 'Navigate right',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to first child',
      },
      {
        context: 'userModal',
        label: 'Move to next type option',
      },
    ],
  },
  {
    key: createKeyCombo('Home'),
    label: 'Navigate to beginning',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to first root node',
      },
    ],
  },
  {
    key: createKeyCombo('End'),
    label: 'Navigate to end',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move to last root node',
      },
    ],
  },
  {
    key: createKeyCombo('PageUp'),
    label: 'Navigate page up',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move up 10 nodes',
      },
    ],
  },
  {
    key: createKeyCombo('PageDown'),
    label: 'Navigate page down',
    variants: [
      {
        context: 'mainPanel',
        label: 'Move down 10 nodes',
      },
    ],
  },

  // === EDITING SHORTCUTS ===
  {
    key: createKeyCombo('F2'),
    label: 'Edit node',
    variants: [
      {
        context: 'mainPanel',
        label: 'Edit focused node',
      },
    ],
  },
  {
    key: createKeyCombo('n', { alt: true }),
    label: 'Create new node',
    variants: [
      {
        context: 'mainPanel',
        label: 'Create child node in panel',
      },
    ],
  },
  {
    key: createKeyCombo('Delete', { alt: true }),
    label: 'Remove node',
    variants: [
      {
        context: 'mainPanel',
        label: 'Remove focused node',
      },
    ],
  },
  {
    key: createKeyCombo('ArrowLeft', { alt: true }),
    label: 'Promote node',
    variants: [
      {
        context: 'mainPanel',
        label: 'Promote focused node',
      },
    ],
  },
  {
    key: createKeyCombo('ArrowRight', { alt: true }),
    label: 'Demote node',
    variants: [
      {
        context: 'mainPanel',
        label: 'Demote focused node',
      },
    ],
  },

  {
    key: createKeyCombo('N', { alt: true, shift: true }),
    label: 'Add root item',
    variants: [
      {
        context: 'mainPanel',
        label: 'Add root item',
      },
    ],
  },
  {
    key: createKeyCombo('H', { alt: true, shift: true }),
    label: 'Open hierarchy viewer',
    variants: [
      {
        context: 'mainPanel',
        label: 'Open or close hierarchy viewer',
      },
    ],
  },
  {
    key: createKeyCombo('S', { alt: true, shift: true }),
    label: 'Save hierarchy',
    variants: [
      {
        context: 'mainPanel',
        label: 'Save current hierarchy',
      },
    ],
  },
  {
    key: createKeyCombo(',', { alt: true }),
    label: 'Open settings',
    variants: [
      {
        context: 'global',
        label: 'Open settings',
      },
    ],
  },
  {
    key: createKeyCombo('h', { alt: true }),
    label: 'Show help',
    variants: [
      {
        context: 'global',
        label: 'Show keyboard shortcuts help',
      },
    ],
  },
  {
    key: createKeyCombo('Enter'),
    label: 'Confirm action',
    variants: [
      {
        context: 'mainPanel',
        label: 'Confirm rename edit',
      },
      {
        context: 'userModal',
        label: 'Confirm modal action',
      },
      {
        context: 'dropdown',
        label: 'Select item',
      },
    ],
  },
  {
    key: createKeyCombo('Escape'),
    label: 'Cancel action',
    variants: [
      {
        context: 'mainPanel',
        label: 'Cancel rename edit',
      },
      {
        context: 'userModal',
        label: 'Close modal',
      },
      {
        context: 'dropdown',
        label: 'Close dropdown',
      },
    ],
  },
];
