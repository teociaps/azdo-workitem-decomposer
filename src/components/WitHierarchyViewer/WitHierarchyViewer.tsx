import React from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Card } from 'azure-devops-ui/Card';
import { CustomHeader, HeaderTitle } from 'azure-devops-ui/Header';
import { WitHierarchyContent } from './WitHierarchyContent';
import './WitHierarchyViewer.scss';

interface WitHierarchyViewerProps {
  projectName: string;
  onClose: () => void;
  selectedWit?: string; // The currently selected work item type to highlight
}

export function WitHierarchyViewer({
  projectName,
  onClose,
  selectedWit: currentType,
}: WitHierarchyViewerProps) {
  // Main component render
  return (
    <Card className="wit-hierarchy-card" contentProps={{ className: 'wit-hierarchy-card-content' }}>
      <CustomHeader className="wit-hierarchy-header">
        <HeaderTitle className="wit-hierarchy-header-title">
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <span
              className="wit-hierarchy-drag-icon"
              style={{ marginRight: 8, marginLeft: 2, fontSize: 18 }}
              aria-hidden="true"
            >
              ⋮⋮
            </span>
            <span>Work Item Type Hierarchy</span>
          </span>
        </HeaderTitle>
        <Button
          iconProps={{ iconName: 'Cancel' }}
          onClick={onClose}
          subtle={true}
          className="wit-hierarchy-close-btn"
          tooltipProps={{ text: 'Close Hierarchy Viewer' }}
          ariaLabel="Close work item type hierarchy viewer"
        />
      </CustomHeader>

      <div className="wit-hierarchy-description">
        Displays work item relationships with highlighting for selected type and valid decomposition options.
      </div>

      <div className="wit-hierarchy-body">
        <WitHierarchyContent selectedWit={currentType} />
      </div>
    </Card>
  );
}
