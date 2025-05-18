import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemTypeName } from '../core/models/commonTypes';
import { cloneDeep } from 'lodash';
import { WorkItemNodeFinder } from './workItemNodeFinder';

/**
 * Manages the state of the work item hierarchy.
 */
export class WorkItemHierarchyStateManager {
  private hierarchy: WorkItemNode[] = [];
  private parentWorkItemType: WorkItemTypeName | null = null;
  private hierarchyCount: number = 0;
  private errorHandler?: (error: string) => void;

  constructor(
    initialHierarchy: WorkItemNode[] = [],
    parentWorkItemType?: WorkItemTypeName,
    errorHandler?: (error: string) => void,
  ) {
    this.hierarchy = initialHierarchy ? cloneDeep(initialHierarchy) : [];
    this.parentWorkItemType = parentWorkItemType || null;
    this.hierarchyCount = WorkItemNodeFinder.countNodesRecursive(this.hierarchy);
    this.errorHandler = errorHandler;
  }

  /**
   * Raises an error through the provided error handler or console.
   */
  raiseError(message: string): void {
    if (this.errorHandler) {
      this.errorHandler(message);
    } else {
      console.error(message);
    }
  }

  /**
   * Sets the type of the root parent work item.
   * @param type The work item type string.
   */
  setParentWorkItemType(type: WorkItemTypeName): void {
    this.parentWorkItemType = type;
  }

  /**
   * Gets the type of the root parent work item.
   * @returns The work item type string, or null if not set.
   */
  getParentWorkItemType(): WorkItemTypeName | null {
    return this.parentWorkItemType;
  }

  /**
   * Returns the current hierarchy state.
   */
  getHierarchy(): WorkItemNode[] {
    return cloneDeep(this.hierarchy); // Return a copy to prevent direct mutation
  }

  /**
   * Returns the current count of all nodes in the hierarchy.
   */
  getHierarchyCount(): number {
    return this.hierarchyCount;
  }

  /**
   * Sets the initial hierarchy.
   * @param nodes The initial hierarchy nodes.
   * @param parentWorkItemType The type of the root parent work item.
   */
  setInitialHierarchy(nodes: WorkItemNode[], parentWorkItemType?: WorkItemTypeName): void {
    this.hierarchy = cloneDeep(nodes);
    this.parentWorkItemType = parentWorkItemType || null;
    this.hierarchyCount = WorkItemNodeFinder.countNodesRecursive(this.hierarchy);
  }

  /**
   * Clears the hierarchy and resets the state.
   */
  clearHierarchy(): void {
    this.hierarchy = [];
    this.hierarchyCount = 0;
  }

  /**
   * Finds a node within the hierarchy by its temporary ID.
   * @param id The temporary ID of the node to find.
   * @returns The found node or null.
   */
  findNodeById(id: string): WorkItemNode | null {
    return WorkItemNodeFinder.findNodeRecursive(this.hierarchy, id);
  }

  /**
   * Updates the hierarchy count based on add or remove operations
   * @param change The change in count (positive for add, negative for remove)
   */
  updateHierarchyCount(change: number): void {
    this.hierarchyCount += change;
  }

  /**
   * Gets the raw hierarchy reference (not cloned).
   * This should be used carefully and only by the related managers.
   */
  getHierarchyRef(): WorkItemNode[] {
    return this.hierarchy;
  }

  /**
   * Updates the title of an item in the hierarchy.
   * @param itemId The temporary ID of the item to update.
   * @param newTitle The new title string.
   * @returns The updated hierarchy.
   */
  updateItemTitle(itemId: string, newTitle: string): WorkItemNode[] {
    const node = this.findNodeById(itemId);
    if (node) {
      node.title = newTitle;
    }
    return this.getHierarchy();
  }
}
