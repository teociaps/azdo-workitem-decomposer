import React from 'react';
import { WorkItemNode } from '../../../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { WorkItemTypeOption } from './WorkItemTypeOption';
import './PromoteDemoteTypePickerModal.scss';

interface WorkItemSectionProps {
  title: string;
  items: {
    node: WorkItemNode;
    possibleTypes: WorkItemTypeName[];
    level?: number;
  }[];
  selectedTypes: Record<string, WorkItemTypeName>;
  onTypeChange: (_id: string, _type: WorkItemTypeName) => void;
}

/**
 * Renders a section of work items with their selectable type options
 */
export function WorkItemSection({
  title,
  items,
  selectedTypes,
  onTypeChange,
}: WorkItemSectionProps): React.ReactElement | null {
  if (items.length === 0) return null;

  return (
    <div className="promote-demote-type-picker-section">
      <div className="promote-demote-type-picker-section-title">{title}</div>
      <ul className="section-list">
        {items.map(({ node, possibleTypes, level = 0 }) => (
          <WorkItemTypeOption
            key={node.id}
            node={node}
            possibleTypes={possibleTypes}
            selectedType={selectedTypes[node.id]}
            onTypeChange={onTypeChange}
            indentLevel={level}
          />
        ))}
      </ul>
    </div>
  );
}
