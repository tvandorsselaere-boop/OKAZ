// OKAZ Geolocation Hook v1.0.0
// Hook React pour gérer la position de l'utilisateur

'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// INTERFACES
// ============================================================================

export interface GeolocationState {
  // Position actuelle (null si pas encore obtenue ou refusée)
  position: {
    lat: number;
    lng: number;
  } | null;

  // État de la permission
  permissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';

  // Chargement en cours
  isLoading: boolean;

  // Erreur éventuelle
  error: string | null;

  // Timestamp de la dernière mise à jour
  lastUpdated: Date | null;
}

export interface GeolocationOptions {
  // Activer la haute précision (GPS)
  enableHighAccuracy?: boolean;

  // Timeout en ms
  timeout?: number;

  // Âge max du cache en ms
  maximumAge?: number;

  // Demander automatiquement au mount
  requestOnMount?: boolean;
}

// ============================================================================
// STORAGE
// ============================================================================

const STORAGE_KEY = 'okaz_user_location';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface StoredLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

function getStoredLocation(): StoredLocation | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed: StoredLocation = JSON.parse(stored);

    // Vérifier si le cache est encore valide
    if (Date.now() - parsed.timestamp > CACHE_DURATION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function storeLocation(lat: number, lng: number): void {
  if (typeof window === 'undefined') return;

  try {
    const data: StoredLocation = {
      lat,
      lng,
      timestamp: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

function clearStoredLocation(): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useGeolocation(options: GeolocationOptions = {}): GeolocationState & {
  requestPermission: () => Promise<void>;
  clearPosition: () => void;
} {
  const {
    enableHighAccuracy = false,
    timeout = 10000,
    maximumAge = 300000, // 5 minutes
    requestOnMount = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    permissionState: 'prompt',
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  // Vérifier le support et la permission au mount
  useEffect(() => {
    // Check si geolocation est supportée
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        permissionState: 'unavailable',
        error: 'Géolocalisation non supportée par ce navigateur',
      }));
      return;
    }

    // Charger depuis le cache
    const cached = getStoredLocation();
    if (cached) {
      setState(prev => ({
        ...prev,
        position: { lat: cached.lat, lng: cached.lng },
        lastUpdated: new Date(cached.timestamp),
      }));
    }

    // Vérifier l'état de la permission
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then(result => {
        setState(prev => ({
          ...prev,
          permissionState: result.state as GeolocationState['permissionState'],
        }));

        // Écouter les changements de permission
        result.onchange = () => {
          setState(prev => ({
            ...prev,
            permissionState: result.state as GeolocationState['permissionState'],
          }));

          // Si permission révoquée, effacer la position
          if (result.state === 'denied') {
            clearStoredLocation();
            setState(prev => ({
              ...prev,
              position: null,
              error: 'Permission de géolocalisation refusée',
            }));
          }
        };
      }).catch(() => {
        // Permissions API non supportée, on reste sur 'prompt'
      });
    }

    // Demander au mount si configuré
    if (requestOnMount && !cached) {
      requestPosition();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fonction pour demander la position
  const requestPosition = useCallback(async () => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Géolocalisation non supportée',
        permissionState: 'unavailable',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
    }));

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy,
          timeout,
          maximumAge,
        });
      });

      const { latitude: lat, longitude: lng } = position.coords;

      // Stocker en cache
      storeLocation(lat, lng);

      setState(prev => ({
        ...prev,
        position: { lat, lng },
        permissionState: 'granted',
        isLoading: false,
        error: null,
        lastUpdated: new Date(),
      }));
    } catch (err) {
      const error = err as GeolocationPositionError;

      let errorMessage: string;
      let permissionState: GeolocationState['permissionState'] = state.permissionState;

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Permission de géolocalisation refusée';
          permissionState = 'denied';
          clearStoredLocation();
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Position non disponible';
          break;
        case error.TIMEOUT:
          errorMessage = 'Délai de géolocalisation dépassé';
          break;
        default:
          errorMessage = 'Erreur de géolocalisation';
      }

      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        permissionState,
      }));
    }
  }, [enableHighAccuracy, timeout, maximumAge, state.permissionState]);

  // Fonction pour effacer la position
  const clearPosition = useCallback(() => {
    clearStoredLocation();
    setState(prev => ({
      ...prev,
      position: null,
      lastUpdated: null,
    }));
  }, []);

  return {
    ...state,
    requestPermission: requestPosition,
    clearPosition,
  };
}

// ============================================================================
// UTILITY HOOK
// ============================================================================

/**
 * Hook simplifié qui retourne juste la position ou null
 */
export function useUserPosition(): { lat: number; lng: number } | null {
  const { position } = useGeolocation();
  return position;
}
