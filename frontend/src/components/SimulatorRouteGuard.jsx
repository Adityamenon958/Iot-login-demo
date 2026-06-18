import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Spinner } from 'react-bootstrap';

export default function SimulatorRouteGuard({ children }) {
  const [state, setState] = useState({ loading: true, enabled: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get('/api/sim/availability', { withCredentials: true });
        if (!cancelled) {
          setState({ loading: false, enabled: res.data.enabled === true });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, enabled: false });
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" size="sm" className="me-2" />
        Checking simulator access…
      </div>
    );
  }

  if (!state.enabled) {
    return (
      <Alert variant="secondary" className="m-4">
        Simulator is not available in this environment. It runs on Azure production by default.
        For local testing, set <code>ENABLE_SIMULATOR=true</code> in your <code>.env</code> and restart the server.
      </Alert>
    );
  }

  return children;
}
