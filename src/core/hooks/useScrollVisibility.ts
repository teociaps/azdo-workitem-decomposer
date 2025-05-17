import { useState, useEffect, RefObject } from 'react';

interface ScrollVisibilityResult {
  isScrollable: boolean;
  showTopBorder: boolean;
  showBottomBorder: boolean;
}

/**
 * A custom React hook that monitors scroll state of an element and determines border visibility.
 * 
 * This hook detects if an element is scrollable and tracks when content is scrolled away from
 * the top or bottom edges, which can be used to show visual indicators like shadow borders.
 * 
 * @param scrollableRef - React ref object pointing to the scrollable HTML element to monitor
 * @param dependencies - Optional array of dependencies that will trigger recalculation of scroll state when changed
 * 
 * @returns An object containing scroll visibility states:
 *   - `isScrollable` - Whether the referenced element has overflow content that can be scrolled
 *   - `showTopBorder` - Whether content has been scrolled down (content above is hidden)
 *   - `showBottomBorder` - Whether content has been scrolled up from bottom (content below is hidden)
 * 
 * @example
 * ```tsx
 * const scrollableRef = useRef<HTMLDivElement>(null);
 * const { isScrollable, showTopBorder, showBottomBorder } = useScrollVisibility(scrollableRef);
 * 
 * return (
 *   <div 
 *     ref={scrollableRef} 
 *     className={`scrollable-container ${showTopBorder ? 'show-top-shadow' : ''} ${showBottomBorder ? 'show-bottom-shadow' : ''}`}
 *   >
 *     {content}
 *   </div>
 * );
 * ```
 */
export function useScrollVisibility(
  scrollableRef: RefObject<HTMLElement>,
  dependencies: any[] = []
): ScrollVisibilityResult {
  const [isScrollable, setIsScrollable] = useState(false);
  const [showTopBorder, setShowTopBorder] = useState(false);
  const [showBottomBorder, setShowBottomBorder] = useState(false);

  // Check if element is scrollable and update border visibility
  useEffect(() => {
    const scrollElement = scrollableRef.current;
    if (!scrollElement) {
      setIsScrollable(false);
      setShowTopBorder(false);
      setShowBottomBorder(false);
      return;
    }

    const checkScrollable = () => {
      if (scrollableRef.current) {
        const { scrollHeight, clientHeight } = scrollableRef.current;
        const currentlyScrollable = clientHeight > 0 && scrollHeight > (clientHeight + 1);
        
        setIsScrollable(currentlyScrollable);
        
        // Initial border visibility
        if (currentlyScrollable) {
          const { scrollTop } = scrollableRef.current;
          setShowTopBorder(scrollTop > 0);
          setShowBottomBorder(scrollTop + clientHeight < scrollHeight - 1);
        } else {
          setShowTopBorder(false);
          setShowBottomBorder(false);
        }
      }
    };

    // Check after layout stabilizes
    const checkTimerId = setTimeout(checkScrollable, 100);

    // Update borders on scroll
    const updateBorders = () => {
      if (!scrollElement) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollElement;
      const isScrollable = scrollHeight > clientHeight + 1;
      
      setShowTopBorder(isScrollable && scrollTop > 0);
      setShowBottomBorder(isScrollable && scrollTop + clientHeight < scrollHeight - 1);
    };

    scrollElement.addEventListener('scroll', updateBorders);
    
    // Also track resize changes
    const resizeObserver = new ResizeObserver(() => {
      checkScrollable();
      updateBorders();
    });
    
    resizeObserver.observe(scrollElement);

    return () => {
      clearTimeout(checkTimerId);
      scrollElement.removeEventListener('scroll', updateBorders);
      resizeObserver.disconnect();
    };
  }, [scrollableRef, ...dependencies]);

  return { isScrollable, showTopBorder, showBottomBorder };
}
