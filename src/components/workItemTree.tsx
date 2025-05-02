import * as React from 'react';
import { WorkItemNode } from '../models/workItemHierarchy';

interface IWorkItemTreeProps {
  hierarchy: WorkItemNode[] | null;
  onSelectWorkItem: (workItemId: string) => void;
  onAddItem: (parentId?: string) => void;
  onTitleChange: (itemId: string, newTitle: string) => void;
}

const renderTree = (
  node: WorkItemNode,
  onSelectWorkItem: (workItemId: string) => void,
  onAddItem: (parentId?: string) => void
) => {
  return (
    <li key={node.id}>
      <span
        style={{ cursor: 'pointer', marginRight: 8 }}
        onClick={() => onSelectWorkItem(node.id)}
      >
        {`${node.type} ${node.id}: ${node.title}`}
      </span>
      <button onClick={() => onAddItem(node.id)} style={{ marginLeft: 4 }}>
        Add Child
      </button>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map(child =>
            renderTree(child, onSelectWorkItem, onAddItem)
          )}
        </ul>
      )}
    </li>
  );
};

export function WorkItemTree(props: IWorkItemTreeProps) {
  const { hierarchy, onSelectWorkItem, onAddItem } = props;

  if (!hierarchy) {
    return <div>Loading hierarchy...</div>;
  }

  return (
    <ul>
      {hierarchy.map(node =>
        renderTree(node, onSelectWorkItem, onAddItem)
      )}
    </ul>
  );
}
