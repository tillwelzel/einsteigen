import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { ComputedRoute, MunichNetwork, NetworkMode } from '../types';

interface LineStringFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface PointFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface MapViewProps {
  network: MunichNetwork;
  networkMode: NetworkMode;
  fromStationId: string;
  toStationId: string;
  isDark: boolean;
  isRevealed: boolean;
  playerRoute: ComputedRoute | null;
  optimalRoute: ComputedRoute;
  highlightedRoute: 'both' | 'player' | 'optimal';
}

const MUNICH_CENTER: [number, number] = [11.5761, 48.1371];

function createBasemapStyle(isDark: boolean): maplibregl.StyleSpecification {
  const tileUrl = isDark
    ? 'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png'
    : 'https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png';

  return {
    version: 8,
    sources: {
      basemap: {
        type: 'raster',
        tiles: [
          tileUrl,
          tileUrl.replace('a.basemaps', 'b.basemaps'),
          tileUrl.replace('a.basemaps', 'c.basemaps'),
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'basemap-layer',
        type: 'raster',
        source: 'basemap',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

function routeToLineFeatures(
  network: MunichNetwork,
  route: ComputedRoute,
  role: 'player' | 'optimal',
): LineStringFeature[] {
  return route.legs
    .map((leg) => {
      const coords = leg.stationIds
        .map((id) => network.stations[id])
        .filter(Boolean)
        .map((st) => [st.lon, st.lat] as [number, number]);
      if (coords.length < 2) return null;
      const line = network.lines[leg.lineId];
      return {
        type: 'Feature' as const,
        properties: {
          lineId: leg.lineId,
          color: line?.color ?? '#0065ae',
          role,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: coords,
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
}

function routeToStopFeatures(
  network: MunichNetwork,
  route: ComputedRoute,
  role: 'player' | 'optimal',
): PointFeature[] {
  const seen = new Set<string>();
  const features: PointFeature[] = [];

  route.legs.forEach((leg, legIdx) => {
    const line = network.lines[leg.lineId];
    leg.stationIds.forEach((stId, stIdx) => {
      const isTransfer = legIdx > 0 && stIdx === 0;
      const isEndpoint =
        (legIdx === 0 && stIdx === 0) ||
        (legIdx === route.legs.length - 1 && stIdx === leg.stationIds.length - 1);
      if (isEndpoint) return;
      const key = `${stId}:${isTransfer ? 't' : 's'}`;
      if (seen.has(key)) return;
      seen.add(key);

      const st = network.stations[stId];
      if (!st) return;
      features.push({
        type: 'Feature',
        properties: {
          stationId: stId,
          name: st.name,
          color: line?.color ?? '#0065ae',
          isTransfer,
          role,
        },
        geometry: {
          type: 'Point',
          coordinates: [st.lon, st.lat],
        },
      });
    });
  });

  return features;
}

function createPinElement(
  kind: 'start' | 'end' | 'transfer',
  label: string,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center pointer-events-none select-none';

  const pill = document.createElement('div');
  if (kind === 'transfer') {
    pill.className =
      'mb-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-md whitespace-nowrap';
  } else {
    const badgeColor =
      kind === 'start'
        ? 'bg-emerald-600 text-white border-emerald-400/50'
        : 'bg-rose-600 text-white border-rose-400/50';
    pill.className = `mb-1.5 px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg border whitespace-nowrap ${badgeColor}`;
  }
  pill.textContent = label;
  wrapper.appendChild(pill);

  const dotWrap = document.createElement('div');
  dotWrap.className = 'relative flex items-center justify-center';

  if (kind !== 'transfer') {
    const pulse = document.createElement('span');
    pulse.className = `absolute w-6 h-6 rounded-full animate-pulse-ring ${
      kind === 'start' ? 'bg-emerald-500/50' : 'bg-rose-500/50'
    }`;
    dotWrap.appendChild(pulse);
  }

  const dot = document.createElement('span');
  if (kind === 'transfer') {
    dot.className =
      'w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-950 border-[3px] border-zinc-900 dark:border-white shadow-md';
  } else {
    dot.className = `w-4 h-4 rounded-full border-[3px] border-white dark:border-zinc-950 shadow-md ${
      kind === 'start' ? 'bg-emerald-500' : 'bg-rose-500'
    }`;
  }
  dotWrap.appendChild(dot);
  wrapper.appendChild(dotWrap);

  return wrapper;
}

export function MapView({
  network,
  networkMode,
  fromStationId,
  toStationId,
  isDark,
  isRevealed,
  playerRoute,
  optimalRoute,
  highlightedRoute,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const styleLoadedRef = useRef(false);

  // Initialize MapLibre instance
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: createBasemapStyle(isDark),
      center: MUNICH_CENTER,
      zoom: 11.4,
      minZoom: 9.2,
      maxZoom: 16.5,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    map.on('load', () => {
      styleLoadedRef.current = true;
    });

    mapRef.current = map;

    return () => {
      styleLoadedRef.current = false;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap light/dark basemap cleanly on theme change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    styleLoadedRef.current = false;
    map.setStyle(createBasemapStyle(isDark));
  }, [isDark]);

  // Render markers, faint network backdrop (when revealed), and route overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderOverlays = () => {
      // Clear previous HTML markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      const fromSt = network.stations[fromStationId];
      const toSt = network.stations[toStationId];
      if (!fromSt || !toSt) return;

      // Remove old GeoJSON layers/sources if present
      const layerIds = [
        'network-context-lines',
        'optimal-casing',
        'optimal-line',
        'player-casing',
        'player-line',
        'route-stops',
      ];
      for (const lid of layerIds) {
        if (map.getLayer(lid)) map.removeLayer(lid);
      }
      const sourceIds = ['network-context', 'optimal-route', 'player-route', 'route-stops'];
      for (const sid of sourceIds) {
        if (map.getSource(sid)) map.removeSource(sid);
      }

      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([fromSt.lon, fromSt.lat]);
      bounds.extend([toSt.lon, toSt.lat]);

      if (isRevealed) {
        // Subtle background network lines for spatial context
        const contextFeatures: LineStringFeature[] = [];
        for (const line of Object.values(network.lines)) {
          if (networkMode === 'us' && line.mode === 'tram') continue;
          for (const branch of line.branches) {
            const coords = branch
              .map((id) => network.stations[id])
              .filter(Boolean)
              .map((st) => [st.lon, st.lat] as [number, number]);
            if (coords.length >= 2) {
              contextFeatures.push({
                type: 'Feature',
                properties: { color: line.color },
                geometry: { type: 'LineString', coordinates: coords },
              });
            }
          }
        }

        map.addSource('network-context', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: contextFeatures },
        });
        map.addLayer({
          id: 'network-context-lines',
          type: 'line',
          source: 'network-context',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1.5,
            'line-opacity': isDark ? 0.18 : 0.16,
          },
        });

        const showOptimal =
          highlightedRoute === 'both' || highlightedRoute === 'optimal';
        const showPlayer =
          playerRoute !== null &&
          (highlightedRoute === 'both' || highlightedRoute === 'player');

        const casingColor = isDark ? '#09090b' : '#ffffff';

        // Optimal route layer
        if (showOptimal) {
          const optFeatures = routeToLineFeatures(network, optimalRoute, 'optimal');
          for (const f of optFeatures) {
            for (const c of f.geometry.coordinates) {
              bounds.extend(c as [number, number]);
            }
          }
          map.addSource('optimal-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: optFeatures },
          });
          map.addLayer({
            id: 'optimal-casing',
            type: 'line',
            source: 'optimal-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': casingColor,
              'line-width': showPlayer ? 8 : 9,
              'line-opacity': showPlayer ? 0.75 : 0.95,
            },
          });
          map.addLayer({
            id: 'optimal-line',
            type: 'line',
            source: 'optimal-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': showPlayer ? 4.5 : 5.5,
              'line-dasharray': showPlayer ? [2.2, 1.6] : [1],
              'line-opacity': showPlayer ? 0.85 : 1,
            },
          });
        }

        // Player route layer
        if (showPlayer && playerRoute) {
          const playerFeatures = routeToLineFeatures(network, playerRoute, 'player');
          for (const f of playerFeatures) {
            for (const c of f.geometry.coordinates) {
              bounds.extend(c as [number, number]);
            }
          }
          map.addSource('player-route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: playerFeatures },
          });
          map.addLayer({
            id: 'player-casing',
            type: 'line',
            source: 'player-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': casingColor,
              'line-width': 9,
              'line-opacity': 0.95,
            },
          });
          map.addLayer({
            id: 'player-line',
            type: 'line',
            source: 'player-route',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 5.5,
              'line-opacity': 1,
            },
          });
        }

        // Stop dots along the focused route(s)
        const activeRouteForStops =
          highlightedRoute === 'optimal' || !playerRoute
            ? optimalRoute
            : playerRoute;
        const stopFeatures = routeToStopFeatures(
          network,
          activeRouteForStops,
          highlightedRoute === 'optimal' ? 'optimal' : 'player',
        );
        map.addSource('route-stops', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: stopFeatures },
        });
        map.addLayer({
          id: 'route-stops',
          type: 'circle',
          source: 'route-stops',
          paint: {
            'circle-radius': ['case', ['get', 'isTransfer'], 5.5, 3.5],
            'circle-color': isDark ? '#18181b' : '#ffffff',
            'circle-stroke-color': ['get', 'color'],
            'circle-stroke-width': ['case', ['get', 'isTransfer'], 3, 2],
          },
        });

        // Transfer hub markers with labels
        const transferStations = new Set<string>();
        const routesForTransfers =
          highlightedRoute === 'optimal'
            ? [optimalRoute]
            : highlightedRoute === 'player' && playerRoute
              ? [playerRoute]
              : playerRoute
                ? [playerRoute]
                : [optimalRoute];

        for (const r of routesForTransfers) {
          for (let i = 1; i < r.legs.length; i++) {
            transferStations.add(r.legs[i].fromStationId);
          }
        }

        for (const tId of transferStations) {
          if (tId === fromStationId || tId === toStationId) continue;
          const st = network.stations[tId];
          if (!st) continue;
          const m = new maplibregl.Marker({
            element: createPinElement('transfer', st.name),
            anchor: 'bottom',
            offset: [0, 7],
          })
            .setLngLat([st.lon, st.lat])
            .addTo(map);
          markersRef.current.push(m);
        }
      }

      // Start & End pins (always visible)
      const startMarker = new maplibregl.Marker({
        element: createPinElement('start', fromSt.name),
        anchor: 'bottom',
        offset: [0, 8],
      })
        .setLngLat([fromSt.lon, fromSt.lat])
        .addTo(map);

      const endMarker = new maplibregl.Marker({
        element: createPinElement('end', toSt.name),
        anchor: 'bottom',
        offset: [0, 8],
      })
        .setLngLat([toSt.lon, toSt.lat])
        .addTo(map);

      markersRef.current.push(startMarker, endMarker);

      // Fit viewport cleanly accounting for the floating panel
      const isDesktop = window.innerWidth >= 768;
      map.fitBounds(bounds, {
        padding: isDesktop
          ? { top: 96, bottom: 72, left: 450, right: 80 }
          : { top: 88, bottom: 380, left: 48, right: 48 },
        maxZoom: isRevealed ? 13.5 : 12.6,
        duration: 650,
      });
    };

    if (map.isStyleLoaded()) {
      renderOverlays();
    } else {
      map.once('load', renderOverlays);
      map.once('style.load', renderOverlays);
    }
  }, [
    network,
    networkMode,
    fromStationId,
    toStationId,
    isDark,
    isRevealed,
    playerRoute,
    optimalRoute,
    highlightedRoute,
  ]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-zinc-100 dark:bg-zinc-950"
      aria-label="Munich Transit Map"
    />
  );
}
