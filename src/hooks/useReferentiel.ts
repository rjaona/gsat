import { useState, useEffect } from 'react';
import type { Referentiel } from '@/types';
import { subscribeReferentiel } from '@/services/referentielService';

interface UseReferentielResult {
  referentiel: Referentiel | null;
  loading: boolean;
  error: string | null;
}

/**
 * `version` est obligatoire et peut valoir null tant que la campagne n'est pas
 * chargee : dans ce cas le hook ne s'abonne a rien, plutot que de retomber sur
 * un referentiel arbitraire. Un defaut 'v3_0' ferait saisir une evaluation
 * Faritany contre le referentiel national.
 */
export function useReferentiel(version: string | null): UseReferentielResult {
  const [referentiel, setReferentiel] = useState<Referentiel | null>(null);
  const [loading, setLoading] = useState(version !== null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!version) {
      setReferentiel(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const unsub = subscribeReferentiel(
      version,
      (data) => { setReferentiel(data); setLoading(false); },
      (err) => { setError(err.message); setLoading(false); },
    );
    return unsub;
  }, [version]);

  return { referentiel, loading, error };
}
