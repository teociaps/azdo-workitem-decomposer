import React from 'react';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { useGlobalState } from '../../../context/GlobalStateProvider';
import './TypeOptionBox.scss';

interface TypeOptionBoxProps {
  type: WorkItemTypeName;
  selected: boolean;
  onClick: () => void;
  isKeyboardFocused?: boolean;
}

export function TypeOptionBox({
  type,
  selected,
  onClick,
  isKeyboardFocused = false,
}: TypeOptionBoxProps) {
  const { getWorkItemConfiguration } = useGlobalState();
  const config = getWorkItemConfiguration(type);
  const iconUrl = config?.iconUrl;
  const typeColor = config?.color || '#0078d4'; // Default to Azure DevOps blue

  const handleClick = () => {
    onClick();
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent focus outline when clicking with mouse
    e.preventDefault();
  };

  return (
    <div
      className={`type-option-box${selected ? ' selected' : ''}${isKeyboardFocused ? ' keyboard-focused' : ''}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      role="button"
      aria-pressed={selected}
      title={type}
      style={
        {
          '--wit-type-color': typeColor,
        } as React.CSSProperties
      }
    >
      {iconUrl && <img src={iconUrl} alt={type} />}
    </div>
  );
}
