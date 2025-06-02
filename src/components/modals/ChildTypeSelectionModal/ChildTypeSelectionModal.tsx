import React, { useEffect, useRef } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
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

  const modalStyle: React.CSSProperties = {
    top: anchorRect.bottom - containerRect.top + scrollTop + 2,
    right: containerRect.right - anchorRect.right,
  };

  return (
    <div ref={modalRef} className="child-type-selection-modal-list" style={modalStyle}>
      <ul className="child-type-options-list">
        {types.map((type) => (
          <li key={type} className="child-type-option-item">
            <Button
              text={type}
              onClick={() => onSelect(type)}
              subtle
              className="child-type-option-button"
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
