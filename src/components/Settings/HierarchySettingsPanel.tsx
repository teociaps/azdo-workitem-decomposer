import React from 'react';
import { BaseSettingsPage } from './BaseSettingsPage';
import { WitHierarchyContent } from '../hierarchy/WitHierarchyContent';

export function HierarchySettingsPanel() {
  return (
    <BaseSettingsPage
      title="Work Item Type Hierarchy"
      subtitle="View the hierarchy structure of work item types"
      className="hierarchy-panel-container"
      showFooter={true}
    >
      <WitHierarchyContent className="transparent" />
    </BaseSettingsPage>
  );
}
