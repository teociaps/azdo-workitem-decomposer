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

  return (
    <div
      className={`type-option-box${selected ? ' selected' : ''}`}
      onClick={onClick}
      tabIndex={0}
      role="button"
      aria-pressed={selected}
      title={type}
    >
      {iconUrl && <img src={iconUrl} alt={type} />}
    </div>
  );
}
