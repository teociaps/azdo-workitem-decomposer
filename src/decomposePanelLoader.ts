import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { DecomposePanelContent } from './components/DecomposePanel/DecomposePanelContent';
import { GlobalStateProvider } from './context/GlobalStateProvider';

console.log('Panel Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  console.log('SDK Ready, initializing panel content...');
  const config = SDK.getConfiguration();
  const initialContext = config?.context;

  showRootComponent(
    React.createElement(GlobalStateProvider, null,
      React.createElement(DecomposePanelContent, { initialContext: initialContext })
    )
  );

  SDK.notifyLoadSucceeded()
    .then(() => {
      console.log('Panel load succeeded notification sent.');
      console.log('Panel content rendered with context:', initialContext);
    })
    .catch((err) => {
      console.error('Failed to send load succeeded notification', err);
    });
});
