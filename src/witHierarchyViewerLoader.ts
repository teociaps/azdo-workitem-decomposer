import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { GlobalStateProvider } from './context/GlobalStateProvider';
import { HierarchySettingsPanel } from './components/hierarchy';

console.log('WIT Hierarchy Viewer Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  console.log('SDK Ready, initializing WIT Hierarchy viewer...');

  showRootComponent(
    React.createElement(GlobalStateProvider, null, React.createElement(HierarchySettingsPanel)),
  );

  SDK.notifyLoadSucceeded()
    .then(() => {
      console.log('WIT Hierarchy Viewer load succeeded notification sent.');
    })
    .catch((err) => {
      console.error(
        'Failed to initialize SDK for WIT Hierarchy Viewer Loader or load component:',
        err,
      );
    });
});
