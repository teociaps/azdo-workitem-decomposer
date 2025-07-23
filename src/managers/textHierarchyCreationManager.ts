import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemConfigurationsMap } from '../core/models/commonTypes';
import {
  TextHierarchyParser,
  WorkItemTextParseResult,
  WorkItemTextParseError,
} from './textHierarchyParser';
import { WorkItemHierarchyManager } from './workItemHierarchyManager';
import { logger } from '../core/common/logger';

const textCreationLogger = logger.createChild('TextHierarchyCreation');

export interface WorkItemHierarchyCreationResult {
  success: boolean;
  updatedHierarchy?: WorkItemNode[];
  errors?: string[];
  warnings?: string[];
  createdItemsCount?: number;
}

/**
 * Manages creation of work item hierarchy from text input
 * Simplified to focus on core parsing and validation functionality
 */
export class TextHierarchyCreationManager {
  private hierarchyManager: WorkItemHierarchyManager;
  private parser: TextHierarchyParser;

  constructor(
    hierarchyManager: WorkItemHierarchyManager,
    workItemConfigurations: WorkItemConfigurationsMap,
  ) {
    this.hierarchyManager = hierarchyManager;
    this.parser = new TextHierarchyParser(workItemConfigurations);
  }

  /**
   * Creates work item hierarchy from provided text with validation
   * Main entry point for text-to-hierarchy conversion
   */
  createWorkItemHierarchyFromText(text: string): WorkItemHierarchyCreationResult {
    try {
      if (!text?.trim()) {
        return {
          success: false,
          errors: ['Input text is empty.'],
        };
      }

      // Quick validation for minimum format requirements
      const trimmedText = text.trim();
      if (!trimmedText.includes(':')) {
        return {
          success: false,
          errors: [
            'Text must contain work items in the format "Type: Title". No colon (:) separators found.',
          ],
        };
      }

      // Get current area and iteration paths for inheritance
      const currentHierarchy = this.hierarchyManager.getHierarchy();
      let areaPath: string | undefined;
      let iterationPath: string | undefined;

      if (currentHierarchy.length > 0) {
        areaPath = currentHierarchy[0].areaPath;
        iterationPath = currentHierarchy[0].iterationPath;
      }

      // Parse and validate the text
      const parseResult: WorkItemTextParseResult = this.parser.parseWorkItemText(
        trimmedText,
        areaPath,
        iterationPath,
      );

      if (!parseResult.success) {
        const errorMessages = parseResult.errors.map(
          (error: WorkItemTextParseError) => `Line ${error.lineNumber}: ${error.error}`,
        );

        return {
          success: false,
          errors: errorMessages,
          warnings: parseResult.warnings.map(
            (warning: WorkItemTextParseError) => `Line ${warning.lineNumber}: ${warning.error}`,
          ),
        };
      }

      if (parseResult.nodes.length === 0) {
        return {
          success: false,
          errors: ['No valid work items found in the input text.'],
        };
      }

      // Add the parsed nodes to the current hierarchy
      const updatedHierarchy = this.addNodesToHierarchy(parseResult.nodes);

      const result: WorkItemHierarchyCreationResult = {
        success: true,
        updatedHierarchy,
        createdItemsCount: this.countNodesRecursive(parseResult.nodes),
      };

      // Include warnings if any
      if (parseResult.warnings.length > 0) {
        result.warnings = parseResult.warnings.map(
          (warning: WorkItemTextParseError) => `Line ${warning.lineNumber}: ${warning.error}`,
        );
      }

      textCreationLogger.debug('Successfully created hierarchy from text:', {
        nodeCount: parseResult.nodes.length,
        warningCount: parseResult.warnings.length,
      });

      return result;
    } catch (error) {
      textCreationLogger.error('Error creating hierarchy from text:', error);
      return {
        success: false,
        errors: [`Failed to create hierarchy: ${(error as Error).message}`],
      };
    }
  }

  /**
   * Updates the work item configurations for the parser
   */
  updateConfigurations(configurations: WorkItemConfigurationsMap): void {
    this.parser.updateConfigurations(configurations);
  }

  /**
   * Adds parsed nodes to the current hierarchy
   */
  private addNodesToHierarchy(nodes: WorkItemNode[]): WorkItemNode[] {
    const currentHierarchy = this.hierarchyManager.getHierarchy();

    // Simply append the new nodes to the current hierarchy
    // The parser has already built the correct parent-child relationships
    const newHierarchy = [...currentHierarchy, ...nodes];

    // Set the new hierarchy in the manager
    this.hierarchyManager.setInitialHierarchy(
      newHierarchy,
      this.hierarchyManager.getParentWorkItemType() || undefined,
    );

    return this.hierarchyManager.getHierarchy();
  }

  /**
   * Counts nodes recursively including all children
   */
  private countNodesRecursive(nodes: WorkItemNode[]): number {
    let count = 0;
    for (const node of nodes) {
      count++; // Count the current node
      if (node.children && node.children.length > 0) {
        count += this.countNodesRecursive(node.children); // Count children recursively
      }
    }
    return count;
  }
}
