import React, { useState, useEffect, useRef } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { Button } from 'azure-devops-ui/Button';
import {
  CustomHeader,
  TitleSize,
  HeaderTitleArea,
  HeaderTitleRow,
  HeaderTitle,
} from 'azure-devops-ui/Header';
import { useFocusLock, FocusLockOptions } from '../../../core/hooks/useFocusLock';
import { useContextShortcuts } from '../../../core/shortcuts/useShortcuts';
import {
  ContextName,
  shortcutManager,
  ShortcutVariant,
} from '../../../core/shortcuts/ShortcutManager';
import { ShortcutCode } from '../../../core/shortcuts/shortcutConfiguration';
import './ShortcutHelpModal.scss';

type ShortcutsByContextMap = Record<
  ContextName,
  { key: string; label: string; variant: ShortcutVariant }[]
>;

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ShortcutHelpModal({ isOpen, onClose }: ShortcutHelpModalProps) {
  const modalOverlayRef = useRef<HTMLDivElement>(null);

  useContextShortcuts('settingsModal', [{ code: ShortcutCode.ESCAPE, callback: onClose }], isOpen);

  const [allShortcutsByContext, setAllShortcutsByContext] = useState<ShortcutsByContextMap>(
    {} as ShortcutsByContextMap,
  );

  useEffect(() => {
    if (isOpen) {
      // Only attempt to populate shortcuts if the state is currently empty.
      // This ensures we load them once when the modal opens and config is ready.
      if (Object.keys(allShortcutsByContext).length === 0) {
        if (shortcutManager.isConfigurationLoaded()) {
          const c = shortcutManager.getAllConfiguredShortcutsByContext();
          setAllShortcutsByContext(c);
        } else {
          // Ensure it's an empty map
          setAllShortcutsByContext({} as ShortcutsByContextMap);
        }
      }
    }
  }, [allShortcutsByContext, isOpen]);

  const focusLockOptions: FocusLockOptions = {
    onEscape: onClose,
  };

  useFocusLock(modalOverlayRef, isOpen, focusLockOptions);

  if (!isOpen) return null;

  const contextDisplayNames: Record<ContextName, string> = {
    global: 'Global',
    actionBar: 'Action Bar',
    mainPanel: 'Main Panel',
    typePickerModal: 'Type Picker Modal',
    settingsModal: 'Settings Modal',
    dropdown: 'Dropdown',
    deleteConfirmation: 'Delete Confirmation',
  };

  return (
    <div className="shortcut-help-modal-overlay" ref={modalOverlayRef}>
      <Card className="shortcut-help-modal" contentProps={{ className: 'flex-column' }}>
        <CustomHeader className="modal-header-custom">
          <HeaderTitleArea>
            <HeaderTitleRow>
              <HeaderTitle titleSize={TitleSize.Medium}>Keyboard Shortcuts</HeaderTitle>
            </HeaderTitleRow>
            <p className="modal-header-description">
              Use these keyboard shortcuts to navigate and edit your work item hierarchy
              efficiently.
            </p>
          </HeaderTitleArea>
          <Button
            iconProps={{ iconName: 'Cancel' }}
            onClick={onClose}
            subtle
            ariaLabel="Close help dialog"
            className="modal-close-button"
          />
        </CustomHeader>

        <div className="modal-content-scrollable">
          <div className="modal-content-inner-padding">
            {Object.entries(contextDisplayNames).map(([contextName, displayName]) => {
              const contextShortcuts = allShortcutsByContext[contextName as ContextName] || [];
              if (contextShortcuts.length === 0) return null;

              return (
                <div key={contextName} className="shortcut-help-section">
                  <h3 className="shortcut-help-section-title">{displayName}</h3>
                  <div className="shortcut-list">
                    {contextShortcuts.map((shortcut, index) => (
                      <div key={`${shortcut.key}-${index}`} className="shortcut-item">
                        <div className="shortcut-keys">{formatShortcutDisplay(shortcut.key)}</div>
                        <div className="shortcut-description">{shortcut.variant.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <Button text="Close" primary onClick={onClose} />
        </div>
      </Card>
    </div>
  );
}

function formatShortcutDisplay(keyCombo: string): string {
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
        case 'ArrowUp':
          return '↑';
        case 'ArrowDown':
          return '↓';
        case 'ArrowLeft':
          return '←';
        case 'ArrowRight':
          return '→';
        case ' ':
          return 'Space';
        default:
          return part;
      }
    })
    .join(' + ');
}
