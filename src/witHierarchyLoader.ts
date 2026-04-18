import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { GlobalStateProvider } from './context/GlobalStateProvider';
import { logger } from './core/common/logger';
import { HierarchySettingsPanel } from './components/settings';

const hierarchyLogger = logger.createChild('WITHierarchy');

hierarchyLogger.debug('WIT Hierarchy Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  hierarchyLogger.debug('SDK Ready, initializing WIT Hierarchy...');

  showRootComponent(
    React.createElement(GlobalStateProvider, null, React.createElement(HierarchySettingsPanel)),
  );
  SDK.notifyLoadSucceeded()
    .then(() => {
      hierarchyLogger.debug('WIT Hierarchy load succeeded notification sent.');
    })
    .catch((err) => {
      hierarchyLogger.error(
        'Failed to initialize SDK for WIT Hierarchy Loader or load component:',
        err,
      );
    });
});
