import React, { useCallback } from 'react';
import { FormItem } from 'azure-devops-ui/FormItem';
import { HeaderTitle, TitleSize } from 'azure-devops-ui/Header';
import { Toggle } from 'azure-devops-ui/Toggle';
import { Card } from 'azure-devops-ui/Card';
import { DecomposerSettings } from '../../services/settingsService';
import { useAutoSave } from '../../context';
import './BatchCreationSection.scss';

interface BatchCreationSectionProps {
  settings: DecomposerSettings;
  onSettingsChange: (_settings: DecomposerSettings) => void;
  canEdit: boolean;
}

export function BatchCreationSection({
  settings,
  onSettingsChange,
  canEdit,
}: BatchCreationSectionProps) {
  const autoSave = useAutoSave();

  const handleBatchCreationEnabledChange = useCallback(
    (
      _event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>,
      checked: boolean,
    ) => {
      if (!canEdit) return;
      const newSettings = {
        ...settings,
        batchCreation: { ...settings.batchCreation, enabled: checked },
      };
      onSettingsChange(newSettings);
      autoSave.saveSettings(newSettings);
    },
    [canEdit, settings, onSettingsChange, autoSave],
  );

  return (
    <Card className="settings-card margin-bottom-16" contentProps={{ className: 'flex-column' }}>
      <div>
        <FormItem className="margin-bottom-8">
          <div className="flex-row flex-center justify-space-between">
            <HeaderTitle titleSize={TitleSize.Large}>Batch Creation</HeaderTitle>
            <Toggle
              checked={settings.batchCreation.enabled}
              onChange={handleBatchCreationEnabledChange}
              onText="On"
              offText="Off"
              disabled={!canEdit}
            />
          </div>
        </FormItem>
        <p className="secondary-text">
          When enabled, work item creation will be split into batches and processed in parallel to
          improve performance for large hierarchies. This can significantly speed up the creation
          process. The system will automatically determine the optimal batch size and concurrency
          based on the total number of work items to create.
        </p>
        {settings.batchCreation.enabled && (
          <div className="batch-creation-note">
            <p className="secondary-text">
              <strong>Note:</strong> When batch creation is enabled, work item IDs may not be in
              sequential order due to parallel processing. This is normal behavior and does not
              affect the hierarchy relationships.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
