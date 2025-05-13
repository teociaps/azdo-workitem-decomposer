import React, { useState, useCallback, useEffect } from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';
import { Button } from 'azure-devops-ui/Button';
import { TextField } from 'azure-devops-ui/TextField';

interface WorkItemTreeNodeProps {
  node: WorkItemNode;
  onSelectWorkItem: (workItemId: string) => void;
  onAddItem: (
    parentId?: string,
    event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  onTitleChange: (itemId: string, newTitle: string) => void;
  onRemoveItem: (itemId: string) => void;
  level: number;
}

const WorkItemTreeNode = React.memo(function WorkItemTreeNode({
  node,
  onSelectWorkItem,
  onAddItem,
  onTitleChange,
  onRemoveItem,
  level,
}: WorkItemTreeNodeProps) {
  const [editableTitle, setEditableTitle] = useState(node.title);
  const { getWorkItemConfiguration } = useGlobalState();

  const nodeConfig = getWorkItemConfiguration(node.type);
  const nodeColor = nodeConfig?.color || '#cccccc';
  const textColor = getTextColorForBackground(nodeColor);
  const iconUrl = nodeConfig?.iconUrl;

  useEffect(() => {
    setEditableTitle(node.title);
  }, [node.title]);

  const handleTitleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
      setEditableTitle(newValue);
    },
    [],
  );

  const commitTitleChange = useCallback(() => {
    if (node.title !== editableTitle.trim() && editableTitle.trim() !== '') {
      onTitleChange(node.id, editableTitle.trim());
    } else if (editableTitle.trim() === '') {
      setEditableTitle(node.title);
    }
  }, [node.id, node.title, editableTitle, onTitleChange]);

  const handleTitleBlur = useCallback(() => {
    commitTitleChange();
  }, [commitTitleChange]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        commitTitleChange();
        (e.target as HTMLElement).blur();
      }
      if (e.key === 'Escape') {
        setEditableTitle(node.title);
        (e.target as HTMLElement).blur();
      }
    },
    [node.title, commitTitleChange],
  );

  const itemPaddingLeft = level + 10;

  return (
    <li style={{ listStyleType: 'none', paddingLeft: `${itemPaddingLeft}px` }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 0' }}>
        {iconUrl ? (
          <img
            className="wit-icon"
            src={iconUrl}
            title={node.type}
            alt={node.type}
          />
        ) : (
          <span
            style={{
              backgroundColor: nodeColor,
              color: textColor,
              padding: '2px 5px',
              borderRadius: '3px',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {node.type}
          </span>
        )}
        <div style={{ flexGrow: 1, marginRight: '8px' }}>
          <TextField
            value={editableTitle}
            onChange={handleTitleInputChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            onClick={() => onSelectWorkItem(node.id)}
            inputClassName="work-item-title-textfield"
            ariaLabel={`Title for ${node.type} ${node.id}`}
          />
        </div>
        <Button
          onClick={(e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) =>
            onAddItem(node.id, e)
          }
          iconProps={{ iconName: 'Add' }}
          className="add-child-button"
          subtle
        />
        <Button
          onClick={() => onRemoveItem(node.id)}
          iconProps={{ iconName: 'Delete' }}
          className="remove-item-button"
          subtle
          aria-label="Remove item and its children"
        />
      </div>
      {node.children?.length > 0 && (
        <ul style={{ paddingLeft: '0', margin: '0' }}>
          {node.children.map((child) => (
            <WorkItemTreeNode
              key={child.id}
              node={child}
              onSelectWorkItem={onSelectWorkItem}
              onAddItem={onAddItem}
              onTitleChange={onTitleChange}
              onRemoveItem={onRemoveItem}
              level={level + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export default WorkItemTreeNode;
