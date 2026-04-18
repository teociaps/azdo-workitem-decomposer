import { WorkItemConfigurationsMap, WorkItemTypeName } from '../core/models/commonTypes';
import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemHierarchyStateManager } from './workItemHierarchyStateManager';
import { logger } from '../core/common/logger';

const typeManagerLogger = logger.createChild('TypeManager');

/**
 * Manages work item types and type-related operations.
 */
export class WorkItemTypeManager {
  private workItemConfigurations: WorkItemConfigurationsMap;
  private stateManager: WorkItemHierarchyStateManager;

  constructor(
    workItemConfigurations: WorkItemConfigurationsMap,
    stateManager: WorkItemHierarchyStateManager,
  ) {
    this.workItemConfigurations = workItemConfigurations;
    this.stateManager = stateManager;
  }

  /**
   * Determines the possible child work item types for a given parent.
   * @param parentId The ID of the parent node. If undefined, assumes root (using parentWorkItemType).
   * @returns An array of possible child work item type names.
   */
  getPossibleChildTypes(parentId?: string): WorkItemTypeName[] {
    let parentNodeType: WorkItemTypeName | null = null;

    if (parentId) {
      const parentNode = this.stateManager.findNodeById(parentId);
      if (parentNode) {
        parentNodeType = parentNode.type;
      } else {
        typeManagerLogger.warn(
          `Parent node with ID ${parentId} not found when getting possible child types. Defaulting to ['Task'].`,
        );
        return ['Task']; // Fallback if specific parent not found
      }
    } else {
      parentNodeType = this.stateManager.getParentWorkItemType();
    }

    if (parentNodeType) {
      const parentConfig = this.workItemConfigurations.get(parentNodeType);
      if (parentConfig?.hierarchyRules && parentConfig.hierarchyRules.length > 0) {
        return parentConfig.hierarchyRules;
      } else if (
        parentConfig &&
        typeof parentConfig.hierarchyRules !== 'undefined' &&
        parentConfig.hierarchyRules.length === 0
      ) {
        // Explicitly defined as no children of configured types
        return [];
      } else {
        // No specific rules for this parent type, or rules are not defined
        return ['Task']; // Default fallback
      }
    } else {
      // This case means we're adding to root and parentWorkItemType was never set, or an unknown scenario
      return ['Task']; // Default for root if parentWorkItemType is not set
    }
  }

  /**
   * Gets the allowed child types for a given parent type (for error messages)
   * @param parentType The parent work item type
   * @returns Array of allowed child type names
   */
  getAllowedChildTypes(parentType: WorkItemTypeName): WorkItemTypeName[] {
    const parentConfig = this.workItemConfigurations.get(parentType);

    if (parentConfig?.hierarchyRules && parentConfig.hierarchyRules.length > 0) {
      return parentConfig.hierarchyRules;
    } else if (
      parentConfig &&
      typeof parentConfig.hierarchyRules !== 'undefined' &&
      parentConfig.hierarchyRules.length === 0
    ) {
      // Explicitly defined as no children of configured types
      return [];
    } else {
      // No specific rules defined, default to allowing Task only
      return ['Task'];
    }
  }

  /**
   * Checks if a child type can be a valid child of a parent type
   * @param childType The child work item type to check
   * @param parentType The parent work item type to check against
   * @returns True if the child type is allowed, false otherwise
   */
  canTypeBeChildOfType(childType: WorkItemTypeName, parentType: WorkItemTypeName): boolean {
    const parentConfig = this.workItemConfigurations.get(parentType);

    if (parentConfig?.hierarchyRules && parentConfig.hierarchyRules.length > 0) {
      return parentConfig.hierarchyRules.includes(childType);
    } else if (
      parentConfig &&
      typeof parentConfig.hierarchyRules !== 'undefined' &&
      parentConfig.hierarchyRules.length === 0
    ) {
      // Explicitly defined as no children of configured types
      return false;
    } else {
      // No specific rules defined, default to allowing Task only
      return childType === 'Task';
    }
  }

  /**
   * Returns possible types for a node if promoted.
   * @param itemId The ID of the item to check.
   * @returns An array of possible types.
   */
  getPossiblePromoteTypes(itemId: string): WorkItemTypeName[] {
    const node = this.stateManager.findNodeById(itemId);
    if (!node) return [];

    // Standard promotion logic (applies whether the promotion is direct or cascading):
    // The node attempts to become a sibling of its current parent.
    // Its new parent would be its current grandparent, or the root project type if its parent is a root node.
    let newPotentialParentType: WorkItemTypeName | null = null;

    if (node.parentId) {
      const parent = this.stateManager.findNodeById(node.parentId);
      if (parent) {
        if (parent.parentId) {
          const grandParent = this.stateManager.findNodeById(parent.parentId);
          if (grandParent) {
            newPotentialParentType = grandParent.type;
          }
        } else {
          newPotentialParentType = this.stateManager.getParentWorkItemType();
        }
      }
    }

    if (newPotentialParentType) {
      const config = this.workItemConfigurations.get(newPotentialParentType);
      // The node can become any type that is a valid child of this newPotentialParentType
      if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
        return config.hierarchyRules;
      }
    }

    // If the node is already a root node, or if its parent is a root node and no parentWorkItemType is defined,
    // or if the new potential parent context has no defined child types,
    // then the node cannot be promoted further by this mechanism and can only remain its current type.
    return [node.type];
  }

  /**
   * Returns possible types for a node if demoted.
   * @param itemId The ID of the item to check.
   * @param isCascading Whether this is part of a cascading operation.
   * @returns An array of possible types.
   */
  getPossibleDemoteTypes(itemId: string, isCascading = false): WorkItemTypeName[] {
    const node = this.stateManager.findNodeById(itemId);
    if (!node) return [];

    if (isCascading) {
      // If a parent item is demoted, its children might need to change type.
      // The child node can become any type that is one of its own defined child types.
      // Example: Parent Feature demotes. Child User Story needs to change.
      // Child User Story can become a Task or Bug (if these are in UserStoryConfig.hierarchyRules).
      const config = this.workItemConfigurations.get(node.type);
      if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
        return config.hierarchyRules;
      }
      return [node.type]; // If no children defined, can only be its own type.
    } else {
      // Standard demotion: Can it become a child of its preceding sibling?
      let precedingSiblingType: WorkItemTypeName | null = null;
      if (node.parentId) {
        const parent = this.stateManager.findNodeById(node.parentId);
        if (parent?.children) {
          const idx = parent.children.findIndex((c) => c.id === itemId);
          if (idx > 0) {
            precedingSiblingType = parent.children[idx - 1].type;
          }
        }
      } else {
        // Root node, check preceding sibling in the root list
        const hierarchy = this.stateManager.getHierarchyRef();
        const idx = hierarchy.findIndex((n) => n.id === itemId);
        if (idx > 0) {
          precedingSiblingType = hierarchy[idx - 1].type;
        }
      }

      if (precedingSiblingType) {
        const config = this.workItemConfigurations.get(precedingSiblingType);
        // The node can become any type that is a valid child of its preceding sibling.
        if (config?.hierarchyRules && config.hierarchyRules.length > 0) {
          return config.hierarchyRules;
        }
      }
      return [node.type]; // Cannot be demoted or no valid context.
    }
  }

  /**
   * Applies the type map to the affected nodes, updating their types and titles if necessary.
   * @param typeMap The map of node IDs to new work item types.
   */
  applyTypeMapToAffectedNodes(typeMap: Record<string, WorkItemTypeName>): void {
    for (const nodeId in typeMap) {
      if (Object.prototype.hasOwnProperty.call(typeMap, nodeId)) {
        const node = this.stateManager.findNodeById(nodeId);
        if (!node) {
          typeManagerLogger.warn(`Node with ID ${nodeId} from typeMap not found in hierarchy.`);
          continue;
        }

        const newTypeFromModal = typeMap[nodeId];
        const originalTypeBeforeModal = node.type;
        const originalTitle = node.title;

        // Only apply changes if the new type from modal is different from the current type
        if (originalTypeBeforeModal !== newTypeFromModal) {
          node.type = newTypeFromModal; // Apply the new type from modal

          // If the original title was the default for the original type, update it
          const expectedOldDefaultTitle = `New ${originalTypeBeforeModal}`;
          if (originalTitle.trim().toLowerCase() === expectedOldDefaultTitle.toLowerCase()) {
            node.title = `New ${newTypeFromModal}`;
          }
        }
      }
    }
  }

  /**
   * Recursively updates types and children based on hierarchy rules and type maps.
   * @param node The node to update
   * @param newParentNode The new parent node
   * @param typeMap Optional map of types to update
   */
  recursivelyUpdateTypeAndChildren(
    node: WorkItemNode,
    newParentNode: WorkItemNode | null,
    typeMap?: Record<string, WorkItemTypeName>,
  ): void {
    const newParentId = newParentNode ? newParentNode.id : undefined;
    const newParentTypeInfo = newParentNode
      ? `parent ${newParentNode.id} (type: ${newParentNode.type})`
      : 'root';
    const allowedChildTypes = this.getPossibleChildTypes(newParentId);

    // typeBeforeHierarchyRules is the node's type after applyTypeMapToAffectedNodes might have changed it based on modal.
    const typeBeforeHierarchyRules = node.type;
    // titleBeforeHierarchyRules is the node's title after applyTypeMapToAffectedNodes might have changed it.
    const titleBeforeHierarchyRules = node.title;

    // Check if the titleBeforeHierarchyRules was a default title for typeBeforeHierarchyRules.
    const expectedOldDefaultTitleForTypeBeforeHierarchyRules = `New ${typeBeforeHierarchyRules}`;
    const wasTitleDefaultForTypeBeforeHierarchyRules =
      titleBeforeHierarchyRules.trim().toLowerCase() ===
      expectedOldDefaultTitleForTypeBeforeHierarchyRules.toLowerCase();

    let finalEffectiveType = typeBeforeHierarchyRules;

    // Check if the user made an explicit choice for this node in the modal.
    const userMadeExplicitChoiceForThisNodeInModal =
      typeMap && Object.prototype.hasOwnProperty.call(typeMap, node.id);
    if (userMadeExplicitChoiceForThisNodeInModal) {
      // User made a choice. This choice (typeBeforeHierarchyRules) must be valid in the new location.
      if (!allowedChildTypes.includes(typeBeforeHierarchyRules as WorkItemTypeName)) {
        // This is a conflict: modal offered/user chose a type that's not actually allowed here.
        // This should ideally be prevented by the modal's logic.
        if (allowedChildTypes.length > 0) {
          finalEffectiveType = allowedChildTypes[0];
          typeManagerLogger.warn(
            `Modal-selected type ${typeBeforeHierarchyRules} for node ${
              node.id
            } is not valid as child of ${newParentTypeInfo}. Changed to ${finalEffectiveType}. Allowed: ${allowedChildTypes.join(
              ', ',
            )}`,
          );
        } else {
          this.stateManager.raiseError(
            `Modal-selected type ${typeBeforeHierarchyRules} for node ${node.id} is not valid as child of ${newParentTypeInfo}, and no other child types are allowed.`,
          );
          // Keep the problematic type, error is raised.
        }
      }
      // Else: User's explicit choice is valid, so finalEffectiveType remains typeBeforeHierarchyRules.
    } else {
      // User did NOT make an explicit choice for this node in the modal for its new position.
      // We prefer the first allowed child type if the current type isn't it, or if the current type is not allowed.
      if (allowedChildTypes.length > 0) {
        if (
          typeBeforeHierarchyRules !== allowedChildTypes[0] ||
          !allowedChildTypes.includes(typeBeforeHierarchyRules as WorkItemTypeName)
        ) {
          finalEffectiveType = allowedChildTypes[0];
        }
      } else {
        // No allowed child types for the new parent.
        this.stateManager.raiseError(
          `Node ${node.id} (type ${typeBeforeHierarchyRules}) cannot be a child of ${newParentTypeInfo} as it allows no configured child types. Type not changed by hierarchy rule.`,
        );
        // finalEffectiveType remains typeBeforeHierarchyRules
      }
    }

    node.type = finalEffectiveType;

    // If the title *before this function* was a default for the type it had *before this function*,
    // then update the title to be the default for the new finalEffectiveType.
    if (wasTitleDefaultForTypeBeforeHierarchyRules) {
      node.title = `New ${finalEffectiveType}`;
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.recursivelyUpdateTypeAndChildren(child, node, typeMap);
      }
    }
  }
}
