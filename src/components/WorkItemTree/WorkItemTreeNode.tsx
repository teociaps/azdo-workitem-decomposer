import React, { useState, useCallback, useEffect } from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';
import { Button } from 'azure-devops-ui/Button';
import { ButtonGroup } from 'azure-devops-ui/ButtonGroup';
import { TextField } from 'azure-devops-ui/TextField';
import './WorkItemTreeNode.scss';

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
  onPromoteItem: (itemId: string) => void;
  onDemoteItem: (itemId: string) => void;
}

const WorkItemTreeNode = React.memo(function WorkItemTreeNode({
  node,
  onSelectWorkItem,
  onAddItem,
  onTitleChange,
  onRemoveItem,
  level,
  onPromoteItem,
  onDemoteItem,
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

  const indentWidthPerLevel = 20; // pixels
  const contentPaddingLeft = 8; // pixels
  const hierarchicalMarginLeft = level * indentWidthPerLevel;

  return (
    <>
      <div
        className='work-item-tree-node'
        style={{
          paddingLeft: `${contentPaddingLeft}px`,
          marginLeft: `${hierarchicalMarginLeft}px`,
        }}
      >
        {iconUrl ? (
          <img className='wit-icon' src={iconUrl} title={node.type} alt={node.type} />
        ) : (
          <span
            className='work-item-type-indicator'
            style={{
              backgroundColor: nodeColor,
              color: textColor,
            }}
          >
            {node.type}
          </span>
        )}
        <div className='work-item-title-container'>
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
        <ButtonGroup className="no-gap">
          <Button
            onClick={(e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) =>
              onAddItem(node.id, e)
            }
            iconProps={{ iconName: 'Add' }}
            subtle
            aria-label="Add a child item"
          />
          <Button
            onClick={() => onPromoteItem(node.id)}
            iconProps={{ iconName: 'DoubleChevronLeft' }}
            subtle
            aria-label="Promote item"
            disabled={!node.canPromote}
          />
          <Button
            onClick={() => onDemoteItem(node.id)}
            iconProps={{ iconName: 'DoubleChevronRight' }}
            subtle
            aria-label="Demote item"
            disabled={!node.canDemote}
          />
          <Button
            onClick={() => onRemoveItem(node.id)}
            iconProps={{ iconName: 'Delete' }}
            subtle
            aria-label="Remove item and its children"
          />
        </ButtonGroup>
      </div>
      {node.children?.length > 0 && (
        <ul className='work-item-children-list'>
          {node.children.map((child) => (
            <li key={child.id}>
              <WorkItemTreeNode
                node={child}
                onSelectWorkItem={onSelectWorkItem}
                onAddItem={onAddItem}
                onTitleChange={onTitleChange}
                onRemoveItem={onRemoveItem}
                level={level + 1}
                onDemoteItem={onDemoteItem}
                onPromoteItem={onPromoteItem}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
});

export default WorkItemTreeNode;
