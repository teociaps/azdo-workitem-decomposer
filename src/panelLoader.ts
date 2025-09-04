import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { DecomposerPanelContent } from './components/decomposer/DecomposerPanelContent';
import { GlobalStateProvider } from './context/GlobalStateProvider';
import { logger } from './core/common/logger';
import { InitialContext } from './core/models/initialContext';

const panelLoaderLogger = logger.createChild('PanelLoader');

panelLoaderLogger.debug('Panel Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  panelLoaderLogger.debug('SDK Ready, initializing panel content...');
  const config = SDK.getConfiguration();
  const initialContext = config?.context;

  const content = React.createElement(DecomposerPanelContent);
  const providerProps: { initialContext?: InitialContext; children: React.ReactNode } = {
    initialContext,
    children: content,
  };

  showRootComponent(React.createElement(GlobalStateProvider, providerProps));
  SDK.notifyLoadSucceeded()
    .then(() => {
      panelLoaderLogger.debug('Panel load succeeded notification sent.');
      panelLoaderLogger.debug('Panel content rendered with context:', initialContext);
    })
    .catch((err) => {
      panelLoaderLogger.error('Failed to send load succeeded notification', err);
    });
});
