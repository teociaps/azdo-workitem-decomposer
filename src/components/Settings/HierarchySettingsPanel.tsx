import React, { useCallback, useState } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import { BaseSettingsPage } from './BaseSettingsPage';
import { WitHierarchyContent } from '../hierarchy/WitHierarchyContent';
import { useGlobalState } from '../../context/GlobalStateProvider';

export function HierarchySettingsPanel() {
  const { clearWorkItemConfigurations } = useGlobalState();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      clearWorkItemConfigurations();
    } catch (error) {
      console.error('Error refreshing hierarchy data:', error);
    } finally {
      setIsRefreshing(false);
    }  }, [clearWorkItemConfigurations]);

  const headerActions = (
    <div className="flex-row flex-center">
      {isRefreshing && (
        <div className="margin-right-8">
          <Spinner size={SpinnerSize.small} />
        </div>
      )}
      <Button
        text="Refresh"
        onClick={handleRefresh}
        disabled={isRefreshing}
        iconProps={{ iconName: 'Refresh' }}
      />
    </div>
  );
  return (
    <BaseSettingsPage
      title="Work Item Type Hierarchy"
      subtitle="View the hierarchy structure of work item types"
      className="hierarchy-panel-container"
      showFooter={true}
      headerActions={headerActions}
      isLoading={isRefreshing}
      loadingLabel="Refreshing hierarchy data..."
      showExtensionLabel={false}
    >
      <WitHierarchyContent className="transparent flex-row flex-center justify-center margin-bottom-16" />
    </BaseSettingsPage>
  );
}
