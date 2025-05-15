import React from 'react';
import './WorkItemTree.scss';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import WorkItemTreeNode from './WorkItemTreeNode';

interface IWorkItemTreeProps {
  hierarchy: WorkItemNode[] | null;
  onSelectWorkItem: (workItemId: string) => void;
  onAddItem: (
    parentId?: string,
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  onTitleChange: (itemId: string, newTitle: string) => void;
  onRemoveItem: (itemId: string) => void;
  onPromoteItem: (itemId: string) => void;
  onDemoteItem: (itemId: string) => void;
}

export function WorkItemTree(props: IWorkItemTreeProps) {
  const {
    hierarchy,
    onSelectWorkItem,
    onAddItem,
    onTitleChange,
    onRemoveItem,
    onPromoteItem,
    onDemoteItem,
  } = props;

  if (!hierarchy) {
    return <div>Loading hierarchy...</div>;
  }

  return (
    <ul className="wit-tree-root-list">
      {hierarchy.map((node) => (
        <li
          key={node.id}
          className={node.children && node.children.length > 0 ? 'wit-tree-root-with-children' : ''}
        >
          <WorkItemTreeNode
            node={node}
            onSelectWorkItem={onSelectWorkItem}
            onAddItem={onAddItem}
            onTitleChange={onTitleChange}
            onRemoveItem={onRemoveItem}
            level={0}
            onPromoteItem={onPromoteItem}
            onDemoteItem={onDemoteItem}
          />
        </li>
      ))}
    </ul>
  );
}
