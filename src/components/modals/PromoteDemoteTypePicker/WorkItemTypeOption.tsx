import React from 'react';
import { WorkItemNode } from '../../../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { useGlobalState } from '../../../context/GlobalStateProvider';
import { TypeOptionBox } from './TypeOptionBox';

interface WorkItemTypeOptionProps {
  node: WorkItemNode;
  possibleTypes: WorkItemTypeName[];
  selectedType: WorkItemTypeName;
  onTypeChange: (_id: string, _type: WorkItemTypeName) => void;
  indentLevel?: number;
  isFocused?: boolean;
  focusedTypeIndex?: number;
  showFocusIndicator?: boolean;
}

/**
 * Renders a work item with type selection options
 */
export function WorkItemTypeOption({
  node,
  possibleTypes,
  selectedType,
  onTypeChange,
  indentLevel = 0,
  isFocused = false,
  focusedTypeIndex = 0,
  showFocusIndicator = false,
}: WorkItemTypeOptionProps): React.ReactElement | null {
  const { getWorkItemConfiguration } = useGlobalState();
  const nodeConfig = getWorkItemConfiguration(node.type);
  const iconUrl = nodeConfig?.iconUrl;

  return (
    <li
      className={`section-list-item${isFocused && showFocusIndicator ? ' keyboard-focused' : ''}`}
      style={indentLevel > 0 ? { marginLeft: `${indentLevel * 20}px` } : undefined}
    >
      <span className="item-icon">
        {iconUrl ? <img src={iconUrl} alt={`${node.type} icon`} /> : <span />}
      </span>
      <span className="item-title" title={node.title}>
        {node.title}
      </span>
      <span className="arrow-to-options" aria-hidden="true">
        &#8594;
      </span>
      <div className="item-type-options">
        {possibleTypes.map((type, index) => (
          <TypeOptionBox
            key={type}
            type={type}
            selected={selectedType === type}
            onClick={() => onTypeChange(node.id, type)}
            showFocusIndicator={isFocused && showFocusIndicator && index === focusedTypeIndex}
          />
        ))}
      </div>
    </li>
  );
}
