import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Card } from 'azure-devops-ui/Card';
import { Button } from 'azure-devops-ui/Button';
import {
  CustomHeader,
  TitleSize,
  HeaderTitleArea,
  HeaderTitleRow,
  HeaderTitle,
} from 'azure-devops-ui/Header';
import { useFocusLock, FocusLockOptions } from '../../../core/hooks/useFocusLock';
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
  errors: string[];
  warnings: string[];
  itemCount: number;
  isValid: boolean;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modalOverlayRef = useRef<HTMLDivElement>(null);

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

      const errors = result.errors.map((e) => `Line ${e.lineNumber}: ${e.error}`);
      const warnings = result.warnings.map((w) => `Line ${w.lineNumber}: ${w.error}`);

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
              Enter or paste your formatted text to create a work item hierarchy. Use{' '}
              <strong>Ctrl+Enter</strong> to submit.
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

        <div className="modal-content-scrollable">
          <div className="modal-content-inner-padding">
            <div className="text-hierarchy-input-container">
              <textarea
                ref={textareaRef}
                className="text-hierarchy-textarea"
                value={inputText}
                onChange={handleTextChange}
                placeholder={placeholderExample}
                rows={10}
                aria-label="Hierarchy text input"
                spellCheck={false}
              />

              {inputText.trim() && (
                <div className="text-hierarchy-item-count">
                  {
                    inputText
                      .trim()
                      .split('\n')
                      .filter((l) => l.trim()).length
                  }{' '}
                  line(s)
                  {validation?.isValid && ` — ${validation.itemCount} work item(s) detected`}
                </div>
              )}

              {validation && validation.errors.length > 0 && (
                <div className="text-hierarchy-errors errors-list">
                  <div className="error-title">Errors</div>
                  {validation.errors.map((err, i) => (
                    <div key={i} className="error-item">
                      {err}
                    </div>
                  ))}
                </div>
              )}

              {validation && validation.warnings.length > 0 && (
                <div className="text-hierarchy-errors warnings-list">
                  <div className="warning-title">Warnings</div>
                  {validation.warnings.map((warn, i) => (
                    <div key={i} className="warning-item">
                      {warn}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-hierarchy-format-hint">
              <button
                className="format-hint-toggle"
                onClick={toggleFormatReference}
                aria-expanded={isFormatReferenceExpanded}
              >
                <span className={`toggle-icon ${isFormatReferenceExpanded ? 'expanded' : ''}`}>
                  ▸
                </span>
                <span className="format-hint-title">Format Reference</span>
              </button>
              {isFormatReferenceExpanded && parser && (
                <div className="format-hint-lines">
                  {parser.getFormatReference().map((ref, index) => (
                    <div key={index}>
                      <code>{ref.code}</code> — {ref.description}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-actions">
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
      </Card>
    </div>
  );
}
