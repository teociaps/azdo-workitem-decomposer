import SDK from 'azure-devops-extension-sdk';
import {
  IHostPageLayoutService,
  CommonServiceIds,
  IHostNavigationService,
  PanelSize,
} from 'azure-devops-extension-api';

import { logger } from './core/common/logger';
import { InitialContext } from './core/models/initialContext';

const contextLogger = logger.createChild('ContextMenu');

const openPanel = async (context: InitialContext) => {
  contextLogger.debug('Opening panel...');
  const panelService = await SDK.getService<IHostPageLayoutService>(
    CommonServiceIds.HostPageLayoutService,
  );

  const contributionId = `${SDK.getExtensionContext().id}.panel`;
  panelService.openPanel(contributionId, {
    title: `Decompose Work Item #${context.workItemIds?.[0] || context.workItemId || context.id}`,
    size: PanelSize.Large,
    configuration: {
      context,
    },
    onClose: async (result) => {
      contextLogger.debug('Panel closed with result:', result);
      // TODO: handle the click outside the panel to avoid closing the panel involuntarily(?)
      const navigationService = await SDK.getService<IHostNavigationService>(
        CommonServiceIds.HostNavigationService,
      );
      navigationService.reload();
    },
  });
};

SDK.init();
SDK.ready().then(() => {
  SDK.register(`${SDK.getExtensionContext().id}.context-menu`, {
    execute: openPanel,
  });
});
