import React from 'react';
import './Badge.scss';

export interface BadgeProps {
  text: string;
  backgroundColor?: string;
  textColor?: string;
  size?: 'very-small' | 'small' | 'medium' | 'large';
  variant?: 'beta' | 'new' | 'warning' | 'info' | 'custom';
  title?: string;
  className?: string;
}

export function Badge({
  text,
  backgroundColor,
  textColor,
  size = 'medium',
  variant = 'custom',
  title,
  className = '',
}: BadgeProps) {
  const badgeClasses = [
    'badge',
    `badge-${size}`,
    variant !== 'custom' ? `badge-${variant}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const customStyles: React.CSSProperties = {};
  if (variant === 'custom') {
    if (backgroundColor) customStyles.backgroundColor = backgroundColor;
    if (textColor) customStyles.color = textColor;
  }

  return (
    <span className={badgeClasses} style={customStyles} title={title}>
      {text}
    </span>
  );
}
