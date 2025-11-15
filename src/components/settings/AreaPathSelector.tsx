import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Button } from 'azure-devops-ui/Button';
import { Icon } from 'azure-devops-ui/Icon';
import { AreaPathNode } from '../../services/areaPathService';
import './AreaPathSelector.scss';

interface AreaPathSelectorProps {
  selectedAreaPath: string;
  projectAreaPaths: AreaPathNode[];
  onAreaPathChange: (_areaPath: string) => void;
  disabled?: boolean;
}

interface AreaPathTreeItem {
  areaPath: string;
  displayName: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

export const AreaPathSelector: React.FC<AreaPathSelectorProps> = ({
  selectedAreaPath,
  projectAreaPaths,
  onAreaPathChange,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState(new Set<string>());
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownContentRef = useRef<HTMLDivElement>(null);

  // Get parent path from full path
  const getParentPath = useCallback((path: string): string | null => {
    const lastBackslash = path.lastIndexOf('\\');
    return lastBackslash > 0 ? path.substring(0, lastBackslash) : null;
  }, []);

  // Build comprehensive search index of all area paths
  const searchIndex = useMemo(() => {
    const items: AreaPathTreeItem[] = [];

    // Add default option first
    items.push({
      areaPath: 'DEFAULT',
      displayName: 'Global Settings (default for all area paths)',
      depth: 0,
      hasChildren: false,
      isExpanded: false,
    });

    if (projectAreaPaths.length === 0) {
      return items;
    }

    // Build parent-child relationships
    const pathMap = new Map<string, AreaPathNode>();
    const childrenMap = new Map<string, AreaPathNode[]>();

    projectAreaPaths.forEach((areaPath) => {
      pathMap.set(areaPath.path, areaPath);
      const parentPath = getParentPath(areaPath.path);
      if (parentPath) {
        if (!childrenMap.has(parentPath)) {
          childrenMap.set(parentPath, []);
        }
        childrenMap.get(parentPath)!.push(areaPath);
      }
    });

    // Recursively build complete tree (always expanded for search)
    const addToSearchIndex = (parentPath: string | null, depth: number) => {
      const children = parentPath
        ? childrenMap.get(parentPath) || []
        : projectAreaPaths.filter((ap) => !getParentPath(ap.path));

      children
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((areaPath) => {
          const hasChildren = childrenMap.has(areaPath.path);

          items.push({
            areaPath: areaPath.path,
            displayName: areaPath.name,
            depth,
            hasChildren,
            isExpanded: true, // Always expanded in search index
          });

          if (hasChildren) {
            addToSearchIndex(areaPath.path, depth + 1);
          }
        });
    };

    addToSearchIndex(null, 0);
    return items;
  }, [projectAreaPaths, getParentPath]);

  // Build display tree that respects current expansion state
  const displayTreeData = useMemo(() => {
    const items: AreaPathTreeItem[] = [];

    // Add default option first
    items.push({
      areaPath: 'DEFAULT',
      displayName: 'Global Settings (default for all area paths)',
      depth: 0,
      hasChildren: false,
      isExpanded: false,
    });

    if (projectAreaPaths.length === 0) {
      return items;
    }

    // Build parent-child relationships
    const pathMap = new Map<string, AreaPathNode>();
    const childrenMap = new Map<string, AreaPathNode[]>();

    projectAreaPaths.forEach((areaPath) => {
      pathMap.set(areaPath.path, areaPath);
      const parentPath = getParentPath(areaPath.path);
      if (parentPath) {
        if (!childrenMap.has(parentPath)) {
          childrenMap.set(parentPath, []);
        }
        childrenMap.get(parentPath)!.push(areaPath);
      }
    });

    // Recursively build tree respecting expansion state
    const addToDisplayTree = (parentPath: string | null, depth: number) => {
      const children = parentPath
        ? childrenMap.get(parentPath) || []
        : projectAreaPaths.filter((ap) => !getParentPath(ap.path));

      children
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((areaPath) => {
          const hasChildren = childrenMap.has(areaPath.path);
          const isExpanded = expandedPaths.has(areaPath.path);

          items.push({
            areaPath: areaPath.path,
            displayName: areaPath.name,
            depth,
            hasChildren,
            isExpanded,
          });

          if (hasChildren && isExpanded) {
            addToDisplayTree(areaPath.path, depth + 1);
          }
        });
    };

    addToDisplayTree(null, 0);
    return items;
  }, [projectAreaPaths, expandedPaths, getParentPath]);

  // Helper function to get search text (plain string for searching)
  const getSearchText = useCallback((item: AreaPathTreeItem) => {
    // Add "(root)" indicator for root area paths that have children
    if (item.depth === 0 && item.hasChildren && item.areaPath !== 'DEFAULT') {
      return `${item.displayName} (root)`;
    }
    return item.displayName;
  }, []);

  // Helper function to format display name with root indicator (React element for display)
  const formatDisplayName = useCallback((item: AreaPathTreeItem) => {
    // Add "(root)" indicator for root area paths that have children
    if (item.depth === 0 && item.hasChildren && item.areaPath !== 'DEFAULT') {
      return (
        <>
          {item.displayName} <span className="root-indicator">(root)</span>
        </>
      );
    }
    return item.displayName;
  }, []);

  // Filter tree data based on search term - search against full index but respect display hierarchy
  const filteredTreeData = useMemo(() => {
    if (!searchTerm.trim()) {
      return displayTreeData;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    const matchingItems = new Set<string>();
    const parentPaths = new Set<string>();

    // Search in the complete index (includes all area paths, even those under collapsed nodes)
    // This ensures we can find children even when their parents are collapsed
    searchIndex.forEach((item) => {
      const searchText = getSearchText(item);
      const isDirectMatch =
        searchText.toLowerCase().includes(lowerSearchTerm) ||
        item.areaPath.toLowerCase().includes(lowerSearchTerm);

      if (isDirectMatch) {
        matchingItems.add(item.areaPath);

        // Add all parent paths to ensure hierarchy is visible
        let currentPath = item.areaPath;
        while (currentPath !== 'DEFAULT') {
          const parentPath = getParentPath(currentPath);
          if (parentPath) {
            parentPaths.add(parentPath);
            currentPath = parentPath;
          } else {
            break;
          }
        }
      }
    });

    // Auto-expand parent nodes that contain matching children
    const newExpandedPaths = new Set(expandedPaths);
    let expansionChanged = false;
    parentPaths.forEach((parentPath) => {
      if (!newExpandedPaths.has(parentPath)) {
        newExpandedPaths.add(parentPath);
        expansionChanged = true;
      }
    });

    // Only update expansion state if it actually changed
    if (expansionChanged) {
      setTimeout(() => setExpandedPaths(newExpandedPaths), 0);
    }

    // Use the appropriate expansion state for building the tree
    const currentExpandedPaths = expansionChanged ? newExpandedPaths : expandedPaths;

    // Build filtered results from search index, maintaining hierarchy
    const result: AreaPathTreeItem[] = [];

    // Always include default option
    const defaultItem = searchIndex.find((item) => item.areaPath === 'DEFAULT');
    if (defaultItem) {
      result.push(defaultItem);
    }

    // Recursively add matching items and their parents
    const addToResult = (parentPath: string | null, depth: number) => {
      searchIndex
        .filter((item) => {
          if (item.areaPath === 'DEFAULT') return false;

          const itemParentPath = getParentPath(item.areaPath);
          const isDirectChild =
            (parentPath === null && itemParentPath === null) ||
            (parentPath !== null && itemParentPath === parentPath);

          return (
            isDirectChild && (matchingItems.has(item.areaPath) || parentPaths.has(item.areaPath))
          );
        })
        .forEach((item) => {
          const isExpanded = currentExpandedPaths.has(item.areaPath);
          result.push({
            ...item,
            depth,
            isExpanded,
          });

          if (item.hasChildren && isExpanded) {
            addToResult(item.areaPath, depth + 1);
          }
        });
    };

    addToResult(null, 0);
    return result;
  }, [searchIndex, displayTreeData, searchTerm, getParentPath, expandedPaths, getSearchText]);

  // Helper function to highlight matching text in search results
  const highlightSearchTerm = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm.trim()) {
      return text;
    }

    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="search-highlight">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }, []);

  const getSelectedDisplayText = useCallback(() => {
    if (selectedAreaPath === 'DEFAULT') {
      return 'Global Settings (default)';
    }

    const selectedNode = projectAreaPaths.find((ap) => ap.path === selectedAreaPath);
    return selectedNode ? selectedNode.path : selectedAreaPath;
  }, [selectedAreaPath, projectAreaPaths]);

  // Handle dropdown toggle
  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => {
        if (!prev) {
          // When opening, clear search and focus search input
          setSearchTerm('');
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        return !prev;
      });
    }
  }, [disabled]);

  // Handle item selection
  const handleItemClick = useCallback(
    (areaPath: string) => {
      onAreaPathChange(areaPath);
      setIsOpen(false);
      setSearchTerm('');
      setFocusedIndex(-1);
    },
    [onAreaPathChange],
  );

  // Handle search input change
  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  }, []);

  // Handle search input key events
  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setSearchTerm('');
        setIsOpen(false);
        setFocusedIndex(-1);
        dropdownRef.current?.focus();
      } else if (event.key === 'Enter' && filteredTreeData.length > 0) {
        // If there's a focused item, select it, otherwise select first filtered item
        if (focusedIndex >= 0 && focusedIndex < filteredTreeData.length) {
          handleItemClick(filteredTreeData[focusedIndex].areaPath);
        } else {
          const firstItem =
            filteredTreeData.find((item) => item.areaPath !== 'DEFAULT') || filteredTreeData[0];
          handleItemClick(firstItem.areaPath);
        }
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = prev >= filteredTreeData.length - 1 ? 0 : prev + 1;
          return newIndex;
        });
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusedIndex((prev) => {
          const newIndex = prev <= 0 ? filteredTreeData.length - 1 : prev - 1;
          return newIndex;
        });
      } else if (
        event.key === 'ArrowRight' &&
        focusedIndex >= 0 &&
        focusedIndex < filteredTreeData.length
      ) {
        event.preventDefault();
        const item = filteredTreeData[focusedIndex];
        if (item.hasChildren && !expandedPaths.has(item.areaPath)) {
          setExpandedPaths((prev) => new Set([...prev, item.areaPath]));
        }
      } else if (
        event.key === 'ArrowLeft' &&
        focusedIndex >= 0 &&
        focusedIndex < filteredTreeData.length
      ) {
        event.preventDefault();
        const item = filteredTreeData[focusedIndex];
        if (item.hasChildren && expandedPaths.has(item.areaPath)) {
          setExpandedPaths((prev) => {
            const newSet = new Set(prev);
            newSet.delete(item.areaPath);
            return newSet;
          });
        }
      }
      // Prevent event bubbling to avoid dropdown close
      event.stopPropagation();
    },
    [filteredTreeData, handleItemClick, focusedIndex, expandedPaths],
  );
  const handleExpandToggle = useCallback(
    (areaPath: string, event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      setExpandedPaths((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(areaPath)) {
          newSet.delete(areaPath);
        } else {
          newSet.add(areaPath);
        }
        return newSet;
      });
    },
    [],
  );

  // Effect to handle focus updates and scrolling
  useEffect(() => {
    if (focusedIndex >= 0 && dropdownContentRef.current) {
      const items = dropdownContentRef.current.querySelectorAll('.area-path-item');
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [focusedIndex]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="area-path-selector" ref={dropdownRef}>
      <Button
        className={`area-path-selector-button ${isOpen ? 'open' : ''}`}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            if (!isOpen) {
              setIsOpen(true);
              setFocusedIndex(0);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }
          }
        }}
        disabled={disabled}
        ariaLabel="Select area path"
        tabIndex={0}
      >
        <div className="button-content">
          <span className="button-text">{getSelectedDisplayText()}</span>
          <Icon iconName={isOpen ? 'ChevronUp' : 'ChevronDown'} className="button-icon" />
        </div>
      </Button>

      {isOpen && (
        <div className="area-path-dropdown">
          <div className="area-path-dropdown-header">
            <div className="search-container">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search area paths..."
                value={searchTerm}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className="search-input"
              />
              <Icon iconName="Search" className="search-icon" />
            </div>
          </div>

          <div className="area-path-dropdown-content" ref={dropdownContentRef}>
            {filteredTreeData.map((item, index) => {
              const isSelected = item.areaPath === selectedAreaPath;
              const isFocused = index === focusedIndex;
              const paddingLeft = 12 + item.depth * 20;

              return (
                <div
                  key={item.areaPath}
                  className={`area-path-item ${isSelected ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
                  style={{ paddingLeft: `${paddingLeft}px` }}
                  onClick={() => handleItemClick(item.areaPath)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <div className="area-path-item-content">
                    {item.hasChildren ? (
                      <Button
                        className="expand-button"
                        iconProps={{
                          iconName: item.isExpanded ? 'ChevronDown' : 'ChevronRight',
                        }}
                        onClick={(e) => {
                          if ('button' in e) {
                            handleExpandToggle(item.areaPath, e as React.MouseEvent<HTMLElement>);
                          }
                        }}
                        subtle
                        ariaLabel={item.isExpanded ? 'Collapse' : 'Expand'}
                      />
                    ) : (
                      <div className="expand-button-spacer" />
                    )}

                    <span className="area-path-name">
                      {searchTerm.trim()
                        ? highlightSearchTerm(getSearchText(item), searchTerm)
                        : formatDisplayName(item)}
                    </span>

                    {isSelected && <Icon iconName="CheckMark" className="selected-icon" />}
                  </div>
                </div>
              );
            })}

            {filteredTreeData.length === 0 && searchTerm.trim() && (
              <div className="no-results">
                <span>No area paths match your search</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
