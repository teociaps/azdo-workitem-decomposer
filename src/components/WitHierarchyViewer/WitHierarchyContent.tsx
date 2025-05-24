import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { Tooltip } from 'azure-devops-ui/TooltipEx';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import './WitHierarchyContent.scss';

// FIX: current type path UI

interface WitHierarchyContentProps {
  selectedWit?: string; // The currently selected work item type to highlight
  className?: string; // Optional className for the root container
}

export function WitHierarchyContent({
  selectedWit: currentType,
  className = '',
}: WitHierarchyContentProps) {
  // State for reverse lookup (child -> parent)
  const [childToParentMap, setChildToParentMap] = useState<Map<string, string>>(new Map());
  // State for types without parents in the hierarchy
  const [topLevelTypes, setTopLevelTypes] = useState<string[]>([]);
  // State for loading
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Use global state context for hierarchy rules and colors
  const { workItemConfigurations, batchSetWorkItemConfigurations } = useGlobalState();

  // Initialize data if not already loaded
  useEffect(() => {
    if (workItemConfigurations.size === 0) {
      const initData = async () => {
        try {
          const { initializeWitData } = await import('../../core/common/witDataInitializer');
          const result = await initializeWitData(batchSetWorkItemConfigurations);
          if (result.success) {
            console.log(
              'WitHierarchyContent - Data initialized successfully. Updates:',
              result.updatesCount,
            );
          } else {
            console.error('WitHierarchyContent - Data initialization failed:', result.error);
          }
        } catch (err) {
          console.error('WitHierarchyContent - Failed to initialize data:', err);
        }
      };
      initData();
    }
  }, [workItemConfigurations.size, batchSetWorkItemConfigurations]);

  const hierarchyRules = useMemo(() => {
    const map = new Map<string, string[]>();
    workItemConfigurations.forEach((config, typeName) => {
      if (config.hierarchyRules) {
        map.set(typeName, config.hierarchyRules);
      }
    });
    console.log('WitHierarchyContent - workItemConfigurations size:', workItemConfigurations.size);
    console.log('WitHierarchyContent - hierarchyRules size:', map.size);
    return map;
  }, [workItemConfigurations]);

  useEffect(() => {
    // Process rules to derive child->parent map and top-level types
    const parentMap = new Map<string, string>();
    hierarchyRules.forEach((children, parent) => {
      children.forEach((child) => {
        parentMap.set(child, parent);
      });
    });
    setChildToParentMap(parentMap);
    const allParents = Array.from(hierarchyRules.keys());
    const allChildren = new Set(Array.from(hierarchyRules.values()).flat());
    const topLevel = allParents.filter((parent) => !allChildren.has(parent));
    console.log('WitHierarchyContent - allParents:', allParents);
    console.log('WitHierarchyContent - allChildren:', Array.from(allChildren));
    console.log('WitHierarchyContent - topLevel:', topLevel);
    setTopLevelTypes(topLevel);

    setIsLoading(false);
  }, [hierarchyRules]);

  /**
   * Performs a Depth-First Search (DFS) to find the path from any top-level node
   * to the targetType. Returns a set of all ancestor nodes along the path.
   * @param targetType The work item type to find the path to.
   * @param rules The hierarchy rules map (parent -> children).
   * @param startNodes The list of top-level work item types to start the search from.
   * @returns A Set containing the names of all ancestor types.
   */
  const findPathToType = useCallback(
    (
      targetType: string | undefined,
      rules: Map<string, string[]>,
      startNodes: string[],
    ): Set<string> => {
      if (!targetType) return new Set();

      const pathSet = new Set<string>(); // Stores ancestors found

      // Recursive DFS function
      function dfs(currentNode: string, currentPath: string[]): boolean {
        currentPath.push(currentNode); // Add current node to the path being explored

        // Target found! Add all nodes in the path (excluding the target itself) to the result set
        if (currentNode === targetType) {
          currentPath.slice(0, -1).forEach((node) => pathSet.add(node));
          return true;
        }

        // Explore children
        const children = rules.get(currentNode) || [];
        for (const child of children) {
          // If DFS down this branch finds the target, stop searching further
          if (dfs(child, currentPath)) {
            return true;
          }
        }

        // Backtrack: remove current node as we move back up the tree
        currentPath.pop();
        return false; // Target not found in this branch
      }

      // Start DFS from each top-level node until the target is found
      for (const startNode of startNodes) {
        if (dfs(startNode, [])) {
          break; // Stop searching once the path is found
        }
      }

      return pathSet;
    },
    [],
  );

  /**
   * Finds all sibling work item types for a given target type.
   * @param targetType The work item type whose siblings are needed.
   * @param rules The hierarchy rules map (parent -> children).
   * @param parentMap The map for child -> parent lookups.
   * @returns A Set containing the names of all sibling types.
   */
  const findSiblingsOfType = useCallback(
    (
      targetType: string | undefined,
      rules: Map<string, string[]>,
      parentMap: Map<string, string>,
    ): Set<string> => {
      if (!targetType) return new Set();

      // Find the parent of the target type
      const parent = parentMap.get(targetType);
      if (!parent) return new Set(); // No parent found (might be top-level or invalid type)

      // Get all children of the parent
      const siblings = new Set(rules.get(parent) || []);
      siblings.delete(targetType);

      return siblings;
    },
    [],
  );

  // Memoize the ancestor path calculation to avoid re-computation on every render
  const ancestorPath = useMemo(() => {
    return findPathToType(currentType, hierarchyRules, topLevelTypes);
  }, [currentType, hierarchyRules, topLevelTypes, findPathToType]);

  // Memoize the sibling set calculation
  const siblingSet = useMemo(() => {
    return findSiblingsOfType(currentType, hierarchyRules, childToParentMap);
  }, [currentType, hierarchyRules, childToParentMap, findSiblingsOfType]);

  /**
   * Recursively renders a node in the hierarchy tree and its children.
   * Applies appropriate CSS classes based on whether the node is the current type,
   * an ancestor, or a sibling.
   * @param typeName The name of the work item type to render.
   * @param level The current depth in the hierarchy (used for potential indentation/styling).
   * @returns A JSX element representing the tree node.
   */
  const renderHierarchyNode = useCallback(
    (typeName: string, level: number): JSX.Element => {
      const children = hierarchyRules.get(typeName) || [];
      const isCurrent = currentType === typeName;
      const isAncestor = ancestorPath.has(typeName);
      const isSibling = siblingSet.has(typeName);

      const typeConfig = workItemConfigurations.get(typeName);
      const typeColor = typeConfig?.color || '#808080';
      const iconUrl = typeConfig?.iconUrl;

      const nodeClasses = ['wit-hierarchy-node'];
      if (isSibling) nodeClasses.push('wit-hierarchy-sibling');

      const typeClasses = ['wit-hierarchy-type'];
      if (isCurrent) typeClasses.push('wit-hierarchy-type-current');
      if (isAncestor) typeClasses.push('wit-hierarchy-ancestor');

      return (
        <li key={typeName} className={nodeClasses.join(' ')}>
          <div className="wit-hierarchy-node-content">
            <span className="wit-hierarchy-line-connector"></span>
            <Tooltip text={isCurrent ? 'You are decomposing this work item' : typeName}>
              <span
                className={typeClasses.join(' ')}
                style={{ borderLeftColor: typeColor, display: 'flex', alignItems: 'center' }}
              >
                {iconUrl && <img className="wit-icon" src={iconUrl} alt={`${typeName} icon`} />}
                {typeName}
              </span>
            </Tooltip>
          </div>
          {/* Recursively render children if any exist */}
          {children.length > 0 && (
            <ul className="wit-hierarchy-list">
              {children.map((childType) => renderHierarchyNode(childType, level + 1))}
            </ul>
          )}
        </li>
      );
    },
    [hierarchyRules, currentType, ancestorPath, siblingSet, workItemConfigurations],
  );

  // Main content render
  return (
    <div className={`wit-hierarchy-content ${className}`.trim()}>
      {isLoading ? (
        <Spinner size={SpinnerSize.large} label="Loading hierarchy..." />
      ) : topLevelTypes.length > 0 ? (
        // Render the hierarchy list
        <ul className="wit-hierarchy-list wit-hierarchy-root">
          {topLevelTypes.map((type) => renderHierarchyNode(type, 0))}
        </ul>
      ) : (
        // Display message if no hierarchy is found/defined
        <div className="wit-hierarchy-empty">
          No work item hierarchy defined or found for this project's backlog configuration.
        </div>
      )}
    </div>
  );
}
