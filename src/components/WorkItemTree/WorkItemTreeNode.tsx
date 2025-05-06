import React from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';

interface WorkItemTreeNodeProps {
  node: WorkItemNode;
  onSelectWorkItem: (workItemId: string) => void;
  onAddItem: (parentId?: string) => void;
}

const WorkItemTreeNode = React.memo(function WorkItemTreeNode({
  node,
  onSelectWorkItem,
  onAddItem,
}: WorkItemTreeNodeProps) {
  return (
    <li key={node.id}>
      <span style={{ cursor: 'pointer', marginRight: 8 }} onClick={() => onSelectWorkItem(node.id)}>
        {`${node.type} ${node.id}: ${node.title}`}
      </span>
      <button onClick={() => onAddItem(node.id)} style={{ marginLeft: 4 }}>
        Add Child
      </button>
      {node.children?.length > 0 && (
        <ul>
          {node.children.map((child) => (
            <WorkItemTreeNode
              key={child.id}
              node={child}
              onSelectWorkItem={onSelectWorkItem}
              onAddItem={onAddItem}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export default WorkItemTreeNode;
