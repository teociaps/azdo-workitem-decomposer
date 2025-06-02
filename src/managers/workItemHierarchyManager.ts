import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemConfigurationsMap, WorkItemTypeName } from '../core/models/commonTypes';
import {
  WorkItemHierarchyStateManager,
  WorkItemTypeManager,
  WorkItemHierarchyOperationsManager,
  WorkItemFlagManager,
} from './index';

/**
 * Main facade for work item hierarchy management.
 * Delegates responsibilities to specialized manager classes.
 */
export class WorkItemHierarchyManager {
  private stateManager: WorkItemHierarchyStateManager;
  private typeManager: WorkItemTypeManager;
  private operationsManager: WorkItemHierarchyOperationsManager;
  private flagManager: WorkItemFlagManager;
  constructor(
    workItemConfigurations: WorkItemConfigurationsMap,
    initialHierarchy: WorkItemNode[] = [],
    parentWorkItemType?: WorkItemTypeName,
    errorHandler?: (_error: string) => void,
  ) {
    this.stateManager = new WorkItemHierarchyStateManager(
      initialHierarchy,
      parentWorkItemType,
      errorHandler,
    );

    this.typeManager = new WorkItemTypeManager(workItemConfigurations, this.stateManager);

    this.flagManager = new WorkItemFlagManager(this.stateManager, this.typeManager);

    this.operationsManager = new WorkItemHierarchyOperationsManager(
      this.stateManager,
      this.typeManager,
      this.flagManager,
    );

    // Initialize the flags
    this.flagManager.updateAllPromoteDemoteFlags();
  }

  // State management methods
  getParentWorkItemType(): WorkItemTypeName | null {
    return this.stateManager.getParentWorkItemType();
  }

  setParentWorkItemType(type: WorkItemTypeName): void {
    this.stateManager.setParentWorkItemType(type);
  }

  getHierarchy(): WorkItemNode[] {
    return this.stateManager.getHierarchy();
  }

  getHierarchyCount(): number {
    return this.stateManager.getHierarchyCount();
  }

  setInitialHierarchy(nodes: WorkItemNode[], parentWorkItemType?: WorkItemTypeName): void {
    this.stateManager.setInitialHierarchy(nodes, parentWorkItemType);
    this.flagManager.updateAllPromoteDemoteFlags();
  }

  clearHierarchy(): void {
    this.stateManager.clearHierarchy();
    this.flagManager.updateAllPromoteDemoteFlags();
  }

  findNodeById(id: string): WorkItemNode | null {
    return this.stateManager.findNodeById(id);
  }

  // Type management methods
  getPossibleChildTypes(parentId?: string): WorkItemTypeName[] {
    return this.typeManager.getPossibleChildTypes(parentId);
  }

  getPossiblePromoteTypes(itemId: string): WorkItemTypeName[] {
    return this.typeManager.getPossiblePromoteTypes(itemId);
  }

  getPossibleDemoteTypes(itemId: string, isCascading = false): WorkItemTypeName[] {
    return this.typeManager.getPossibleDemoteTypes(itemId, isCascading);
  }

  // Operations methods
  addItem(childTypeToAdd: WorkItemTypeName, parentId?: string, title?: string): WorkItemNode[] {
    return this.operationsManager.addItem(childTypeToAdd, parentId, title);
  }

  updateItemTitle(itemId: string, newTitle: string): WorkItemNode[] {
    return this.stateManager.updateItemTitle(itemId, newTitle);
  }

  removeItem(itemId: string): WorkItemNode[] {
    return this.operationsManager.removeItem(itemId);
  }

  promoteItem(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    return this.operationsManager.promoteItem(itemId, typeMap);
  }

  demoteItem(itemId: string, typeMap?: Record<string, WorkItemTypeName>): WorkItemNode[] {
    return this.operationsManager.demoteItem(itemId, typeMap);
  }
}
