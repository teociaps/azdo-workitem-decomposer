import React from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import WorkItemTreeNode from './WorkItemTreeNode';

interface IWorkItemTreeProps {
  hierarchy: WorkItemNode[] | null;
  onSelectWorkItem: (workItemId: string) => void;
  onAddItem: (parentId?: string) => void;
  onTitleChange: (itemId: string, newTitle: string) => void;
}

export function WorkItemTree(props: IWorkItemTreeProps) {
  const { hierarchy, onSelectWorkItem, onAddItem } = props;

  if (!hierarchy) {
    return <div>Loading hierarchy...</div>;
  }

  return (
    <ul>
      {hierarchy.map((node) => (
        <WorkItemTreeNode
          key={node.id}
          node={node}
          onSelectWorkItem={onSelectWorkItem}
          onAddItem={onAddItem}
        />
      ))}
    </ul>
  );
}
