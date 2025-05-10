import 'es6-promise/auto';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import './common.scss';

export function showRootComponent(component: React.ReactElement<any>) {
  ReactDOM.render(component, document.getElementById('root'));
}

export const GITHUB_REPO_BASE_URL = 'https://github.com/teociaps/azdo-workitem-decompose';

/**
 * Gets appropriate text color (black/white) for a given background color.
 * 
 * @param hexColor - Background color in hex format (e.g. '#FFFFFF')
 * @returns '#000000' for light backgrounds or '#FFFFFF' for dark backgrounds
 */
export const getTextColorForBackground = (hexColor: string): string => {
  if (!hexColor) return '#000000';
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
};