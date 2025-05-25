import React from 'react';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { useGlobalState } from '../../../context/GlobalStateProvider';
import './TypeOptionBox.scss';

interface TypeOptionBoxProps {
  type: WorkItemTypeName;
  selected: boolean;
  onClick: () => void;
}

export function TypeOptionBox({ type, selected, onClick }: TypeOptionBoxProps) {
  const { getWorkItemConfiguration } = useGlobalState();
  const config = getWorkItemConfiguration(type);
  const iconUrl = config?.iconUrl;
  const typeColor = config?.color || '#0078d4'; // Default to Azure DevOps blue

  return (
    <div
      className={`type-option-box${selected ? ' selected' : ''}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      title={type}
      style={{
        '--wit-type-color': typeColor,
      } as React.CSSProperties}
    >
      {iconUrl && <img src={iconUrl} alt={type} />}
    </div>
  );
}
