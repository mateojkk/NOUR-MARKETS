import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * ScrollToTop component resets the scroll position of the main-scroll container
 * whenever the route changes. This prevents the "starting at the bottom" issue
 * when navigating between pages.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Find the main scroll container
    const mainScroll = document.querySelector(".main-scroll");
    if (mainScroll) {
      mainScroll.scrollTop = 0;
    } else {
      // Fallback to window scroll if container isn't found
      window.scrollTo(0, 0);
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
