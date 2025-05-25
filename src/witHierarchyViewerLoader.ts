import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { GlobalStateProvider } from './context/GlobalStateProvider';
import { HierarchySettingsPanel } from './components/hierarchy';
import { logger } from './core/common/logger';

const hierarchyViewerLogger = logger.createChild('HierarchyViewer');

hierarchyViewerLogger.debug('WIT Hierarchy Viewer Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  hierarchyViewerLogger.debug('SDK Ready, initializing WIT Hierarchy viewer...');

  showRootComponent(
    React.createElement(GlobalStateProvider, null, React.createElement(HierarchySettingsPanel)),
  );
  SDK.notifyLoadSucceeded()
    .then(() => {
      hierarchyViewerLogger.debug('WIT Hierarchy Viewer load succeeded notification sent.');
    })
    .catch((err) => {
      hierarchyViewerLogger.error(
        'Failed to initialize SDK for WIT Hierarchy Viewer Loader or load component:',
        err,
      );
    });
});
