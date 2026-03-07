import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Card, CardFooter } from 'azure-devops-ui/Card';
import { Button } from 'azure-devops-ui/Button';
import {
  CustomHeader,
  TitleSize,
  HeaderTitleArea,
  HeaderTitleRow,
  HeaderTitle,
} from 'azure-devops-ui/Header';
import { Icon } from 'azure-devops-ui/Icon';
import { useFocusLock, FocusLockOptions } from '../../../core/hooks/useFocusLock';
import { useScrollVisibility } from '../../../core/hooks/useScrollVisibility';
import { useContextShortcuts } from '../../../core/shortcuts/useShortcuts';
import { ShortcutCode } from '../../../core/shortcuts/shortcutConfiguration';
import { TextHierarchyParser } from '../../../managers/textHierarchyParser';
import { WorkItemConfigurationsMap } from '../../../core/models/commonTypes';
import { Badge } from '../../common';
import './TextHierarchyModal.scss';

interface TextHierarchyModalProps {
  isOpen: boolean;
  workItemConfigurations: WorkItemConfigurationsMap;
  parentWorkItemType?: string;
  onSubmit: (_text: string) => void;
  onClose: () => void;
}

interface ValidationState {
  errors: ErrorMessage[];
  warnings: ErrorMessage[];
  itemCount: number;
  isValid: boolean;
}

interface ErrorMessage {
  lineNumber: number;
  message: string;
}

export function TextHierarchyModal({
  isOpen,
  workItemConfigurations,
  parentWorkItemType,
  onSubmit,
  onClose,
}: TextHierarchyModalProps) {
  const [inputText, setInputText] = useState('');
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [isFormatReferenceExpanded, setIsFormatReferenceExpanded] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const { showTopBorder, showBottomBorder } = useScrollVisibility(modalContentRef, [
    validation,
    isFormatReferenceExpanded,
    inputText,
  ]);

  const parser = useMemo(() => {
    return workItemConfigurations.size > 0 ? new TextHierarchyParser(workItemConfigurations) : null;
  }, [workItemConfigurations]);

  const placeholderExample = useMemo(() => {
    if (!parser || !parentWorkItemType) {
      // Fallback to generic template if no parent type
      return parser?.generateWorkItemFormatTemplate().example ?? '';
    }

    // Get the specific decomposition example for the parent type
    const decompositionExamples = parser.generateDecompositionExamples();
    const matchingExample = decompositionExamples.find(
      (ex) => ex.parentType.toLowerCase() === parentWorkItemType.toLowerCase(),
    );

    return (
      matchingExample?.example ?? parser.generateWorkItemFormatTemplate(parentWorkItemType).example
    );
  }, [parser, parentWorkItemType]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputText('');
      setValidation(null);
      setIsFormatReferenceExpanded(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Live validate on text change (debounced)
  useEffect(() => {
    if (!inputText.trim() || !parser) {
      setValidation(null);
      return;
    }

    const timer = setTimeout(() => {
      const result = parser.parseWorkItemText(
        inputText.trim(),
        undefined,
        undefined,
        parentWorkItemType,
      );

      const errors = result.errors.map((e) => ({
        lineNumber: e.lineNumber,
        message: e.error,
      }));
      const warnings = result.warnings.map((w) => ({
        lineNumber: w.lineNumber,
        message: w.error,
      }));

      const countNodes = (nodes: typeof result.nodes): number => {
        let count = 0;
        for (const n of nodes) {
          count++;
          if (n.children?.length) count += countNodes(n.children);
        }
        return count;
      };

      setValidation({
        errors,
        warnings,
        itemCount: result.success ? countNodes(result.nodes) : 0,
        isValid: result.success && result.nodes.length > 0,
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [inputText, parser, parentWorkItemType, workItemConfigurations]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
  }, []);

  const handleGoToLine = useCallback(
    (lineNumber: number) => {
      if (!textareaRef.current) return;

      const lines = inputText.split('\n');
      if (lineNumber < 1 || lineNumber > lines.length) return;

      // Calculate the character position of the line
      let charIndex = 0;
      for (let i = 0; i < lineNumber - 1; i++) {
        charIndex += lines[i].length + 1; // +1 for newline
      }

      const textarea = textareaRef.current;

      // Set cursor position
      textarea.focus();
      textarea.setSelectionRange(charIndex, charIndex + lines[lineNumber - 1].length);

      // Scroll textarea to make the line visible
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);
      const scrollPosition = (lineNumber - 1) * lineHeight - textarea.clientHeight / 2;
      textarea.scrollTop = Math.max(0, scrollPosition);

      // Scroll the modal parent if needed to ensure textarea is visible
      const modalScrollContainer = textarea.closest('.modal-content-scrollable') as HTMLElement;
      if (modalScrollContainer) {
        const textareaRect = textarea.getBoundingClientRect();
        const containerRect = modalScrollContainer.getBoundingClientRect();

        // If textarea is not fully visible in modal, scroll to make it visible
        if (textareaRect.top < containerRect.top) {
          // Textarea is above the visible area
          modalScrollContainer.scrollTop += textareaRect.top - containerRect.top - 20; // 20px offset for padding
        } else if (textareaRect.bottom > containerRect.bottom) {
          // Textarea is below the visible area
          modalScrollContainer.scrollTop += textareaRect.bottom - containerRect.bottom + 20; // 20px offset for padding
        }
      }

      // Highlight the line temporarily
      setHighlightedLine(lineNumber);
      const timer = setTimeout(() => {
        setHighlightedLine(null);
      }, 2000); // Highlight for 2 seconds

      return () => clearTimeout(timer);
    },
    [inputText],
  );

  const handleTextareaScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;

    onSubmit(trimmed);
    onClose();
  }, [inputText, onSubmit, onClose]);

  const handleSubmitIfValid = useCallback(() => {
    if (validation?.isValid) {
      handleSubmit();
    }
  }, [validation, handleSubmit]);

  useContextShortcuts(
    'textHierarchyModal',
    [
      { code: ShortcutCode.ESCAPE, callback: onClose },
      { code: ShortcutCode.CTRL_ENTER, callback: handleSubmitIfValid },
    ],
    isOpen,
  );

  const focusLockOptions: FocusLockOptions = {
    onEscape: onClose,
  };

  useFocusLock(modalOverlayRef, isOpen, focusLockOptions);

  const toggleFormatReference = useCallback(() => {
    setIsFormatReferenceExpanded((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  const canSubmit = validation?.isValid === true;

  return (
    <div className="text-hierarchy-modal-overlay" ref={modalOverlayRef}>
      <Card className="text-hierarchy-modal" contentProps={{ className: 'flex-column' }}>
        <CustomHeader className="modal-header-custom">
          <HeaderTitleArea>
            <HeaderTitleRow>
              <HeaderTitle titleSize={TitleSize.Medium}>Create Hierarchy from Text</HeaderTitle>
              <Badge
                text="BETA"
                variant="beta"
                size="small"
                title="This feature is experimental and may have issues."
              />
            </HeaderTitleRow>
            <p className="modal-header-description">
              Enter or paste your formatted text to create a work item hierarchy. <kbd>Ctrl</kbd>+
              <kbd>Enter</kbd> to submit.
            </p>
          </HeaderTitleArea>
          <Button
            iconProps={{ iconName: 'Cancel' }}
            onClick={onClose}
            subtle
            ariaLabel="Close modal"
            className="modal-close-button"
          />
        </CustomHeader>

        <div
          className={`modal-content-scrollable${showTopBorder ? ' show-top-border' : ''}${
            showBottomBorder ? ' show-bottom-border' : ''
          }`}
          ref={modalContentRef}
        >
          <div className="modal-content-inner-padding">
            <div className="text-hierarchy-input-container">
              {/* Input Section */}
              <section className="input-section" aria-label="Hierarchy text input">
                <div className="section-label">
                  <Icon iconName="Edit" />
                  Hierarchy Text
                </div>

                <div className="text-hierarchy-input-wrapper">
                  <div
                    className="text-hierarchy-line-numbers"
                    ref={lineNumbersRef}
                    aria-hidden="true"
                  >
                    {inputText.split('\n').map((_, i) => (
                      <div
                        key={i}
                        className={`line-number${highlightedLine === i + 1 ? ' highlighted' : ''}`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>
                  <textarea
                    ref={textareaRef}
                    className="text-hierarchy-textarea"
                    value={inputText}
                    onChange={handleTextChange}
                    onScroll={handleTextareaScroll}
                    placeholder={placeholderExample}
                    rows={10}
                    aria-label="Hierarchy text input"
                    spellCheck={false}
                  />
                </div>
              </section>

              {/* Validation Results Section */}
              {validation && (validation.errors.length > 0 || validation.warnings.length > 0) && (
                <div className="validation-section" role="alert" aria-live="polite">
                  {validation.errors.length > 0 && (
                    <div className="text-hierarchy-errors errors-list">
                      <div className="errors-header">
                        <Icon iconName="StatusErrorFull" />
                        <strong className="errors-title">
                          {validation.errors.length} Error
                          {validation.errors.length !== 1 ? 's' : ''}
                        </strong>
                        <span className="go-to-hint">click to go to line</span>
                      </div>
                      <div className="error-items-container">
                        {validation.errors.map((err, i) => (
                          <button
                            key={i}
                            type="button"
                            className="error-item"
                            onClick={() => handleGoToLine(err.lineNumber)}
                            title={`Go to line ${err.lineNumber}`}
                          >
                            <span className="error-line-badge">:{err.lineNumber}</span>
                            <span className="error-message">{err.message}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {validation.warnings.length > 0 && (
                    <div className="text-hierarchy-errors warnings-list">
                      <div className="warnings-header">
                        <Icon iconName="Warning" />
                        <strong className="warnings-title">
                          {validation.warnings.length} Warning
                          {validation.warnings.length !== 1 ? 's' : ''}
                        </strong>
                        <span className="go-to-hint">click to go to line</span>
                      </div>
                      <div className="warning-items-container">
                        {validation.warnings.map((warn, i) => (
                          <button
                            key={i}
                            type="button"
                            className="warning-item"
                            onClick={() => handleGoToLine(warn.lineNumber)}
                            title={`Go to line ${warn.lineNumber}`}
                          >
                            <span className="warning-line-badge">:{warn.lineNumber}</span>
                            <span className="warning-message">{warn.message}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Format Reference Section */}
              <details className="text-hierarchy-format-hint" open={isFormatReferenceExpanded}>
                <summary
                  className="format-hint-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    toggleFormatReference();
                  }}
                >
                  <span
                    className={`toggle-icon${isFormatReferenceExpanded ? ' expanded' : ''}`}
                    aria-hidden="true"
                  >
                    <Icon iconName="ChevronRight" />
                  </span>
                  <Icon iconName="Info" className="format-icon" />
                  Format Reference
                </summary>
                {isFormatReferenceExpanded && parser && (
                  <div className="format-hint-lines" role="list">
                    {parser.getFormatReference().map((ref, index) => (
                      <div key={index} className="format-ref-item" role="listitem">
                        <code>{ref.code}</code>
                        <span className="format-desc">{ref.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>
          </div>
        </div>

        <CardFooter className="modal-actions">
          {inputText.trim() && (
            <div className="status-bar" role="status" aria-live="polite">
              <span className="status-badge">
                <Icon iconName="TextDocument" />
                {
                  inputText
                    .trim()
                    .split('\n')
                    .filter((l) => l.trim()).length
                }{' '}
                line(s)
              </span>
              {validation?.isValid &&
                (validation.warnings.length > 0 ? (
                  <span className="status-badge warning">
                    <Icon
                      iconName="Warning"
                      tooltipProps={{ text: `${validation.warnings.length} warning(s)` }}
                    />
                    {validation.itemCount} work item(s) ready
                  </span>
                ) : (
                  <span className="status-badge success">
                    <Icon iconName="CheckMark" />
                    {validation.itemCount} work item(s) ready
                  </span>
                ))}
              {validation && !validation.isValid && validation.errors.length > 0 && (
                <span className="status-badge error">
                  <Icon iconName="Error" />
                  {validation.errors.length} error(s)
                </span>
              )}
            </div>
          )}
          <div className="modal-actions-buttons">
            <Button text="Cancel" onClick={onClose} />
            <Button
              text="Create"
              primary
              onClick={handleSubmit}
              disabled={!canSubmit}
              tooltipProps={{
                text: canSubmit
                  ? `Create ${validation?.itemCount ?? 0} work item(s)`
                  : 'Fix errors above or enter valid hierarchy text',
              }}
            />
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
