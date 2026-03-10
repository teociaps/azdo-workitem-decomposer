import React, { useMemo, useEffect, useState } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { TextField, TextFieldWidth } from 'azure-devops-ui/TextField';
import { Tab, TabBar, TabSize } from 'azure-devops-ui/Tabs';
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
  const [parsedTemplate, setParsedTemplate] = useState<ParsedTemplate | null>(null);

  const parser = useMemo(() => {
    return workItemConfigurations.size > 0 ? new TextHierarchyParser(workItemConfigurations) : null;
  }, [workItemConfigurations]);

  useEffect(() => {
    if (parser) {
      try {
        const templateData = parser.generateWorkItemFormatTemplate();
        const creatableTypes = parser.getCreatableWorkItemTypes();
        const decompositionExamples = parser.generateDecompositionExamples();

        const creatableInDecomposition = creatableTypes.all.filter((type) =>
          creatableTypes.child.includes(type),
        );

        const enhancedExamples = decompositionExamples.map((example) => ({
          ...example,
          description: `Text to paste when decomposing a ${example.parentType}. Each dash (-) adds one level of nesting.`,
        }));

        setParsedTemplate({
          description: templateData.description,
          pattern: templateData.pattern,
          example: templateData.example,
          availableTypes: creatableTypes.all,
          creatableTypes: { root: creatableTypes.root, child: creatableTypes.child },
          creatableInDecomposition,
          decompositionExamples: enhancedExamples,
        });
        formatSectionLogger.debug('Updated format template from hierarchy changes');
      } catch (error) {
        formatSectionLogger.error('Error parsing template data:', error);
        setParsedTemplate(null);
      }
    } else {
      setParsedTemplate(null);
    }
  }, [parser]);

  const getHierarchicalOrder = useMemo(() => {
    if (!parsedTemplate) return { orderedTypes: [], orderedExamples: [] };

    const { creatableTypes, decompositionExamples } = parsedTemplate;
    const orderedTypes: string[] = [];
    const orderedExamples: typeof decompositionExamples = [];
    const processedTypes = new Set<string>();

    const addTypeAndChildren = (typeName: string) => {
      if (processedTypes.has(typeName)) return;
      processedTypes.add(typeName);
      orderedTypes.push(typeName);

      const example = decompositionExamples.find((ex) => ex.parentType === typeName);
      if (example) orderedExamples.push(example);

      const config = workItemConfigurations.get(typeName);
      config?.hierarchyRules?.forEach((childType) => addTypeAndChildren(childType));
    };

    const topLevelTypes = creatableTypes.root.filter(
      (type) => !creatableTypes.child.includes(type),
    );
    topLevelTypes.forEach((type) => addTypeAndChildren(type));
    creatableTypes.root.forEach((type) => addTypeAndChildren(type));

    return { orderedTypes, orderedExamples };
  }, [parsedTemplate, workItemConfigurations]);

  return (
    <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
      <div className="text-hierarchy-format-section">
        {/* ── Header ── */}
        <header className="thf-header">
          <div className="thf-header-left">
            <div className="thf-header-title-row">
              <HeaderTitle titleSize={TitleSize.Large}>Text Hierarchy Format</HeaderTitle>
              <Badge
                text="BETA"
                variant="beta"
                size="medium"
                title="This feature is experimental and may have issues. Help us improve it with your feedback!"
              />
            </div>
            <p className="thf-header-description">
              Paste structured text directly into the decomposer to create a full work item
              hierarchy in one shot — no clicking through each level manually.
            </p>
          </div>
          <Link
            href={`${GITHUB_REPO_BASE_URL}/discussions/categories/features`}
            target="_blank"
            rel="noopener noreferrer"
            removeUnderline
            className="thf-feedback-link"
          >
            <Icon iconName="Feedback" />
            Give Feedback
          </Link>
        </header>

        {/* ── Tab Bar ── */}
        <TabBar
          className="thf-tab-bar"
          onSelectedTabChanged={setSelectedTab}
          selectedTabId={selectedTab}
          tabSize={TabSize.Tall}
        >
          <Tab name="How it Works" id="guide" iconProps={{ iconName: 'ReadingMode' }} />
          <Tab name="Examples" id="examples" iconProps={{ iconName: 'BranchFork2' }} />
          <Tab name="Use with AI" id="ai" iconProps={{ iconName: 'Robot' }} />
        </TabBar>

        {/* ── How it Works ── */}
        {selectedTab === 'guide' && (
          <section className="thf-tab-panel" aria-label="How it Works">
            {/* Quick steps */}
            <div className="thf-how-to">
              <div className="thf-how-to-step">
                <span className="thf-step-bubble">1</span>
                <div>
                  Open a work item and click <strong>Create Hierarchy from Text</strong> in the
                  decomposer panel.
                </div>
              </div>
              <Icon iconName="ChevronRight" className="thf-how-to-arrow" />
              <div className="thf-how-to-step">
                <span className="thf-step-bubble">2</span>
                <div>
                  Type or paste your hierarchy text using the format below, one work item per line.
                </div>
              </div>
              <Icon iconName="ChevronRight" className="thf-how-to-arrow" />
              <div className="thf-how-to-step">
                <span className="thf-step-bubble">3</span>
                <div>
                  Fix any errors shown (or ignore warnings), then click <strong>Create</strong>.
                </div>
              </div>
            </div>

            {/* Format + types side by side */}
            <div className="thf-guide-columns">
              <div className="thf-section">
                <h4 className="thf-section-title">
                  <Icon iconName="Code" />
                  Text Format
                </h4>
                <div className="thf-template-display">
                  {parser?.getFormatReference().map((ref, index) => (
                    <div key={index} className="thf-template-line">
                      <code>{ref.code}</code>
                      <span className="thf-template-desc">{ref.description}</span>
                    </div>
                  ))}
                </div>
                <ul className="thf-rules-inline">
                  <li>One work item per line</li>
                  <li>Type names are case-insensitive</li>
                  <li>No limit on nesting depth</li>
                </ul>
              </div>

              {parsedTemplate && parsedTemplate.creatableInDecomposition.length > 0 && (
                <div className="thf-section">
                  <h4 className="thf-section-title">
                    <Icon iconName="Org" />
                    Usable Types
                  </h4>
                  <p className="thf-hint-text">Type names to use in your text.</p>
                  <div className="thf-type-chips">
                    {parsedTemplate.creatableInDecomposition.map((type) => (
                      <span key={type} className="thf-type-chip">
                        {type}
                        {parsedTemplate.creatableTypes.root.includes(type) && (
                          <span className="thf-chip-badge">root</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Examples ── */}
        {selectedTab === 'examples' && (
          <section className="thf-tab-panel" aria-label="Examples">
            {parsedTemplate ? (
              <>
                <p className="thf-hint-text">
                  Expand a work item type to see the exact text you'd paste when decomposing it.
                </p>

                {getHierarchicalOrder.orderedExamples.length > 0 ? (
                  <div className="thf-examples-list">
                    {getHierarchicalOrder.orderedExamples.map((ex) => (
                      <details key={ex.parentType} className="thf-example-card">
                        <summary className="thf-example-header">
                          <Icon iconName="ChevronRight" className="thf-toggle-icon" />
                          <span className="thf-example-label">Decomposing</span>
                          <strong>{ex.parentType}</strong>
                        </summary>
                        <div className="thf-example-body">
                          <p className="thf-hint-text">{ex.description}</p>
                          <TextField
                            value={ex.example}
                            multiline
                            rows={Math.min(ex.example.split('\n').length + 1, 8)}
                            width={TextFieldWidth.auto}
                            readOnly
                            inputClassName="thf-example-textarea"
                            onFocus={(e) => e.currentTarget.select()}
                          />
                        </div>
                      </details>
                    ))}
                  </div>
                ) : (
                  <div className="thf-empty-state">
                    <Icon iconName="Info" />
                    No examples available. Configure hierarchical work item types first.
                  </div>
                )}
              </>
            ) : (
              <div className="thf-empty-state">
                <Icon iconName="ProgressRingDots" />
                Loading examples…
              </div>
            )}
          </section>
        )}

        {/* ── Use with AI ── */}
        {selectedTab === 'ai' && (
          <section className="thf-tab-panel" aria-label="Use with AI">
            <div className="thf-ai-intro">
              <p>
                Ask an AI assistant (ChatGPT, Claude, Copilot…) to generate the hierarchy text for
                you. Copy one of the prompt templates below, fill in your project details, and paste
                the AI output directly into the modal.
              </p>
              <aside className="thf-accent-panel">
                <Icon iconName="Camera" />
                <p>
                  Before prompting, take a <strong>screenshot of the hierarchy schema</strong> at
                  the top of this settings page and attach it. This helps the AI understand your
                  exact work item type structure.
                </p>
              </aside>
            </div>

            {/* Prompt templates */}
            <div className="thf-section">
              <h4 className="thf-section-title">
                <Icon iconName="paste" />
                Prompt Templates
              </h4>

              <div className="thf-ai-approaches">
                <details className="thf-ai-approach" open>
                  <summary className="thf-ai-approach-header">
                    <Icon iconName="ChevronRight" className="thf-toggle-icon" />
                    <span>Decompose a specific work item</span>
                    <span className="thf-approach-badge">Most common</span>
                  </summary>
                  <div className="thf-ai-approach-body">
                    <p className="thf-hint-text">
                      Use this when you already have a parent work item and want to break it down.
                      The AI outputs only the children — ready to paste.
                    </p>
                    <TextField
                      value={`I'm decomposing a [TYPE] called "[TITLE]" for [PROJECT DESCRIPTION].\n\nGenerate its child work items using the hierarchy in the attached screenshot.\n\nFormat each line as: Type: Title\nUse dashes for nesting depth: -, --, ---, etc.\nDo not add a dash before the first child (root level) - only nested items get dashes\n\nReturn the list wrapped in a code block so I can copy it directly.\n\nOutput only the children. Do not include the parent [TYPE] itself.`}
                      multiline
                      rows={Math.min(
                        `I'm decomposing a [TYPE] called "[TITLE]" for [PROJECT DESCRIPTION].\n\nGenerate its child work items using the hierarchy in the attached screenshot.\n\nFormat each line as: Type: Title\nUse dashes for nesting depth: -, --, ---, etc.\nDo not add a dash before the first child (root level) - only nested items get dashes\n\nReturn the list wrapped in a code block so I can copy it directly.\n\nOutput only the children. Do not include the parent [TYPE] itself.`.split(
                          '\n',
                        ).length + 1,
                        12,
                      )}
                      width={TextFieldWidth.auto}
                      readOnly
                      inputClassName="thf-example-textarea"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                </details>

                <details className="thf-ai-approach">
                  <summary className="thf-ai-approach-header">
                    <Icon iconName="ChevronRight" className="thf-toggle-icon" />
                    <span>Generate a full project hierarchy from scratch</span>
                  </summary>
                  <div className="thf-ai-approach-body">
                    <p className="thf-hint-text">
                      Use this to build an entire project structure. Create the top-level item
                      yourself, then paste the AI-generated children under it.
                    </p>
                    <TextField
                      value={`Create a complete work item breakdown for [PROJECT DESCRIPTION].\n\nUse the work item type hierarchy shown in the attached screenshot.\n\nFormat each line as: Type: Title\nUse dashes for nesting depth: -, --, ---, etc.\nDo not add a dash before the first child (root level) - only nested items get dashes\n\nReturn the list wrapped in a code block so I can copy it directly.\n\nOutput only the children. Do not include the parent [TYPE] itself.`}
                      multiline
                      rows={Math.min(
                        `Create a complete work item breakdown for [PROJECT DESCRIPTION].\n\nUse the work item type hierarchy shown in the attached screenshot.\n\nFormat each line as: Type: Title\nUse dashes for nesting depth: -, --, ---, etc.\nDo not add a dash before the first child (root level) - only nested items get dashes\n\nReturn the list wrapped in a code block so I can copy it directly.\n\nOutput only the children. Do not include the parent [TYPE] itself.`.split(
                          '\n',
                        ).length + 1,
                        12,
                      )}
                      width={TextFieldWidth.auto}
                      readOnly
                      inputClassName="thf-example-textarea"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                  </div>
                </details>

                <details className="thf-ai-approach">
                  <summary className="thf-ai-approach-header">
                    <Icon iconName="ChevronRight" className="thf-toggle-icon" />
                    <span>Create your own template and share with your team</span>
                    <span className="thf-approach-badge">Coming soon...</span>
                  </summary>
                  <div className="thf-ai-approach-body">
                    <p className="thf-hint-text">
                      Build custom templates tailored to your team's workflow and share them with
                      your organization for consistent hierarchy creation across projects.
                    </p>
                  </div>
                </details>
              </div>
            </div>

            {/* Tips — compact inline chips */}
            <div className="thf-section">
              <h4 className="thf-section-title">
                <Icon iconName="Lightbulb" />
                Tips
              </h4>
              <ul className="thf-tips-list">
                <li>
                  <strong>Templates are editable</strong> — the provided AI templates are basic
                  examples; edit them to exclude work items or add detail before sending to an AI.
                </li>
                <li>
                  <strong>Be specific</strong> — mention the domain, team size, or tech stack for
                  more relevant output.
                </li>
                <li>
                  <strong>Iterate</strong> — ask the AI to expand or trim specific branches if the
                  first result isn't quite right.
                </li>
                <li>
                  <strong>Validate before creating</strong> — the modal shows errors and warnings
                  before anything is saved to Azure DevOps.
                </li>
              </ul>
            </div>
          </section>
        )}
      </div>
    </Card>
  );
}
