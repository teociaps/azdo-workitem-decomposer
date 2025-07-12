import React, { useEffect, useState, useCallback } from 'react';
import { MessageCard, MessageCardSeverity } from 'azure-devops-ui/MessageCard';
import { Icon } from 'azure-devops-ui/Icon';
import { Button } from 'azure-devops-ui/Button';
import { Spinner, SpinnerSize } from 'azure-devops-ui/Spinner';
import './AutosaveToast.scss';

export interface AutosaveToastProps {
  isVisible: boolean;
  type: 'loading' | 'success' | 'error';
  message: string;
  onDismiss?: () => void;
}

export function AutosaveToast({ isVisible, type, message, onDismiss }: AutosaveToastProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const handleDismiss = useCallback(() => {
    if (onDismiss) {
      onDismiss();
    }
  }, [onDismiss]);

  // Handle visibility changes with animations
  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      setIsAnimatingOut(false);
    } else if (shouldRender) {
      setIsAnimatingOut(true);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsAnimatingOut(false);
      }, 300); // Match CSS animation duration
      return () => clearTimeout(timer);
    }
  }, [isVisible, shouldRender]);

  if (!shouldRender) {
    return null;
  }

  const getSeverity = (): MessageCardSeverity => {
    switch (type) {
      case 'error':
        return MessageCardSeverity.Error;
      case 'loading':
      case 'success':
      default:
        return MessageCardSeverity.Info;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'loading':
        return <Spinner size={SpinnerSize.small} />;
      case 'success':
        return <Icon iconName="Completed" className="autosave-toast-icon" />;
      case 'error':
        return <Icon iconName="ErrorBadge" className="autosave-toast-icon" />;
      default:
        return <Icon iconName="Info" className="autosave-toast-icon" />;
    }
  };

  const getCardClass = () => {
    return `autosave-toast-card autosave-toast-card--${type}`;
  };

  return (
    <div
      className={`autosave-toast ${isAnimatingOut ? 'autosave-toast--exit' : 'autosave-toast--enter'}`}
      role="alert"
      aria-live="polite"
    >
      <MessageCard
        iconProps={{ style: { display: 'none' } }}
        severity={getSeverity()}
        className={getCardClass()}
      >
        <div className="autosave-toast-content">
          <div className="flex-row flex-center">
            <div className="autosave-toast-icon-container">{getIcon()}</div>
            <div className="autosave-toast-message">{message}</div>
          </div>
          {type === 'error' && onDismiss && (
            <div className="autosave-toast-actions">
              <Button
                text="Dismiss"
                onClick={handleDismiss}
                subtle
                className="autosave-toast-dismiss-btn"
              />
            </div>
          )}
        </div>
      </MessageCard>
    </div>
  );
}
