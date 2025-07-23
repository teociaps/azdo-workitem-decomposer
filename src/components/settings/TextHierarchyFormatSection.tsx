import React, { useState, useMemo, useEffect } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { TextField, TextFieldWidth } from 'azure-devops-ui/TextField';
import { FormItem } from 'azure-devops-ui/FormItem';
import { Button } from 'azure-devops-ui/Button';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { TextHierarchyParser } from '../../managers/textHierarchyParser';
import { logger } from '../../core/common/logger';
import './TextHierarchyFormatSection.scss';

const formatSectionLogger = logger.createChild('TextHierarchyFormatSection');

interface TextHierarchyFormatSectionProps {
  onRefresh?: () => Promise<void>;
}

interface ParsedTemplate {
  description: string;
  pattern: string;
  example: string;
  availableTypes: string[];
  creatableTypes: { root: string[]; child: string[] };
  creatableInDecomposition: string[];
  decompositionExamples: { parentType: string; example: string; description: string }[];
}

export function TextHierarchyFormatSection({
  onRefresh: _onRefresh,
}: TextHierarchyFormatSectionProps) {
  const { workItemConfigurations } = useGlobalState();
  const [selectedTab, setSelectedTab] = useState('guide');
  const [expandedExamples, setExpandedExamples] = useState<{ [parentType: string]: boolean }>({});
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);

  // Memoize parser to avoid recreation on each render
  const parser = useMemo(() => {
    return workItemConfigurations.size > 0 ? new TextHierarchyParser(workItemConfigurations) : null;
  }, [workItemConfigurations]);

  // Parse template and extract work item type information
  useEffect(() => {
    if (parser) {
      try {
        const templateData = parser.generateWorkItemFormatTemplate();
        const creatableTypes = parser.getCreatableWorkItemTypes();
        const decompositionExamples = parser.generateDecompositionExamples();

        // Calculate types that can be created in decompositions (exclude top-level only)
        const creatableInDecomposition = creatableTypes.all.filter((type) =>
          creatableTypes.child.includes(type),
        );

        // Enhance examples with descriptions
        const enhancedExamples = decompositionExamples.map((example) => ({
          ...example,
          description: `Complete hierarchy showing all levels when decomposing a ${example.parentType}. Each dash (-) represents one level deeper in the hierarchy.`,
        }));

        const newParsedTemplate: ParsedTemplate = {
          description: templateData.description,
          pattern: templateData.pattern,
          example: templateData.example,
          availableTypes: creatableTypes.all,
          creatableTypes: {
            root: creatableTypes.root,
            child: creatableTypes.child,
          },
          creatableInDecomposition,
          decompositionExamples: enhancedExamples,
        };

        setParsedTemplate(newParsedTemplate);
        formatSectionLogger.debug('Updated format template from hierarchy changes');
      } catch (error) {
        formatSectionLogger.error('Error parsing template data:', error);
        setParsedTemplate(null);
      }
    } else {
      setParsedTemplate(null);
    }
  }, [parser]);

  const toggleSection = (sectionKey: string) => {
    setExpandedExamples((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }));
  };

  // Helper function to order types hierarchically (top-level first, then their children)
  const getHierarchicalOrder = useMemo(() => {
    if (!parsedTemplate) return { orderedTypes: [], orderedExamples: [] };

    const { creatableTypes, decompositionExamples } = parsedTemplate;
    const orderedTypes: string[] = [];
    const orderedExamples: typeof decompositionExamples = [];
    const processedTypes = new Set<string>();

    // Helper to recursively add types and their children
    const addTypeAndChildren = (typeName: string, depth = 0) => {
      if (processedTypes.has(typeName)) return;
      processedTypes.add(typeName);

      // Add the type to ordered list
      orderedTypes.push(typeName);

      // Add its example if it exists
      const example = decompositionExamples.find((ex) => ex.parentType === typeName);
      if (example) {
        orderedExamples.push(example);
      }

      // Find and add its children
      const config = workItemConfigurations.get(typeName);
      if (config?.hierarchyRules) {
        config.hierarchyRules.forEach((childType) => {
          addTypeAndChildren(childType, depth + 1);
        });
      }
    };

    // Start with top-level types (those that can't be created as children)
    const topLevelTypes = creatableTypes.root.filter(
      (type) => !creatableTypes.child.includes(type),
    );

    topLevelTypes.forEach((type) => addTypeAndChildren(type));

    // Add any remaining types that might be both root and child
    creatableTypes.root.forEach((type) => addTypeAndChildren(type));

    return { orderedTypes, orderedExamples };
  }, [parsedTemplate, workItemConfigurations]);

  return (
    <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
      <div>
        <FormItem className="margin-bottom-16">
          <HeaderTitle titleSize={TitleSize.Large}>Text Hierarchy Format</HeaderTitle>
          <p className="secondary-text margin-bottom-8">
            Create work item hierarchies by pasting formatted text. The format automatically adapts
            to your project's work item type configuration.
          </p>
        </FormItem>

        <TabBar
          className="text-hierarchy-format-tab-bar margin-bottom-16"
          onSelectedTabChanged={setSelectedTab}
          selectedTabId={selectedTab}
          tabSize={TabSize.Tall}
        >
          <Tab name="Quick Guide" id="guide" />
          <Tab name="Examples" id="examples" />
          <Tab name="Type Reference" id="types" />
          <Tab name="AI Assistant" id="ai" />
        </TabBar>

        {selectedTab === 'guide' && (
          <div>
            <div className="margin-bottom-16">
              <h4 className="margin-bottom-8">Text Format Template</h4>
              <div className="template-display">
                <div className="template-line">
                  <code>WorkItemType: Title</code>
                </div>
                <div className="template-line">
                  <code>- WorkItemType: Child title</code>
                </div>
                <div className="template-line">
                  <code>-- WorkItemType: Deeper child title</code>
                </div>
                <div className="template-line">
                  <code>--- WorkItemType: Even deeper title</code>
                </div>
              </div>
            </div>

            <div className="margin-bottom-16">
              <h4 className="margin-bottom-8">Format Rules</h4>
              <ul className="rules-list">
                <li>Each line creates one work item</li>
                <li>
                  Format: <code>Type: Title</code>
                </li>
                <li>Use dashes (-) for hierarchy depth</li>
                <li>More dashes = deeper nesting</li>
                <li>No limit on nesting levels</li>
              </ul>
            </div>

            <div className="margin-bottom-16">
              <h4 className="margin-bottom-8">How to Use</h4>
              <ol className="usage-steps">
                <li>Write your hierarchy using the format above</li>
                <li>Copy the text to clipboard</li>
                <li>Go to main decomposer panel</li>
                <li>
                  Paste with <strong>Ctrl+V</strong>
                </li>
                <li>Review and create the hierarchy</li>
              </ol>
            </div>

            {parsedTemplate && parsedTemplate.creatableInDecomposition.length > 0 && (
              <div className="margin-bottom-16">
                <h4 className="margin-bottom-8">Available Work Item Types</h4>
                <div className="types-available">
                  {parsedTemplate.creatableInDecomposition.join(', ')}
                </div>
                <div className="secondary-text margin-top-8">
                  Use these exact type names in your text format.
                </div>
              </div>
            )}
          </div>
        )}

        {selectedTab === 'examples' && (
          <div>
            {parsedTemplate ? (
              <>
                <div className="margin-bottom-16">
                  <h4 className="margin-bottom-8">Complete Hierarchy Examples:</h4>
                  <div className="margin-bottom-12 secondary-text">
                    See exactly what you can create when decomposing each work item type, ordered
                    from top-level items down to their children.
                  </div>
                </div>

                {getHierarchicalOrder.orderedExamples.length > 0 ? (
                  <div className="decomposition-examples">
                    {getHierarchicalOrder.orderedExamples.map((decomp) => (
                      <Card
                        key={decomp.parentType}
                        className="accordion-section margin-bottom-12"
                        contentProps={{ className: 'flex-column' }}
                      >
                        <Button
                          text={`Decomposing: ${decomp.parentType}`}
                          iconProps={{
                            iconName: expandedExamples[decomp.parentType]
                              ? 'ChevronDown'
                              : 'ChevronRight',
                          }}
                          onClick={() => toggleSection(decomp.parentType)}
                          subtle
                          className="accordion-header width-100"
                        />
                        {expandedExamples[decomp.parentType] && (
                          <div className="accordion-content padding-16">
                            <div className="secondary-text margin-bottom-12">
                              {decomp.description}
                            </div>
                            <TextField
                              value={decomp.example}
                              multiline
                              rows={Math.min(decomp.example.split('\n').length + 1, 8)}
                              width={TextFieldWidth.auto}
                              readOnly
                              className="text-hierarchy-format-display"
                              inputClassName="text-hierarchy-format-input"
                            />
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="secondary-text">
                    No decomposition examples available. Your project may not have configured
                    hierarchical work item types.
                  </div>
                )}
              </>
            ) : (
              <div className="secondary-text">
                Loading examples... Please wait for the system to initialize.
              </div>
            )}
          </div>
        )}

        {selectedTab === 'types' && (
          <div>
            {parsedTemplate ? (
              <>
                <div className="margin-bottom-16">
                  <h4 className="margin-bottom-8">Work Item Type Capabilities:</h4>
                  <div className="margin-bottom-12 secondary-text">
                    Organized from top-level types down through the hierarchy.
                  </div>
                  <div className="wit-types-list">
                    {getHierarchicalOrder.orderedTypes.length > 0 ? (
                      getHierarchicalOrder.orderedTypes.map((type) => {
                        const isTopLevel = parsedTemplate.creatableTypes.root.includes(type);
                        const isChildType = parsedTemplate.creatableTypes.child.includes(type);

                        // Determine hierarchy level for visual indentation
                        let hierarchyLevel = 0;
                        let currentType = type;
                        const visited = new Set();

                        while (currentType && !visited.has(currentType)) {
                          visited.add(currentType);
                          let parentFound = false;

                          workItemConfigurations.forEach((config, parentType) => {
                            if (
                              config.hierarchyRules?.includes(currentType) &&
                              parentType !== currentType
                            ) {
                              hierarchyLevel++;
                              currentType = parentType;
                              parentFound = true;
                            }
                          });

                          if (!parentFound) break;
                        }

                        return (
                          <div
                            key={type}
                            className="wit-type-item"
                            style={{ marginLeft: `${hierarchyLevel * 16}px` }}
                          >
                            <strong>{type}</strong>
                            {isTopLevel && !isChildType && (
                              <span className="secondary-text margin-left-8">
                                (Top-level - decompose only)
                              </span>
                            )}
                            {isChildType && !isTopLevel && (
                              <span className="secondary-text margin-left-8">
                                (Child type - create in hierarchies)
                              </span>
                            )}
                            {isChildType && isTopLevel && (
                              <span className="secondary-text margin-left-8">
                                (Flexible - decompose or create)
                              </span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="secondary-text">No hierarchy-capable types found</div>
                    )}
                  </div>
                </div>

                <div className="secondary-text font-size-s">
                  <p>
                    <strong>Note:</strong> The hierarchy flows from top-level types (that start
                    projects) down to child types (that get created within decompositions).
                    Indentation shows the natural parent-child relationships.
                  </p>
                </div>
              </>
            ) : (
              <div className="secondary-text">Type information is loading...</div>
            )}
          </div>
        )}

        {selectedTab === 'ai' && (
          <div>
            <div className="margin-bottom-16">
              <h4 className="margin-bottom-8">AI-Powered Hierarchy Generation</h4>
              <p className="secondary-text">
                Use ChatGPT, Claude, or other AI assistants to generate work item hierarchies
                instantly. Just describe your project and let AI create the formatted text for you.
              </p>
            </div>

            <div className="margin-bottom-24">
              <h4 className="margin-bottom-12">Step 1: Take Schema Screenshot</h4>
              <div className="ai-schema-section">
                <div className="schema-description margin-bottom-12">
                  Take a screenshot of the work item type hierarchy schema displayed at the top of
                  this settings page. This visual schema shows the parent-child relationships that
                  the AI needs to understand.
                </div>
                <div className="schema-note">
                  <strong>Why a screenshot?</strong> The visual hierarchy diagram helps AI
                  understand the exact parent-child relationships and generates more accurate work
                  item structures.
                </div>
              </div>
            </div>

            <div className="margin-bottom-24">
              <h4 className="margin-bottom-12">Step 2: Choose Your Starting Work Item</h4>
              <div className="ai-prompt-section">
                <div className="prompt-description margin-bottom-12">
                  Decide which work item you're decomposing. This becomes your "parent" and the AI
                  will generate its complete hierarchy:
                </div>
                {parsedTemplate && getHierarchicalOrder.orderedTypes.length > 0 ? (
                  <div className="decomposition-examples-ai">
                    {getHierarchicalOrder.orderedTypes
                      .slice(0, 3)
                      .map((type) => {
                        const getAllDescendants = (
                          parentType: string,
                          visited = new Set<string>(),
                        ): string[] => {
                          if (visited.has(parentType)) return [];
                          visited.add(parentType);

                          const config = workItemConfigurations.get(parentType);
                          const directChildren = config?.hierarchyRules || [];
                          const allDescendants = [...directChildren];

                          directChildren.forEach((child) => {
                            const childDescendants = getAllDescendants(child, new Set(visited));
                            allDescendants.push(...childDescendants);
                          });

                          return [...new Set(allDescendants)];
                        };

                        const allChildren = getAllDescendants(type);

                        if (allChildren.length > 0) {
                          return (
                            <div key={type} className="decomposition-scenario">
                              <strong>Decomposing a {type}:</strong> AI generates complete hierarchy
                              including {allChildren.slice(0, 4).join(', ')}
                              {allChildren.length > 4
                                ? `, and ${allChildren.length - 4} more types`
                                : ''}
                            </div>
                          );
                        }
                        return null;
                      })
                      .filter(Boolean)}
                  </div>
                ) : (
                  <div className="secondary-text">
                    Decomposition scenarios will appear when work item types are loaded...
                  </div>
                )}
              </div>
            </div>

            <div className="margin-bottom-24">
              <h4 className="margin-bottom-12">Step 3: AI Prompt Template</h4>
              <div className="ai-prompt-section">
                <div className="prompt-description margin-bottom-12">
                  Choose your approach and use the appropriate template:
                </div>

                <div className="ai-approach-section margin-bottom-16">
                  <h5 className="margin-bottom-8">
                    <strong>Approach 1: Decompose Specific Work Item (Recommended)</strong>
                  </h5>
                  <div className="approach-description margin-bottom-12">
                    Best for when you have a specific parent work item and want AI to generate its
                    children only.
                  </div>
                  <div className="ai-prompt-box">
                    <div className="prompt-content">
                      <div className="prompt-line">
                        I'm decomposing a [WORK ITEM TYPE] called "[WORK ITEM TITLE]" for [PROJECT
                        DESCRIPTION].
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">
                        Please generate child work items using this hierarchy (see attached
                        screenshot).
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">Format: Type: Title</div>
                      <div className="prompt-line">
                        Use dashes (-) for nesting: -, --, ---, etc.
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">
                        DO NOT include the parent work item in the output - only generate its
                        children.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ai-approach-section">
                  <h5 className="margin-bottom-8">
                    <strong>Approach 2: Generate Complete Project Hierarchy</strong>
                  </h5>
                  <div className="approach-description margin-bottom-12">
                    Perfect when you want AI to create an entire project structure from scratch. You
                    create the top-level item manually, then paste the complete child hierarchy.
                  </div>
                  <div className="ai-prompt-box">
                    <div className="prompt-content">
                      <div className="prompt-line">
                        Create a complete work item hierarchy for [PROJECT DESCRIPTION].
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">
                        Use this work item type hierarchy (see attached screenshot).
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">Format: Type: Title</div>
                      <div className="prompt-line">
                        Use dashes (-) for nesting: -, --, ---, etc.
                      </div>
                      <div className="prompt-line"> </div>
                      <div className="prompt-line">
                        DO NOT include the top-level parent item - generate the complete child
                        hierarchy starting from the first level children.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="margin-bottom-24">
              <h4 className="margin-bottom-12">Example AI Conversation</h4>
              <div className="ai-example-section">
                {parsedTemplate && getHierarchicalOrder.orderedTypes.length > 0 ? (
                  <>
                    <div className="ai-message user-message">
                      <div className="message-label">You:</div>
                      <div className="message-content">
                        I'm decomposing a {getHierarchicalOrder.orderedTypes[0]} called "User
                        Authentication System" for an e-commerce mobile app.
                        <br />
                        <br />
                        Please generate child work items using this hierarchy (see attached
                        screenshot).
                        <br />
                        <br />
                        Format: Type: Title
                        <br />
                        Use dashes (-) for nesting: -, --, ---, etc.
                        <br />
                        <br />
                        DO NOT include the parent {getHierarchicalOrder.orderedTypes[0]} in the
                        output - only generate its children.
                      </div>
                    </div>
                    <div className="ai-message ai-response">
                      <div className="message-label">AI Response:</div>
                      <div className="message-content">
                        <code>
                          {(() => {
                            const parentType = getHierarchicalOrder.orderedTypes[0];
                            const config = workItemConfigurations.get(parentType);
                            const childTypes = config?.hierarchyRules || [];

                            if (childTypes.length === 0)
                              return 'No child types configured for this work item type.';

                            const generateCorrectHierarchy = (): React.ReactNode[] => {
                              const elements: React.ReactNode[] = [];
                              let keyCounter = 0;

                              // Generate realistic hierarchy following the format rules
                              if (childTypes.length > 0) {
                                const firstChild = childTypes[0];
                                const firstChildConfig = workItemConfigurations.get(firstChild);
                                const grandchildren = firstChildConfig?.hierarchyRules || [];

                                // First level children (single dash)
                                elements.push(
                                  <React.Fragment key={keyCounter++}>
                                    {firstChild}: User Registration
                                    <br />
                                  </React.Fragment>,
                                );

                                if (grandchildren.length > 0) {
                                  const grandchild = grandchildren[0];
                                  const grandchildConfig = workItemConfigurations.get(grandchild);
                                  const greatGrandchildren = grandchildConfig?.hierarchyRules || [];

                                  // Second level (double dash)
                                  elements.push(
                                    <React.Fragment key={keyCounter++}>
                                      - {grandchild}: Design registration form
                                      <br />
                                    </React.Fragment>,
                                  );
                                  elements.push(
                                    <React.Fragment key={keyCounter++}>
                                      - {grandchild}: Implement email validation
                                      <br />
                                    </React.Fragment>,
                                  );

                                  if (greatGrandchildren.length > 0) {
                                    const greatGrandchild = greatGrandchildren[0];
                                    // Third level (triple dash)
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        -- {greatGrandchild}: Create form layout
                                        <br />
                                      </React.Fragment>,
                                    );
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        -- {greatGrandchild}: Add input validation
                                        <br />
                                      </React.Fragment>,
                                    );
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        -- {greatGrandchild}: Fix styling issues
                                        <br />
                                      </React.Fragment>,
                                    );
                                  }
                                }

                                // Add second main feature
                                if (childTypes.length > 1) {
                                  const secondChild = childTypes[1];
                                  elements.push(
                                    <React.Fragment key={keyCounter++}>
                                      {secondChild}: User Login
                                      <br />
                                    </React.Fragment>,
                                  );

                                  if (grandchildren.length > 0) {
                                    const grandchild = grandchildren[0];
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        - {grandchild}: Create login interface
                                        <br />
                                      </React.Fragment>,
                                    );
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        - {grandchild}: Implement session management
                                        <br />
                                      </React.Fragment>,
                                    );
                                  }
                                } else if (childTypes.length === 1) {
                                  // If only one child type, add another instance
                                  elements.push(
                                    <React.Fragment key={keyCounter++}>
                                      {firstChild}: Password Reset
                                      <br />
                                    </React.Fragment>,
                                  );

                                  if (grandchildren.length > 0) {
                                    const grandchild = grandchildren[0];
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        - {grandchild}: Design reset flow
                                        <br />
                                      </React.Fragment>,
                                    );
                                    elements.push(
                                      <React.Fragment key={keyCounter++}>
                                        - {grandchild}: Implement email system
                                        <br />
                                      </React.Fragment>,
                                    );
                                  }
                                }
                              }

                              return elements;
                            };

                            return generateCorrectHierarchy();
                          })()}
                        </code>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="secondary-text">
                    Example conversation will appear when work item types are loaded...
                  </div>
                )}
              </div>
            </div>

            <div className="margin-bottom-16">
              <h4 className="margin-bottom-12">Step 4: Copy & Paste</h4>
              <ol className="ai-steps">
                <li>Copy the AI-generated child work items</li>
                <li>Go to the main decomposer panel</li>
                <li>Select the parent work item you're decomposing</li>
                <li>
                  Paste with <strong>Ctrl+V</strong>
                </li>
                <li>Review and create the hierarchy</li>
              </ol>
            </div>

            <div className="ai-tips">
              <h4 className="margin-bottom-12">Pro Tips</h4>
              <div className="tip-grid">
                <div className="tip-item">
                  <strong>Be Specific:</strong> The more details you provide about your project, the
                  better the AI-generated hierarchy will be.
                </div>
                <div className="tip-item">
                  <strong>Iterate:</strong> Ask the AI to refine or expand specific parts of the
                  hierarchy if needed.
                </div>
                <div className="tip-item">
                  <strong>Multiple Projects:</strong> Save successful AI prompts to reuse for
                  similar projects.
                </div>
                <div className="tip-item">
                  <strong>Validation:</strong> Always review the generated hierarchy before creating
                  work items in Azure DevOps.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
