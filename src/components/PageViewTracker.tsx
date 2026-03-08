import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { saasmaker } from '../lib/saasmaker';

export function PageViewTracker() {
  const location = useLocation();

  useEffect(() => {
    saasmaker?.analytics.track({ name: 'page_view', url: location.pathname }).catch(() => {});
  }, [location.pathname]);

  return null;
}
