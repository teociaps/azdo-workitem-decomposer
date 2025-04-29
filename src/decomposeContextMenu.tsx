import * as SDK from 'azure-devops-extension-sdk';
import { IHostPageLayoutService, CommonServiceIds } from 'azure-devops-extension-api';
import { DialogComponent } from './components/decomposeDialog';

const openDialog = async (context: any) => {
  console.log('Opening custom dialog...');
  const dialogService = await SDK.getService<IHostPageLayoutService>(
    CommonServiceIds.HostPageLayoutService,
  );
  dialogService.openCustomDialog(SDK.getExtensionContext().id + '.addItemsDialog', {
    title: 'Work Item Toolbar Menu Modal',
    configuration: {
      context: context,
    },
    // lightDismiss: false,
    // TODO: use custom component for dialog
  });
  console.log(context);
};

SDK.init();
SDK.ready().then(() => {
  SDK.register(`${SDK.getExtensionContext().id}.contextMenu`, {
    execute: openDialog,
  });
});
