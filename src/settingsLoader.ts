import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { logger } from './core/common/logger';
import { SettingsPanel } from './components/settings';
import { GlobalStateProvider } from './context/GlobalStateProvider';

const settingsLoaderLogger = logger.createChild('SettingsLoader');

settingsLoaderLogger.debug('Settings Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  settingsLoaderLogger.debug('SDK Ready, initializing settings content...');

  showRootComponent(
    React.createElement(GlobalStateProvider, null, React.createElement(SettingsPanel)),
  );
  SDK.notifyLoadSucceeded()
    .then(() => {
      settingsLoaderLogger.debug('Settings load succeeded notification sent.');
    })
    .catch((err) => {
      settingsLoaderLogger.error(
        'Failed to initialize SDK for Settings Loader or load component:',
        err,
      );
    });
});
