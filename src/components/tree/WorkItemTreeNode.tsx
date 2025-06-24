import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { WorkItemNode } from '../../core/models/workItemHierarchy';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { getTextColorForBackground } from '../../core/common/common';
import { Button } from 'azure-devops-ui/Button';
import { ButtonGroup } from 'azure-devops-ui/ButtonGroup';
import { TextField } from 'azure-devops-ui/TextField';
import { useDeleteConfirmation } from '../../core/hooks/useDeleteConfirmation';
import { useContextShortcuts } from '../../core/shortcuts/useShortcuts';
import { ShortcutCode } from '../../core/shortcuts/shortcutConfiguration';
import './WorkItemTreeNode.scss';

export interface WorkItemTreeNodeRef {
  focusTitle: () => void;
  focusChildTitle: (_nodeId: string) => boolean; // Returns true if found and focused
  requestDeleteConfirmation: () => void; // Triggers delete confirmation mode
  requestChildDeleteConfirmation: (_nodeId: string) => boolean; // Returns true if found and triggered
  commitPendingTitleChanges: () => void; // Commits any pending title changes for this node only
}

interface WorkItemTreeNodeProps {
  node: WorkItemNode;
  onSelectWorkItem: (_workItemId: string) => void;
  onAddItem: (
    _parentId?: string,
    _event?: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
  ) => void;
  onTitleChange: (_itemId: string, _newTitle: string) => void;
  onRemoveItem: (_itemId: string) => void;
  level: number;
  onPromoteItem: (_itemId: string) => void;
  onDemoteItem: (_itemId: string) => void;
  onCreateSibling?: (_nodeId: string) => void;
  focusedNodeId?: string | null;
  showFocusIndicator?: boolean;
  nodeInDeleteConfirmation?: string | null;
  onNodeDeleteConfirmationChange?: (_nodeId: string | null) => void;
}

const WorkItemTreeNodeImpl = React.memo(
  forwardRef<WorkItemTreeNodeRef, WorkItemTreeNodeProps>(function WorkItemTreeNode(
    {
      node,
      onSelectWorkItem,
      onAddItem,
      onTitleChange,
      onRemoveItem,
      level,
      onPromoteItem,
      onDemoteItem,
      onCreateSibling,
      focusedNodeId,
      showFocusIndicator,
      nodeInDeleteConfirmation,
      onNodeDeleteConfirmationChange,
    },
    ref,
  ) {
    const [editableTitle, setEditableTitle] = useState(node.title);
    const { getWorkItemConfiguration } = useGlobalState();
    const childRefs = useRef<Map<string, WorkItemTreeNodeRef>>(new Map());
    const nodeContainerRef = useRef<HTMLDivElement>(null);
    // Delete confirmation state
    const isConfirmingDelete = nodeInDeleteConfirmation === node.id;
    const isAnyNodeConfirmingDelete = nodeInDeleteConfirmation !== null;
    const deleteConfirmation = useDeleteConfirmation();

    const nodeConfig = getWorkItemConfiguration(node.type);
    const nodeColor = nodeConfig?.color || '#cccccc';
    const textColor = getTextColorForBackground(nodeColor);
    const iconUrl = nodeConfig?.iconUrl;
    const hasChildren = node.children && node.children.length > 0;

    // Helper function to blur any focused input within this node
    const blurNodeInput = useCallback(() => {
      if (nodeContainerRef.current) {
        const inputElement = nodeContainerRef.current.querySelector('input') as HTMLInputElement;
        if (inputElement && inputElement === document.activeElement) {
          inputElement.blur();
        }
      }
    }, []);

    useEffect(() => {
      setEditableTitle(node.title);
    }, [node.title]);

    const commitTitleChange = useCallback(() => {
      if (node.title !== editableTitle.trim() && editableTitle.trim() !== '') {
        onTitleChange(node.id, editableTitle.trim());
      } else if (editableTitle.trim() === '') {
        setEditableTitle(node.title);
      }
    }, [node.id, node.title, editableTitle, onTitleChange]);

    useImperativeHandle(
      ref,
      () => ({
        focusTitle: () => {
          // Find the input element within the TextField component
          const inputElement = document.querySelector(
            `[data-node-id="${node.id}"] input`,
          ) as HTMLInputElement;
          if (inputElement) {
            inputElement.focus();
            inputElement.select();
          }
        },
        focusChildTitle: (nodeId: string) => {
          // Check if this is the node we're looking for
          if (node.id === nodeId) {
            const inputElement = document.querySelector(
              `[data-node-id="${node.id}"] input`,
            ) as HTMLInputElement;
            if (inputElement) {
              inputElement.focus();
              inputElement.select();
              return true;
            }
          }

          // Check children
          for (const childRef of childRefs.current.values()) {
            if (childRef.focusChildTitle(nodeId)) {
              return true;
            }
          }
          return false;
        },
        requestDeleteConfirmation: () => {
          blurNodeInput(); // Blur input when starting confirmation via keyboard shortcut
          if (deleteConfirmation.shouldShowConfirmation(hasChildren || false)) {
            onSelectWorkItem(node.id);
            onNodeDeleteConfirmationChange?.(node.id);

            // Focus the node container to ensure ESC and ALT+DELETE shortcuts work
            if (nodeContainerRef.current) {
              nodeContainerRef.current.focus();
            }
          } else {
            // No confirmation needed - delete immediately
            onRemoveItem(node.id);
          }
        },
        requestChildDeleteConfirmation: (nodeId: string) => {
          // Check if this is the node we're looking for
          if (node.id === nodeId) {
            if (deleteConfirmation.shouldShowConfirmation(hasChildren || false)) {
              onNodeDeleteConfirmationChange?.(node.id);
            } else {
              onRemoveItem(node.id);
            }
            return true;
          }

          // Check children
          for (const childRef of childRefs.current.values()) {
            if (childRef.requestChildDeleteConfirmation(nodeId)) {
              return true;
            }
          }
          return false;
        },
        commitPendingTitleChanges: () => {
          // Commit pending title changes for this node only
          commitTitleChange();
        },
      }),
      [
        blurNodeInput,
        commitTitleChange,
        deleteConfirmation,
        hasChildren,
        node.id,
        onRemoveItem,
        onNodeDeleteConfirmationChange,
        onSelectWorkItem,
      ],
    );

    const setChildRef = (childId: string, childRef: WorkItemTreeNodeRef | null) => {
      if (childRef) {
        childRefs.current.set(childId, childRef);
      } else {
        childRefs.current.delete(childId);
      }
    };

    const handleTitleInputChange = useCallback(
      (_event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, newValue: string) => {
        setEditableTitle(newValue);
      },
      [],
    );

    const handleTitleBlur = useCallback(() => {
      commitTitleChange();
    }, [commitTitleChange]);

    const handleTitleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitTitleChange();
          (e.target as HTMLElement).blur();

          if (onCreateSibling) {
            onCreateSibling(node.id);
          }
        }
        if (e.key === 'Escape') {
          setEditableTitle(node.title);
          (e.target as HTMLElement).blur();
        }
      },
      [node.title, node.id, commitTitleChange, onCreateSibling],
    );

    const handleDeleteConfirm = useCallback(() => {
      onNodeDeleteConfirmationChange?.(null); // Clear confirmation state
      onRemoveItem(node.id);
    }, [node.id, onRemoveItem, onNodeDeleteConfirmationChange]);

    const handleDeleteCancel = useCallback(() => {
      onNodeDeleteConfirmationChange?.(null); // Clear confirmation state
    }, [onNodeDeleteConfirmationChange]);

    const handleDeleteClick = useCallback(() => {
      // Blur any focused input within this node to prevent focus-related bugs
      blurNodeInput();

      if (isConfirmingDelete) {
        // User clicked again while in confirmation mode - proceed with delete
        handleDeleteConfirm();
      } else if (deleteConfirmation.shouldShowConfirmation(hasChildren || false)) {
        // Enter confirmation mode and focus this node
        onSelectWorkItem(node.id);
        onNodeDeleteConfirmationChange?.(node.id);

        // Focus the node container to ensure ESC and ALT+DELETE shortcuts work
        if (nodeContainerRef.current) {
          nodeContainerRef.current.focus();
        }
      } else {
        // No confirmation needed - delete immediately
        onRemoveItem(node.id);
      }
    }, [
      blurNodeInput,
      isConfirmingDelete,
      deleteConfirmation,
      hasChildren,
      handleDeleteConfirm,
      node.id,
      onNodeDeleteConfirmationChange,
      onRemoveItem,
      onSelectWorkItem,
    ]);

    // Helper function to format keyboard shortcuts for Mac/PC
    const formatShortcutDisplay = (keyCombo: string): string => {
      const isMac =
        typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      return keyCombo
        .split('+')
        .map((part) => {
          switch (part) {
            case 'Alt':
              return isMac ? '⌥' : 'Alt';
            case 'Shift':
              return isMac ? '⇧' : 'Shift';
            case 'Ctrl':
              return isMac ? '⌘' : 'Ctrl';
            default:
              return part;
          }
        })
        .join('+');
    };

    // Determine delete button styling based on settings and confirmation state
    const getDeleteButtonProps = () => {
      if (isConfirmingDelete) {
        return {
          className: 'delete-button-confirming',
          iconProps: { iconName: 'CheckMark' },
        };
      }

      return {
        iconProps: { iconName: 'Delete' },
      };
    };
    const deleteButtonProps = getDeleteButtonProps();
    const deleteTooltipText = isConfirmingDelete
      ? `Confirm deletion (${formatShortcutDisplay('Alt+Delete')})`
      : 'Remove item and its children';
    const handleDeleteShortcutConfirm = useCallback(() => {
      if (isConfirmingDelete) {
        handleDeleteConfirm();
      }
    }, [isConfirmingDelete, handleDeleteConfirm]);

    // Handle ESC cancel (when in confirmation mode)
    const handleDeleteShortcutCancel = useCallback(() => {
      if (isConfirmingDelete) {
        handleDeleteCancel();
      }
    }, [isConfirmingDelete, handleDeleteCancel]);

    useContextShortcuts(
      'deleteConfirmation',
      [
        { code: ShortcutCode.ALT_DELETE, callback: handleDeleteShortcutConfirm },
        { code: ShortcutCode.ESCAPE, callback: handleDeleteShortcutCancel },
      ],
      isConfirmingDelete, // Only enabled when this node is confirming delete
    );

    const indentWidthPerLevel = 20; // pixels
    const contentPaddingLeft = 8; // pixels
    const hierarchicalMarginLeft = level * indentWidthPerLevel;

    const shouldShowKeyboardFocus = showFocusIndicator && focusedNodeId === node.id;

    return (
      <>
        {isConfirmingDelete && (
          <div className="delete-confirmation-message">
            <span className="delete-confirmation-text">
              Delete "{node.title}"{hasChildren ? ' and all its children' : ''}? Press{' '}
              {formatShortcutDisplay('Alt+Delete')} to confirm or Esc to cancel.
            </span>
          </div>
        )}
        <div
          className={`work-item-tree-node-container ${
            isConfirmingDelete && deleteConfirmation.showVisualCues ? 'confirming-delete' : ''
          }`}
        >
          <div
            className={`work-item-tree-node ${shouldShowKeyboardFocus ? 'keyboard-focused' : ''}`}
            style={{
              paddingLeft: `${contentPaddingLeft}px`,
              marginLeft: `${hierarchicalMarginLeft}px`,
            }}
            data-node-id={node.id}
            tabIndex={shouldShowKeyboardFocus ? 0 : -1}
            ref={nodeContainerRef}
          >
            {iconUrl ? (
              <img className="wit-icon" src={iconUrl} title={node.type} alt={node.type} />
            ) : (
              <span
                className="work-item-type-indicator"
                style={{
                  backgroundColor: nodeColor,
                  color: textColor,
                }}
              >
                {node.type}
              </span>
            )}
            <div className="work-item-title-container">
              <TextField
                value={editableTitle}
                onChange={handleTitleInputChange}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                onClick={() => !isAnyNodeConfirmingDelete && onSelectWorkItem(node.id)}
                inputClassName="work-item-title-textfield"
                ariaLabel={`Title for ${node.type} ${node.id}`}
                disabled={isAnyNodeConfirmingDelete}
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
                disabled={isAnyNodeConfirmingDelete}
              />
              <Button
                onClick={() => onPromoteItem(node.id)}
                iconProps={{ iconName: 'DoubleChevronLeft' }}
                subtle
                aria-label="Promote item"
                disabled={!node.canPromote || isAnyNodeConfirmingDelete}
              />
              {isConfirmingDelete ? (
                // Show cancel button in place of demote when confirming delete
                <Button
                  onClick={handleDeleteCancel}
                  iconProps={{ iconName: 'Cancel' }}
                  className="delete-button-cancel"
                  subtle
                  aria-label="Cancel deletion"
                  tooltipProps={{ text: 'Cancel deletion (Esc)' }}
                />
              ) : (
                <Button
                  onClick={() => onDemoteItem(node.id)}
                  iconProps={{ iconName: 'DoubleChevronRight' }}
                  subtle
                  aria-label="Demote item"
                  disabled={!node.canDemote || isAnyNodeConfirmingDelete}
                />
              )}
              <Button
                onClick={handleDeleteClick}
                {...deleteButtonProps}
                subtle
                aria-label={deleteTooltipText}
                tooltipProps={{ text: deleteTooltipText }}
                disabled={isAnyNodeConfirmingDelete && !isConfirmingDelete}
              />
            </ButtonGroup>
          </div>
          {node.children?.length > 0 && (
            <ul className="work-item-children-list">
              {node.children.map((child) => (
                <li key={child.id}>
                  <WorkItemTreeNodeImpl
                    ref={(childRef: WorkItemTreeNodeRef | null) => setChildRef(child.id, childRef)}
                    node={child}
                    onSelectWorkItem={onSelectWorkItem}
                    onAddItem={onAddItem}
                    onTitleChange={onTitleChange}
                    onRemoveItem={onRemoveItem}
                    level={level + 1}
                    onDemoteItem={onDemoteItem}
                    onPromoteItem={onPromoteItem}
                    onCreateSibling={onCreateSibling}
                    focusedNodeId={focusedNodeId}
                    showFocusIndicator={showFocusIndicator}
                    nodeInDeleteConfirmation={nodeInDeleteConfirmation}
                    onNodeDeleteConfirmationChange={onNodeDeleteConfirmationChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }),
);

const WorkItemTreeNode = WorkItemTreeNodeImpl as React.ForwardRefExoticComponent<
  WorkItemTreeNodeProps & React.RefAttributes<WorkItemTreeNodeRef>
>;

export default WorkItemTreeNode;
