import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import './WorkItemTree.scss';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import WorkItemTreeNode, { WorkItemTreeNodeRef } from './WorkItemTreeNode';

export interface WorkItemTreeRef {
  focusNodeTitle: (_nodeId: string) => void;
  requestDeleteConfirmation: (_nodeId: string) => void;
}

interface IWorkItemTreeProps {
  hierarchy: WorkItemNode[] | null;
  onSelectWorkItem: (_workItemId: string) => void;
  onAddItem: (
    _parentId?: string,
    _event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  onTitleChange: (_itemId: string, _newTitle: string) => void;
  onRemoveItem: (_itemId: string) => void;
  onPromoteItem: (_itemId: string) => void;
  onDemoteItem: (_itemId: string) => void;
  onCreateSibling?: (_nodeId: string) => void;
  focusedNodeId?: string | null;
  showFocusIndicator?: boolean;
  nodeInDeleteConfirmation?: string | null;
  onNodeDeleteConfirmationChange?: (_nodeId: string | null) => void;
}

export const WorkItemTree = forwardRef<WorkItemTreeRef, IWorkItemTreeProps>((props, ref) => {
  const {
    hierarchy,
    onSelectWorkItem,
    onAddItem,
    onTitleChange,
    onRemoveItem,
    onPromoteItem,
    onDemoteItem,
    onCreateSibling,
    focusedNodeId,
    showFocusIndicator,
    nodeInDeleteConfirmation,
    onNodeDeleteConfirmationChange,
  } = props;

  const nodeRefs = useRef<Map<string, WorkItemTreeNodeRef>>(new Map());

  useImperativeHandle(ref, () => ({
    focusNodeTitle: (nodeId: string) => {
      const nodeRef = nodeRefs.current.get(nodeId);
      if (nodeRef) {
        nodeRef.focusTitle();
        return;
      }
      // Recursively search children if not found at the top level
      for (const childRef of nodeRefs.current.values()) {
        if (childRef.focusChildTitle(nodeId)) {
          return;
        }
      }
    },
    requestDeleteConfirmation: (nodeId: string) => {
      const nodeRef = nodeRefs.current.get(nodeId);
      if (nodeRef) {
        nodeRef.requestDeleteConfirmation();
        return;
      }
      // Recursively search children if not found at the top level
      for (const childRef of nodeRefs.current.values()) {
        if (childRef.requestChildDeleteConfirmation(nodeId)) {
          return;
        }
      }
    },
  }));

  const setNodeRef = (nodeId: string, nodeRef: WorkItemTreeNodeRef | null) => {
    if (nodeRef) {
      nodeRefs.current.set(nodeId, nodeRef);
    } else {
      nodeRefs.current.delete(nodeId);
    }
  };

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
            ref={(nodeRef) => setNodeRef(node.id, nodeRef)}
            node={node}
            onSelectWorkItem={onSelectWorkItem}
            onAddItem={onAddItem}
            onTitleChange={onTitleChange}
            onRemoveItem={onRemoveItem}
            level={0}
            onPromoteItem={onPromoteItem}
            onDemoteItem={onDemoteItem}
            onCreateSibling={onCreateSibling}
            focusedNodeId={focusedNodeId}
            showFocusIndicator={showFocusIndicator}
            nodeInDeleteConfirmation={nodeInDeleteConfirmation}
            onNodeDeleteConfirmationChange={onNodeDeleteConfirmationChange}
          />
        </li>
      ))}
    </ul>
  );
});
