import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { showRootComponent } from './core/common/common';
import { SettingsPanel } from './components/Settings/SettingsPanel';

console.log('Settings Loader SDK init sequence started.');

SDK.init({ loaded: false });
SDK.ready().then(() => {
  console.log('SDK Ready, initializing settings content...');

  showRootComponent(
    React.createElement(SettingsPanel),
  );

  SDK.notifyLoadSucceeded()
    .then(() => {
      console.log('Settings load succeeded notification sent.');
    })
    .catch((err) => {
      console.error('Failed to initialize SDK for Settings Loader or load component:', err);
    });
});
