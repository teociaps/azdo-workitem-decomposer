import React, { useState, useMemo, useEffect } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { TextField, TextFieldWidth } from 'azure-devops-ui/TextField';
import { FormItem } from 'azure-devops-ui/FormItem';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { useGlobalState } from '../../context/GlobalStateProvider';
import { TextHierarchyParser } from '../../managers/textHierarchyParser';
import { logger } from '../../core/common/logger';
import { Badge } from '../common';
import './TextHierarchyFormatSection.scss';
import { Link } from 'azure-devops-ui/Link';
import { Icon } from 'azure-devops-ui/Icon';
import { GITHUB_REPO_BASE_URL } from '../../core/common/common';

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
      <div className="text-hierarchy-format-section">
        <FormItem className="margin-bottom-16">
          <div className="flex-row flex-center justify-space-between">
            <div className="flex-row flex-center">
              <HeaderTitle titleSize={TitleSize.Large}>Text Hierarchy Format</HeaderTitle>
              <Badge
                text="BETA"
                variant="beta"
                size="medium"
                title="This feature is experimental and may have issues. Help us improve it with your feedback!"
              />
            </div>
            <div className="beta-feedback-link">
              <Link
                href={`${GITHUB_REPO_BASE_URL}/discussions`}
                target="_blank"
                rel="noopener noreferrer"
                removeUnderline
              >
                Give Feedback <Icon ariaLabel="Give feedback" iconName="NavigateExternalInline" />
              </Link>
            </div>
          </div>
          <p className="secondary-text margin-bottom-12">
            Create work item hierarchies by pasting formatted text. The format automatically adapts
            to your project's work item type configuration.
          </p>

          <MessageCard className="margin-bottom-16" severity={MessageCardSeverity.Warning}>
            <strong>Beta Feature Notice:</strong> This is an experimental feature that's actively
            being developed. Functionality may change, break, or be removed in future updates as we
            improve and refine the experience. Your feedback helps us make it better!
          </MessageCard>
        </FormItem>

        <TabBar
          className="thf-tab-bar margin-bottom-16"
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
              <h4 className="thf-section-title">Text Format Template</h4>
              <div className="thf-template-display">
                {parser?.getFormatReference().map((ref, index) => (
                  <div key={index} className="thf-template-line">
                    <code className="thf-template-code">{ref.code}</code> — {ref.description}
                  </div>
                ))}
              </div>
            </div>

            <div className="margin-bottom-16">
              <h4 className="thf-section-title">Format Rules</h4>
              <ul className="thf-rules-list">
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
              <h4 className="thf-section-title">How to Use</h4>
              <ol className="thf-steps-list">
                <li>Go to the main decomposer panel</li>
                <li>
                  Click the <strong>Create Hierarchy from text</strong> button
                </li>
                <li>Write or paste your hierarchy text in the modal</li>
                <li>Review any validation errors shown</li>
                <li>
                  Click <strong>Create</strong> to generate the hierarchy
                </li>
              </ol>
            </div>

            {parsedTemplate && parsedTemplate.creatableInDecomposition.length > 0 && (
              <div className="margin-bottom-16">
                <h4 className="thf-section-title">Available Work Item Types</h4>
                <div className="thf-types-tag-list">
                  {parsedTemplate.creatableInDecomposition.map((type) => (
                    <span key={type} className="thf-type-tag">
                      {type}
                    </span>
                  ))}
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
                  <h4 className="thf-section-title">Complete Hierarchy Examples</h4>
                  <div className="margin-bottom-12 secondary-text">
                    See exactly what you can create when decomposing each work item type, ordered
                    from top-level items down to their children.
                  </div>
                </div>

                {getHierarchicalOrder.orderedExamples.length > 0 ? (
                  <div className="thf-examples-list">
                    {getHierarchicalOrder.orderedExamples.map((decomp) => (
                      <div key={decomp.parentType} className="thf-example-card">
                        <button
                          className="thf-example-header"
                          onClick={() => toggleSection(decomp.parentType)}
                        >
                          <Icon
                            iconName={
                              expandedExamples[decomp.parentType] ? 'ChevronDown' : 'ChevronRight'
                            }
                          />
                          Decomposing: {decomp.parentType}
                        </button>
                        {expandedExamples[decomp.parentType] && (
                          <div className="thf-example-body">
                            <div className="secondary-text margin-bottom-12">
                              {decomp.description}
                            </div>
                            <TextField
                              value={decomp.example}
                              multiline
                              rows={Math.min(decomp.example.split('\n').length + 1, 8)}
                              width={TextFieldWidth.auto}
                              readOnly
                              inputClassName="thf-example-textarea"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="thf-empty-state">
                    No decomposition examples available. Your project may not have configured
                    hierarchical work item types.
                  </div>
                )}
              </>
            ) : (
              <div className="thf-empty-state">
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
                  <h4 className="thf-section-title">Work Item Type Capabilities</h4>
                  <div className="margin-bottom-12 secondary-text">
                    Organized from top-level types down through the hierarchy.
                  </div>
                  <div className="thf-type-tree">
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
                            className="thf-type-row"
                            style={{ paddingLeft: `${12 + hierarchyLevel * 20}px` }}
                          >
                            {hierarchyLevel > 0 && <span className="thf-type-connector">└</span>}
                            <span className="thf-type-name">{type}</span>
                            {isTopLevel && !isChildType && (
                              <span className="thf-type-badge thf-badge-top-level">Top-level</span>
                            )}
                            {isChildType && !isTopLevel && (
                              <span className="thf-type-badge thf-badge-child">Child</span>
                            )}
                            {isChildType && isTopLevel && (
                              <span className="thf-type-badge thf-badge-flexible">Flexible</span>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="thf-empty-state">No hierarchy-capable types found</div>
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
              <div className="thf-empty-state">Type information is loading...</div>
            )}
          </div>
        )}

        {selectedTab === 'ai' && (
          <div>
            <div className="margin-bottom-16">
              <h4 className="thf-section-title">AI-Powered Hierarchy Generation</h4>
              <p className="secondary-text">
                Use ChatGPT, Claude, or other AI assistants to generate work item hierarchies
                instantly. Just describe your project and let AI create the formatted text for you.
              </p>
            </div>

            <div className="margin-bottom-24">
              <div className="thf-ai-step-header">
                <span className="thf-ai-step-number">1</span>
                <h4 className="thf-ai-step-title">Take Schema Screenshot</h4>
              </div>
              <div className="thf-ai-step-card">
                <div className="margin-bottom-12">
                  Take a screenshot of the work item type hierarchy schema displayed at the top of
                  this settings page. This visual schema shows the parent-child relationships that
                  the AI needs to understand.
                </div>
                <div className="thf-accent-panel">
                  <strong>Why a screenshot?</strong> The visual hierarchy diagram helps AI
                  understand the exact parent-child relationships and generates more accurate work
                  item structures.
                </div>
              </div>
            </div>

            <div className="margin-bottom-24">
              <div className="thf-ai-step-header">
                <span className="thf-ai-step-number">2</span>
                <h4 className="thf-ai-step-title">Choose Your Starting Work Item</h4>
              </div>
              <div className="thf-ai-step-card">
                <div className="prompt-description margin-bottom-12">
                  Decide which work item you're decomposing. This becomes your "parent" and the AI
                  will generate its complete hierarchy:
                </div>
                {parsedTemplate && getHierarchicalOrder.orderedTypes.length > 0 ? (
                  <div className="thf-ai-scenarios">
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
                            <div key={type} className="thf-ai-scenario">
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
                  <div className="thf-empty-state">
                    Decomposition scenarios will appear when work item types are loaded...
                  </div>
                )}
              </div>
            </div>

            <div className="margin-bottom-24">
              <div className="thf-ai-step-header">
                <span className="thf-ai-step-number">3</span>
                <h4 className="thf-ai-step-title">AI Prompt Template</h4>
              </div>
              <div className="thf-ai-step-card">
                <div className="prompt-description margin-bottom-12">
                  Choose your approach and use the appropriate template:
                </div>

                <div className="thf-ai-approach margin-bottom-16">
                  <div className="thf-ai-approach-header">
                    <h5>Approach 1: Decompose Specific Work Item (Recommended)</h5>
                  </div>
                  <div className="thf-ai-approach-body">
                    <div className="margin-bottom-12">
                      Best for when you have a specific parent work item and want AI to generate its
                      children only.
                    </div>
                    <div className="thf-code-block">
                      <div className="thf-code-line">
                        I'm decomposing a [WORK ITEM TYPE] called "[WORK ITEM TITLE]" for [PROJECT
                        DESCRIPTION].
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">
                        Please generate child work items using this hierarchy (see attached
                        screenshot).
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">Format: Type: Title</div>
                      <div className="thf-code-line">
                        Use dashes (-) for nesting: -, --, ---, etc.
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">
                        DO NOT include the parent work item in the output - only generate its
                        children.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="thf-ai-approach">
                  <div className="thf-ai-approach-header">
                    <h5>Approach 2: Generate Complete Project Hierarchy</h5>
                  </div>
                  <div className="thf-ai-approach-body">
                    <div className="margin-bottom-12">
                      Perfect when you want AI to create an entire project structure from scratch.
                      You create the top-level item manually, then paste the complete child
                      hierarchy.
                    </div>
                    <div className="thf-code-block">
                      <div className="thf-code-line">
                        Create a complete work item hierarchy for [PROJECT DESCRIPTION].
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">
                        Use this work item type hierarchy (see attached screenshot).
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">Format: Type: Title</div>
                      <div className="thf-code-line">
                        Use dashes (-) for nesting: -, --, ---, etc.
                      </div>
                      <div className="thf-code-line">&nbsp;</div>
                      <div className="thf-code-line">
                        DO NOT include the top-level parent item - generate the complete child
                        hierarchy starting from the first level children.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="margin-bottom-24">
              <div className="thf-ai-step-header">
                <span className="thf-ai-step-number">4</span>
                <h4 className="thf-ai-step-title">Example AI Conversation</h4>
              </div>
              <div className="thf-chat-messages">
                {parsedTemplate && getHierarchicalOrder.orderedTypes.length > 0 ? (
                  <>
                    <div className="thf-chat-message thf-chat-user">
                      <div className="thf-chat-role">You:</div>
                      <div className="thf-chat-body">
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
                    <div className="thf-chat-message thf-chat-ai">
                      <div className="thf-chat-role">AI Response:</div>
                      <div className="thf-chat-body">
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
                  <div className="thf-empty-state">
                    Example conversation will appear when work item types are loaded...
                  </div>
                )}
              </div>
            </div>

            <div className="margin-bottom-16">
              <div className="thf-ai-step-header">
                <span className="thf-ai-step-number">5</span>
                <h4 className="thf-ai-step-title">Copy & Paste</h4>
              </div>
              <ol className="thf-steps-list">
                <li>Copy the AI-generated child work items</li>
                <li>Go to the main decomposer panel</li>
                <li>
                  Click the <strong>Create Hierarchy from text</strong> button
                </li>
                <li>Paste the AI output into the modal text area</li>
                <li>
                  Review validation and click <strong>Create</strong>
                </li>
              </ol>
            </div>

            <div className="thf-ai-step-card">
              <h4 className="thf-section-title">Pro Tips</h4>
              <div className="thf-tips-grid">
                <div className="thf-tip-card">
                  <div className="thf-tip-title">Be Specific</div>
                  <div className="thf-tip-text">
                    The more details you provide about your project, the better the AI-generated
                    hierarchy will be.
                  </div>
                </div>
                <div className="thf-tip-card">
                  <div className="thf-tip-title">Iterate</div>
                  <div className="thf-tip-text">
                    Ask the AI to refine or expand specific parts of the hierarchy if needed.
                  </div>
                </div>
                <div className="thf-tip-card">
                  <div className="thf-tip-title">Multiple Projects</div>
                  <div className="thf-tip-text">
                    Save successful AI prompts to reuse for similar projects.
                  </div>
                </div>
                <div className="thf-tip-card">
                  <div className="thf-tip-title">Validation</div>
                  <div className="thf-tip-text">
                    Always review the generated hierarchy before creating work items in Azure
                    DevOps.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
