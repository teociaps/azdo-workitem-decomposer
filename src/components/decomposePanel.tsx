import React from 'react';
import SDK from 'azure-devops-extension-sdk';
import { Button } from 'azure-devops-ui/Button';
import { showRootComponent } from '../common/common';

export const PanelComponent: React.FC<{ initialContext?: any }> = ({ initialContext }) => {
  const workItemIds = initialContext?.workItemIds || []; // TODO: handle more work items (with max)??

  const closePanel = async (result?: any) => {
    // TODO: handle result and close panel
    console.log('Panel closed with result:', result);
  };

  return (
    <div>
      {/* Main content area */}
      <div style={{ flexGrow: 1 }}>
        <h2>Decompose Work Item {workItemIds.join(', ')}</h2>
        <p>Place your decomposition logic and UI elements here.</p>
        <p>This content appears inside the panel frame created by `openPanel`.</p>
        {/* Add your form elements, lists, etc. here */}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px' }}>
        <Button
          onClick={() => closePanel({ action: 'save' })}
          primary={true}
          style={{ marginRight: '8px' }}
        >
          Save Changes
        </Button>
        <Button onClick={() => closePanel({ action: 'discard' })} style={{ marginRight: '8px' }}>
          Discard Changes
        </Button>
        <Button onClick={() => closePanel({ action: 'cancel' })}>Cancel</Button>
      </div>
    </div>
  );
};
console.log('Panel SDK ready!');
SDK.init();
SDK.ready().then(() => {
  // Get configuration passed from the opener
  const config = SDK.getConfiguration();
  const initialContext = config.context;
  showRootComponent(<PanelComponent initialContext={initialContext} />);

  console.log('Panel rendered with context:', initialContext);
});
