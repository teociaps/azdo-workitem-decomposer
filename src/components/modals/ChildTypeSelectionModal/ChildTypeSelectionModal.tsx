import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { useContextShortcuts } from '../../../core/shortcuts/useShortcuts';
import './ChildTypeSelectionModal.scss';

interface ChildTypeSelectionModalProps {
  isOpen: boolean;
  types: WorkItemTypeName[];
  onSelect: (_type: WorkItemTypeName) => void;
  onDismiss: () => void;
  anchorElement: HTMLElement | null;
  scrollableContainer: HTMLElement | null; // The parent scrollable container element to handle positioning
}

export function ChildTypeSelectionModal({
  isOpen,
  types,
  onSelect,
  onDismiss,
  anchorElement,
  scrollableContainer,
}: ChildTypeSelectionModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selected index and take focus when modal opens
  useEffect(() => {
    setSelectedIndex(0);
    if (isOpen) {
      setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.focus();
        }
      }, 10);
    }
  }, [isOpen]);

  useContextShortcuts(
    'dropdown',
    [
      { key: 'ArrowUp', callback: () => setSelectedIndex((prev) => Math.max(0, prev - 1)) },
      {
        key: 'ArrowDown',
        callback: () => setSelectedIndex((prev) => Math.min(types.length - 1, prev + 1)),
      },
      {
        key: 'Enter',
        callback: () => {
          if (types[selectedIndex]) {
            onSelect(types[selectedIndex]);
          }
        },
      },
      { key: 'Escape', callback: onDismiss },
    ],
    isOpen,
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onDismiss();
      }
    };

    const handleResize = () => {
      onDismiss();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, onDismiss]);
  if (!isOpen || !anchorElement || !scrollableContainer) return null;

  const anchorRect = anchorElement.getBoundingClientRect();
  const containerRect = scrollableContainer.getBoundingClientRect();
  const scrollTop = scrollableContainer.scrollTop;

  // Check if anchor element is the container itself (adding at root)
  const isAnchorContainer = anchorElement === scrollableContainer;
  const modalStyle: React.CSSProperties = isAnchorContainer
    ? {
        top: scrollTop + 8,
        right: 8,
      }
    : {
        // Normal positioning below the anchor element
        top: anchorRect.bottom - containerRect.top + scrollTop + 2,
        right: containerRect.right - anchorRect.right,
      };

  return (
    <div
      ref={modalRef}
      className="child-type-selection-modal-list"
      style={modalStyle}
      tabIndex={-1}
      role="dialog"
      aria-label="Select work item type"
    >
      <ul className="child-type-options-list" role="listbox">
        {types.map((type, index) => (
          <li
            key={type}
            className="child-type-option-item"
            role="option"
            aria-selected={index === selectedIndex}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <Button
              tabIndex={-1}
              text={type}
              onClick={() => onSelect(type)}
              subtle
              className={`child-type-option-button ${index === selectedIndex ? 'selected' : ''}`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
