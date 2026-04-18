import { WorkItemNode } from '../core/models/workItemHierarchy';
import { WorkItemTypeName, WorkItemConfigurationsMap } from '../core/models/commonTypes';
import { logger } from '../core/common/logger';

const textParserLogger = logger.createChild('TextHierarchyParser');

export interface WorkItemTextParseError {
  lineNumber: number;
  line: string;
  error: string;
}

export interface WorkItemTextParseResult {
  success: boolean;
  nodes: WorkItemNode[];
  errors: WorkItemTextParseError[];
  warnings: WorkItemTextParseError[];
}

export interface WorkItemFormatTemplate {
  pattern: string;
  description: string;
  example: string;
}

/**
 * Manages parsing and validation of text-based hierarchy input
 */
export class TextHierarchyParser {
  private workItemConfigurations: WorkItemConfigurationsMap;

  constructor(workItemConfigurations: WorkItemConfigurationsMap) {
    this.workItemConfigurations = workItemConfigurations;
  }

  /**
   * Generates a work item format template based on current work item configurations
   * @param parentWorkItemType Optional parent type to generate context-specific examples
   * @returns WorkItemFormatTemplate object with pattern, description, and example
   */
  generateWorkItemFormatTemplate(parentWorkItemType?: string): WorkItemFormatTemplate {
    // Get only the types that can be created through the decomposer
    const creatableTypes = this.getCreatableWorkItemTypes();
    const allHierarchyTypes = creatableTypes.all;
    const childTypes = creatableTypes.child;

    // Filter out top-level only types that can't be created in decompositions
    let creatableInDecomposition = allHierarchyTypes.filter(
      (type) => childTypes.includes(type), // Only include types that can be children (created in decompositions)
    );

    // If parent type is provided, filter to only show valid children of that parent
    let validRootTypes = creatableInDecomposition;
    if (parentWorkItemType && this.workItemConfigurations.has(parentWorkItemType)) {
      const parentConfig = this.workItemConfigurations.get(parentWorkItemType);
      const allowedChildren = parentConfig?.hierarchyRules || [];

      if (allowedChildren.length > 0) {
        validRootTypes = creatableInDecomposition.filter((type) =>
          allowedChildren.some((allowed) => allowed.toLowerCase() === type.toLowerCase()),
        );
        // Update creatable list to prioritize valid children
        creatableInDecomposition =
          validRootTypes.length > 0 ? validRootTypes : creatableInDecomposition;
      }
    }

    // Create pattern description showing only creatable types
    const pattern = `
Hierarchy Format:
- Use dashes (-) to indicate depth level
- Follow with a space, then work item type name, then colon (:), then title
- Type names are case-insensitive but must match exactly
- No skipping depth levels (e.g., no -- directly after root)

Format: [dashes] [Type]: [Title]

Depth levels:
- Root level: No dashes
- Level 1: Single dash (-)
- Level 2: Double dash (--)
- Level 3: Triple dash (---)
- And so on...

Creatable Work Item Types (can be created in decompositions):
${creatableInDecomposition.map((type) => `- ${type}`).join('\n')}
    `.trim();

    const description = `
Text format for creating work item hierarchies. Each line represents one work item.
Use dashes to indicate parent-child relationships. Only shows types that can be created through decomposition.
    `.trim();

    // Generate example with actual creatable work item types
    let example = '';
    if (validRootTypes.length > 0) {
      // Use the first valid root type for the example
      const exampleRootType = validRootTypes[0];

      // Get children of this root type
      const rootConfig = this.workItemConfigurations.get(exampleRootType);
      const rootChildren =
        rootConfig?.hierarchyRules?.filter((child) => creatableInDecomposition.includes(child)) ||
        [];

      if (rootChildren.length > 0) {
        const primaryChild = rootChildren[0];
        const secondaryChild = rootChildren.length > 1 ? rootChildren[1] : primaryChild;

        // Check if primary child has its own children
        const childConfig = this.workItemConfigurations.get(primaryChild);
        const grandChildren =
          childConfig?.hierarchyRules?.filter((gc) => creatableInDecomposition.includes(gc)) || [];

        if (grandChildren.length > 0) {
          example = `${exampleRootType}: Implement user authentication system
- ${primaryChild}: Design authentication flow
- ${primaryChild}: Create user login functionality
-- ${grandChildren[0]}: Build login form UI
-- ${grandChildren[0]}: Implement password validation
- ${primaryChild}: Add user registration
${exampleRootType}: User profile management features`;
        } else {
          example = `${exampleRootType}: Implement user authentication system
- ${primaryChild}: Design authentication flow
- ${primaryChild}: Create user login functionality
- ${secondaryChild}: Additional implementation work
${exampleRootType}: User profile management features`;
        }
      } else {
        // Root type has no children, simple example
        example = `${exampleRootType}: Main task
${exampleRootType}: Additional task`;
      }
    } else if (creatableInDecomposition.length > 0) {
      // Fallback to generic example
      const firstType = creatableInDecomposition[0];
      const secondType =
        creatableInDecomposition.length > 1 ? creatableInDecomposition[1] : firstType;

      example = `${firstType}: Main feature implementation
- ${secondType}: Core functionality
-- ${secondType}: Implementation details
- ${secondType}: Additional requirements
${firstType}: Secondary feature enhancement`;
    } else {
      // Fallback if no creatable types are configured
      example = `User Story: Main feature implementation
- Task: Core functionality
-- Task: Implementation details
- Task: Additional requirements
User Story: Secondary feature enhancement`;
    }

    return {
      pattern,
      description,
      example: example.trim(),
    };
  }

  /**
   * Parses text input into work item hierarchy
   * @param text Input text to parse
   * @param originalAreaPath Area path to inherit
   * @param originalIterationPath Iteration path to inherit
   * @param parentWorkItemType Optional parent work item type to validate root items against
   * @returns WorkItemTextParseResult with nodes, errors, and warnings
   */
  parseWorkItemText(
    text: string,
    originalAreaPath?: string,
    originalIterationPath?: string,
    parentWorkItemType?: string,
  ): WorkItemTextParseResult {
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const errors: WorkItemTextParseError[] = [];
    const warnings: WorkItemTextParseError[] = [];
    const nodes: WorkItemNode[] = [];
    const nodeStack: { node: WorkItemNode; depth: number }[] = [];

    textParserLogger.debug('Starting text parse with', lines.length, 'lines');

    for (let i = 0; i < lines.length; i++) {
      const lineNumber = i + 1;
      const line = lines[i];

      try {
        const parseResult = this.parseLine(line, lineNumber);

        if (!parseResult.success) {
          errors.push({
            lineNumber,
            line,
            error: parseResult.error!,
          });
          continue;
        }

        const { depth, type, title } = parseResult;

        // Ensure all required fields are present
        if (depth === undefined || !type || !title) {
          errors.push({
            lineNumber,
            line,
            error: 'Failed to parse line properly',
          });
          continue;
        }

        // Validate depth progression
        if (nodeStack.length > 0) {
          const lastDepth = nodeStack[nodeStack.length - 1].depth;
          if (depth > lastDepth + 1) {
            errors.push({
              lineNumber,
              line,
              error: `Invalid depth progression. Cannot go from depth ${lastDepth} to ${depth}. Maximum allowed is ${lastDepth + 1}.`,
            });
            continue;
          }
        } else if (depth > 0) {
          errors.push({
            lineNumber,
            line,
            error:
              'First item cannot have depth indicators. Root items should start without dashes.',
          });
          continue;
        }

        // Validate work item type
        if (!this.isValidWorkItemType(type)) {
          // Get only the types that can be created through the decomposer
          const creatableTypes = this.getCreatableWorkItemTypes();
          const creatableInDecomposition = creatableTypes.all.filter((type) =>
            creatableTypes.child.includes(type),
          );

          errors.push({
            lineNumber,
            line,
            error: `Unknown work item type: "${type}". Available types that can be created in decomposer: ${creatableInDecomposition.join(', ')}`,
          });
          continue;
        }

        // Get the correctly cased work item type
        const correctType = this.getCorrectWorkItemType(type);

        // Create the node
        const node = this.createWorkItemNode(
          correctType,
          title,
          originalAreaPath,
          originalIterationPath,
        );

        // Remove items from stack that are at deeper or equal levels
        while (nodeStack.length > 0 && nodeStack[nodeStack.length - 1].depth >= depth) {
          nodeStack.pop();
        }

        // Set parent relationship if there's a parent in the stack
        if (nodeStack.length > 0) {
          const parent = nodeStack[nodeStack.length - 1].node;
          node.parentId = parent.id;
          parent.children.push(node);

          // Validate hierarchy rules
          if (!this.canBeChildOfParent(correctType, parent.type)) {
            warnings.push({
              lineNumber,
              line,
              error: `Work item type "${correctType}" may not be a valid child of "${parent.type}" according to your project's hierarchy rules.`,
            });
          }
        } else {
          // Root level item
          nodes.push(node);

          // Validate against parent work item type if provided
          if (parentWorkItemType && this.workItemConfigurations.has(parentWorkItemType)) {
            if (!this.canBeChildOfParent(correctType, parentWorkItemType)) {
              warnings.push({
                lineNumber,
                line,
                error: `Work item type "${correctType}" may not be a valid child of "${parentWorkItemType}" according to your project's hierarchy rules.`,
              });
            }
          }
        }

        // Add to stack
        nodeStack.push({ node, depth });
      } catch (error) {
        textParserLogger.error('Error parsing line', lineNumber, ':', error);
        errors.push({
          lineNumber,
          line,
          error: `Unexpected error: ${(error as Error).message}`,
        });
      }
    }

    const result: WorkItemTextParseResult = {
      success: errors.length === 0,
      nodes,
      errors,
      warnings,
    };

    textParserLogger.debug('Parse completed:', {
      success: result.success,
      nodeCount: nodes.length,
      errorCount: errors.length,
      warningCount: warnings.length,
    });

    return result;
  }

  /**
   * Parses a single line of input
   * @param line The line to parse
   * @param _lineNumber The line number for error reporting
   * @returns Parse result with depth, type, and title
   */
  private parseLine(
    line: string,
    _lineNumber: number,
  ): {
    success: boolean;
    depth?: number;
    type?: string;
    title?: string;
    error?: string;
  } {
    // Count leading dashes
    const dashMatch = line.match(/^(-*)\s*/);
    if (!dashMatch) {
      return {
        success: false,
        error: 'Invalid line format',
      };
    }

    const depth = dashMatch[1].length;
    const remainingText = line.substring(dashMatch[0].length);

    // Check for type and title separator
    const colonIndex = remainingText.indexOf(':');
    if (colonIndex === -1) {
      return {
        success: false,
        error: 'Missing colon (:) separator between work item type and title',
      };
    }

    const type = remainingText.substring(0, colonIndex).trim();
    const title = remainingText.substring(colonIndex + 1).trim();

    if (!type) {
      return {
        success: false,
        error: 'Work item type cannot be empty',
      };
    }

    if (!title) {
      return {
        success: false,
        error: 'Work item title cannot be empty',
      };
    }

    return {
      success: true,
      depth,
      type,
      title,
    };
  }

  /**
   * Creates a new WorkItemNode
   */
  private createWorkItemNode(
    type: WorkItemTypeName,
    title: string,
    areaPath?: string,
    iterationPath?: string,
  ): WorkItemNode {
    return {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      title,
      type,
      children: [],
      canPromote: false,
      canDemote: false,
      areaPath,
      iterationPath,
    };
  }

  /**
   * Validates if a work item type exists in configurations
   */
  private isValidWorkItemType(type: string): boolean {
    // Case-insensitive check
    const normalizedType = type.toLowerCase();
    return Array.from(this.workItemConfigurations.keys()).some(
      (configType) => configType.toLowerCase() === normalizedType,
    );
  }

  /**
   * Gets the correctly cased work item type name
   */
  private getCorrectWorkItemType(type: string): WorkItemTypeName {
    const normalizedType = type.toLowerCase();
    const found = Array.from(this.workItemConfigurations.keys()).find(
      (configType) => configType.toLowerCase() === normalizedType,
    );
    return found || type;
  }

  /**
   * Checks if child type can be a child of parent type based on hierarchy rules
   */
  private canBeChildOfParent(childType: string, parentType: string): boolean {
    const parentConfig = this.workItemConfigurations.get(parentType);
    if (!parentConfig || !parentConfig.hierarchyRules) {
      return true; // No rules means allow anything
    }

    // Case-insensitive check
    const normalizedChildType = childType.toLowerCase();
    return parentConfig.hierarchyRules.some((rule) => rule.toLowerCase() === normalizedChildType);
  }

  /**
   * Gets organized information about creatable work item types
   * @returns Object with root types, child types, and all available types that can be used in hierarchies
   */
  getCreatableWorkItemTypes(): {
    root: WorkItemTypeName[];
    child: WorkItemTypeName[];
    all: WorkItemTypeName[];
  } {
    // Build hierarchy relationships like in WitSettingsSection
    const allHierarchyTypes = new Set<string>();
    const childTypes = new Set<string>();

    this.workItemConfigurations.forEach((config, typeName) => {
      if (config.hierarchyRules && config.hierarchyRules.length > 0) {
        // This type has children, so it participates in hierarchies
        allHierarchyTypes.add(typeName);

        // Add all its children to both sets
        config.hierarchyRules.forEach((childType) => {
          allHierarchyTypes.add(childType);
          childTypes.add(childType);
        });
      }
    });

    // Root types are those that are not children of any other type
    const rootTypes = Array.from(allHierarchyTypes).filter((type) => !childTypes.has(type));

    return {
      root: rootTypes,
      child: Array.from(childTypes),
      all: Array.from(allHierarchyTypes), // Only types that participate in hierarchies
    };
  }

  /**
   * Generates comprehensive decomposition examples showing complete hierarchies
   * @returns Array of examples showing what can be created under each decomposable type
   */
  generateDecompositionExamples(): { parentType: string; example: string }[] {
    const examples: { parentType: string; example: string }[] = [];

    // For each type that has hierarchy rules (can be decomposed)
    this.workItemConfigurations.forEach((config, parentType) => {
      if (config.hierarchyRules && config.hierarchyRules.length > 0) {
        const directChildren = config.hierarchyRules;

        // Generate comprehensive example showing complete hierarchy
        let example = '';
        const usedLines: string[] = [];

        // Start with first child type and build full hierarchy
        const primaryChild = directChildren[0];
        usedLines.push(`${primaryChild}: Main ${primaryChild.toLowerCase()}`);

        // Check if this child can have its own children (build deeper hierarchy)
        const childConfig = this.workItemConfigurations.get(primaryChild);
        if (childConfig?.hierarchyRules && childConfig.hierarchyRules.length > 0) {
          const grandChildren = childConfig.hierarchyRules;
          const primaryGrandChild = grandChildren[0];

          usedLines.push(`- ${primaryGrandChild}: Sub-${primaryGrandChild.toLowerCase()}`);

          // Check for great-grandchildren (third level)
          const grandChildConfig = this.workItemConfigurations.get(primaryGrandChild);
          if (grandChildConfig?.hierarchyRules && grandChildConfig.hierarchyRules.length > 0) {
            const greatGrandChild = grandChildConfig.hierarchyRules[0];
            usedLines.push(`-- ${greatGrandChild}: Nested ${greatGrandChild.toLowerCase()}`);

            // Check for fourth level if exists
            const greatGrandChildConfig = this.workItemConfigurations.get(greatGrandChild);
            if (
              greatGrandChildConfig?.hierarchyRules &&
              greatGrandChildConfig.hierarchyRules.length > 0
            ) {
              const fourthLevel = greatGrandChildConfig.hierarchyRules[0];
              usedLines.push(`--- ${fourthLevel}: Deep nested ${fourthLevel.toLowerCase()}`);
            }
          }

          // Add more grandchildren if available
          if (grandChildren.length > 1) {
            usedLines.push(`- ${grandChildren[1]}: Another ${grandChildren[1].toLowerCase()}`);
          }
        }

        // Add another primary child
        usedLines.push(`${primaryChild}: Second ${primaryChild.toLowerCase()}`);

        // Add other child types if available
        if (directChildren.length > 1) {
          const secondaryChild = directChildren[1];
          usedLines.push(`${secondaryChild}: Related ${secondaryChild.toLowerCase()}`);

          // Show hierarchy for secondary child if it has children
          const secondaryChildConfig = this.workItemConfigurations.get(secondaryChild);
          if (
            secondaryChildConfig?.hierarchyRules &&
            secondaryChildConfig.hierarchyRules.length > 0
          ) {
            usedLines.push(
              `- ${secondaryChildConfig.hierarchyRules[0]}: Sub-item for ${secondaryChild.toLowerCase()}`,
            );
          }
        }

        // Add third child type if available (but limit to avoid too long examples)
        if (directChildren.length > 2) {
          usedLines.push(`${directChildren[2]}: Additional ${directChildren[2].toLowerCase()}`);
        }

        example = usedLines.join('\n');

        examples.push({
          parentType,
          example: example.trim(),
        });
      }
    });

    return examples;
  }

  /**
   * Gets format reference for hierarchy text input
   * @returns Array of format reference items
   */
  getFormatReference(): { code: string; description: string }[] {
    return [
      { code: 'Type: Title', description: 'root level item' },
      { code: '- Type: Title', description: '1st level child' },
      { code: '-- Type: Title', description: '2nd level child' },
      { code: '--- Type: Title', description: '3rd level child' },
    ];
  }

  /**
   * Updates the work item configurations
   */
  updateConfigurations(configurations: WorkItemConfigurationsMap): void {
    this.workItemConfigurations = configurations;
  }
}
