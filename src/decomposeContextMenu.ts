import SDK from 'azure-devops-extension-sdk';
import { IHostPageLayoutService, CommonServiceIds, IHostNavigationService, PanelSize } from 'azure-devops-extension-api';

const openPanel = async (context: any) => {
  console.log('Opening panel...');
  const panelService = await SDK.getService<IHostPageLayoutService>(
    CommonServiceIds.HostPageLayoutService,
  );

  const contributionId = SDK.getExtensionContext().id + '.addItemsPanel';
  panelService.openPanel(contributionId, {
    title: 'Work Item Toolbar Menu Panel',
    description: 'Decompose Work Item',
    size: PanelSize.Large,
    configuration: {
      context: context,
    },
    onClose: async (result) => {
      console.log('Panel closed with result:', result);
      // const navigationService = await SDK.getService<IHostNavigationService>(CommonServiceIds.HostNavigationService);
      // navigationService.reload();
    },
  });
};

SDK.init();
SDK.ready().then(() => {
  SDK.register(`${SDK.getExtensionContext().id}.contextMenu`, {
    execute: openPanel,
  });
});
