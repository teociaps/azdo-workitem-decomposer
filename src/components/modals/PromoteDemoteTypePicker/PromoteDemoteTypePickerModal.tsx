import React, { useState, useMemo, useEffect, useRef } from 'react';
import { WorkItemTypeName } from '../../../core/models/commonTypes';
import { WorkItemNode } from '../../../core/models/workItemHierarchy';
import './PromoteDemoteTypePickerModal.scss';
import { Card } from 'azure-devops-ui/Card';
import { Button } from 'azure-devops-ui/Button';
import {
  CustomHeader,
  TitleSize,
  HeaderTitleArea,
  HeaderTitleRow,
  HeaderTitle,
} from 'azure-devops-ui/Header';
import { Observer } from 'azure-devops-ui/Observer';
import { ObservableValue } from 'azure-devops-ui/Core/Observable';
import { useFocusLock, FocusLockOptions } from '../../../core/hooks/useFocusLock';
import { useScrollVisibility } from '../../../core/hooks/useScrollVisibility';
import { WorkItemSection } from './WorkItemSection';

interface PromoteDemoteTypePickerModalProps {
  operation: 'promote' | 'demote';
  targetTitle: string;
  items: Array<{
    node: WorkItemNode;
    possibleTypes: WorkItemTypeName[];
  }>;
  onConfirm: (selectedTypes: Record<string, WorkItemTypeName>) => void;
  onCancel: () => void;
}

export function PromoteDemoteTypePickerModal({
  operation,
  targetTitle,
  items,
  onConfirm,
  onCancel,
}: PromoteDemoteTypePickerModalProps) {
  // State and refs
  const [selectedTypes, setSelectedTypes] = useState<Record<string, WorkItemTypeName>>({});
  const scrollableContentRef = useRef<HTMLDivElement>(null);
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const modalTitleObservable = useMemo(() => new ObservableValue<string>(``), []);

  // Derived data
  const mainItemEntry = useMemo(() => (items.length > 0 ? items[0] : null), [items]);

  const descendantEntriesForDisplay = useMemo(() => {
    if (!mainItemEntry) return [];

    const allNodesMap = new Map<
      string,
      { node: WorkItemNode; possibleTypes: WorkItemTypeName[] }
    >();
    items.forEach((item) => allNodesMap.set(item.node.id, item));

    const getChildrenWithDepth = (
      parentId: string,
      level: number,
      processedIds: Set<string> = new Set(),
    ): Array<{ node: WorkItemNode; possibleTypes: WorkItemTypeName[]; level: number }> => {
      if (processedIds.has(parentId) && parentId !== mainItemEntry.node.id) return [];
      processedIds.add(parentId);

      const parentNode = allNodesMap.get(parentId)?.node;
      if (!parentNode || !parentNode.children) return [];

      let childrenWithDepth: Array<{
        node: WorkItemNode;
        possibleTypes: WorkItemTypeName[];
        level: number;
      }> = [];

      parentNode.children.forEach((childRef) => {
        const childEntry = allNodesMap.get(childRef.id);
        if (childEntry) {
          childrenWithDepth.push({ ...childEntry, level });
          childrenWithDepth = childrenWithDepth.concat(
            getChildrenWithDepth(childRef.id, level + 1, new Set(processedIds)),
          );
        }
      });
      return childrenWithDepth;
    };

    return getChildrenWithDepth(mainItemEntry.node.id, 1);
  }, [items, mainItemEntry]);

  const mainItemRequiresChoice = useMemo(
    () => (mainItemEntry ? mainItemEntry.possibleTypes.length > 1 : false),
    [mainItemEntry],
  );

  const childrenRequiringChoice = useMemo(
    () => descendantEntriesForDisplay.filter(({ possibleTypes }) => possibleTypes.length > 1),
    [descendantEntriesForDisplay],
  );

  const headerDescription = useMemo(() => {
    if (!mainItemRequiresChoice && childrenRequiringChoice.length === 0) {
      return 'No type choices required. All items have only one valid type.';
    }
    return 'Select the new work item type for the item and, if applicable, for its children.';
  }, [mainItemRequiresChoice, childrenRequiringChoice]);

  // Custom hook for scroll visibility
  const { showTopBorder, showBottomBorder } = useScrollVisibility(scrollableContentRef, [items]);

  // Initialize selected types
  useEffect(() => {
    const initialSelectedTypes: Record<string, WorkItemTypeName> = {};

    // Set defaults for main item if it requires a choice
    if (mainItemRequiresChoice && mainItemEntry && mainItemEntry.possibleTypes.length > 0) {
      initialSelectedTypes[mainItemEntry.node.id] = mainItemEntry.possibleTypes[0];
    }

    // Set defaults for children requiring choices
    childrenRequiringChoice.forEach(({ node, possibleTypes }) => {
      if (possibleTypes.length > 0) {
        initialSelectedTypes[node.id] = possibleTypes[0];
      }
    });

    setSelectedTypes(initialSelectedTypes);
  }, [items, mainItemEntry, childrenRequiringChoice, mainItemRequiresChoice]);

  // Set modal title based on operation
  useEffect(() => {
    modalTitleObservable.value = `${
      operation === 'promote' ? 'Promoting' : 'Demoting'
    }: ${targetTitle}`;
  }, [operation, targetTitle, modalTitleObservable]);

  // Focus lock setup
  const focusLockOptions: FocusLockOptions = {
    onEscape: onCancel,
  };

  useFocusLock(modalOverlayRef, true, focusLockOptions, [
    mainItemRequiresChoice,
    childrenRequiringChoice,
    items,
  ]);

  // Handler functions
  const handleTypeChange = (id: string, type: WorkItemTypeName) => {
    setSelectedTypes((prev) => ({ ...prev, [id]: type }));
  };

  const handleConfirm = () => {
    onConfirm(selectedTypes);
  };

  // If no choices required, render simplified view
  const anyChoiceRequired =
    mainItemRequiresChoice ||
    childrenRequiringChoice.length > 0 ||
    items.some((item) => item.possibleTypes.length > 1);

  if (!anyChoiceRequired) {
    return (
      <div className="promote-demote-type-picker-modal-overlay" ref={modalOverlayRef}>
        <Card
          className="promote-demote-type-picker-modal"
          contentProps={{ className: 'flex-column' }}
        >
          <CustomHeader className="modal-header-custom">
            <HeaderTitleArea>
              <HeaderTitleRow>
                <HeaderTitle titleSize={TitleSize.Medium}>
                  <Observer observable={modalTitleObservable}>
                    {(data: { observable: string }) => <>{data.observable}</>}
                  </Observer>
                </HeaderTitle>
              </HeaderTitleRow>
              <p className="modal-header-description">{headerDescription}</p>
            </HeaderTitleArea>
            <Button
              iconProps={{ iconName: 'Cancel' }}
              onClick={onCancel}
              subtle={true}
              ariaLabel="Close dialog"
              className="modal-close-button"
            />
          </CustomHeader>
          <div className="modal-content-static">{headerDescription}</div>
          <div className="modal-actions">
            <Button text="OK" primary onClick={() => onConfirm({})} />
          </div>
        </Card>
      </div>
    );
  }

  // Prepare items for the section components
  const mainItemForSection =
    mainItemRequiresChoice && mainItemEntry
      ? [{ node: mainItemEntry.node, possibleTypes: mainItemEntry.possibleTypes }]
      : [];

  return (
    <div className="promote-demote-type-picker-modal-overlay" ref={modalOverlayRef}>
      <Card
        className="promote-demote-type-picker-modal"
        contentProps={{ className: 'flex-column' }}
      >
        <CustomHeader className="modal-header-custom">
          <HeaderTitleArea>
            <HeaderTitleRow>
              <HeaderTitle titleSize={TitleSize.Medium}>
                <Observer observable={modalTitleObservable}>
                  {(data: { observable: string }) => <>{data.observable}</>}
                </Observer>
              </HeaderTitle>
            </HeaderTitleRow>
            <p className="modal-header-description">{headerDescription}</p>
          </HeaderTitleArea>
          <Button
            iconProps={{ iconName: 'Cancel' }}
            onClick={onCancel}
            subtle={true}
            ariaLabel="Close dialog"
            className="modal-close-button"
          />
        </CustomHeader>

        <div
          className={`modal-content-scrollable${showTopBorder ? ' show-top-border' : ''}${
            showBottomBorder ? ' show-bottom-border' : ''
          }`}
          ref={scrollableContentRef}
        >
          <div className="modal-content-inner-padding">
            {/* Main item section */}
            {mainItemForSection.length > 0 && (
              <WorkItemSection
                title="Selected Item"
                items={mainItemForSection}
                selectedTypes={selectedTypes}
                onTypeChange={handleTypeChange}
              />
            )}

            {/* Divider between sections if both exist */}
            {mainItemForSection.length > 0 && childrenRequiringChoice.length > 0 && (
              <div className="promote-demote-type-picker-divider" />
            )}

            {/* Children section */}
            {childrenRequiringChoice.length > 0 && (
              <WorkItemSection
                title="Affected Children"
                items={childrenRequiringChoice}
                selectedTypes={selectedTypes}
                onTypeChange={handleTypeChange}
              />
            )}
          </div>
        </div>

        <div className="modal-actions">
          <Button text="OK" primary onClick={handleConfirm} />
        </div>
      </Card>
    </div>
  );
}
