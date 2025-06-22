import { useState, useEffect } from 'react';
import settingsService, { DecomposerSettings } from '../../services/settingsService';

interface UseDeleteConfirmationResult {
  isEnabled: boolean;
  onlyForItemsWithChildren: boolean;
  showVisualCues: boolean;
  shouldShowConfirmation: (_hasChildren: boolean) => boolean;
}

export function useDeleteConfirmation(): UseDeleteConfirmationResult {
  const [settings, setSettings] = useState<DecomposerSettings['deleteConfirmation']>({
    enabled: true,
    onlyForItemsWithChildren: false,
    showVisualCues: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = await settingsService.getSettings();
        setSettings(currentSettings.deleteConfirmation);
      } catch (error) {
        console.error('Failed to load delete confirmation settings:', error);
      }
    };

    loadSettings();
  }, []);

  const shouldShowConfirmation = (hasChildren: boolean): boolean => {
    if (!settings.enabled) return false;
    if (settings.onlyForItemsWithChildren) return hasChildren;
    return true;
  };

  return {
    isEnabled: settings.enabled,
    onlyForItemsWithChildren: settings.onlyForItemsWithChildren,
    showVisualCues: settings.showVisualCues,
    shouldShowConfirmation,
  };
}
