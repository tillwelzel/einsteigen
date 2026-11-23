import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type {
  ComputedRoute,
  MapStyleMode,
  MunichNetwork,
  NetworkMode,
} from '../types';

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
  startLabel: string;
  endLabel: string;
  isDark: boolean;
  mapStyleMode: MapStyleMode;
  isHome: boolean;
  isRevealed: boolean;
  playerRoute: ComputedRoute | null;
  optimalRoute: ComputedRoute;
  highlightedRoute: 'both' | 'player' | 'optimal';
}

const MUNICH_CENTER: [number, number] = [11.5761, 48.1371];

const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/dark';

function createSatelliteStyle(): maplibregl.StyleSpecification {
  return {
    version: 8,
    sources: {
      'esri-world-imagery': {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution:
          'Tiles &copy; <a href="https://www.esri.com/" target="_blank">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
    },
    layers: [
      {
        id: 'esri-world-imagery-layer',
        type: 'raster',
        source: 'esri-world-imagery',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

function getBasemapKey(mapStyleMode: MapStyleMode, isDark: boolean): string {
  if (mapStyleMode === 'satellite') return 'satellite';
  return isDark ? 'standard-dark' : 'standard-light';
}

function getBasemapStyle(
  mapStyleMode: MapStyleMode,
  isDark: boolean,
): string | maplibregl.StyleSpecification {
  if (mapStyleMode === 'satellite') {
    return createSatelliteStyle();
  }
  return isDark ? OPENFREEMAP_DARK_STYLE : OPENFREEMAP_LIGHT_STYLE;
}

function setBasemapLabelsVisibility(map: maplibregl.Map, visible: boolean) {
  const layers = map.getStyle()?.layers ?? [];
  const visibility = visible ? 'visible' : 'none';
  for (const layer of layers) {
    if (layer.type === 'symbol') {
      try {
        map.setLayoutProperty(layer.id, 'visibility', visibility);
      } catch {
        // Ignore layers that cannot toggle visibility
      }
    }
  }
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

function createMarkerSvg(kind: 'start' | 'end' | 'transfer'): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  if (kind === 'start') {
    // Crisp departure play triangle
    svg.setAttribute('class', 'w-3.5 h-3.5 translate-x-[0.5px]');
    const poly = document.createElementNS(ns, 'polygon');
    poly.setAttribute('points', '6 4 20 12 6 20 6 4');
    poly.setAttribute('fill', 'currentColor');
    svg.appendChild(poly);
  } else if (kind === 'end') {
    // Crisp destination flag icon
    svg.setAttribute('class', 'w-3.5 h-3.5');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute(
      'd',
      'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z',
    );
    path.setAttribute('fill', 'currentColor');
    const pole = document.createElementNS(ns, 'line');
    pole.setAttribute('x1', '4');
    pole.setAttribute('x2', '4');
    pole.setAttribute('y1', '22');
    pole.setAttribute('y2', '15');
    svg.appendChild(path);
    svg.appendChild(pole);
  } else {
    // Transfer arrows
    svg.setAttribute('class', 'w-3 h-3');
    const paths = [
      'M8 3 4 7l4 4',
      'M4 7h16',
      'm16 21 4-4-4-4',
      'M20 17H4',
    ];
    for (const d of paths) {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
  }

  return svg;
}

function createPinElement(
  kind: 'start' | 'end' | 'transfer',
  label: string,
  roleTag?: string,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col items-center pointer-events-none select-none';

  const pill = document.createElement('div');
  if (kind === 'transfer') {
    pill.className =
      'mb-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-md whitespace-nowrap flex items-center gap-1';
    pill.appendChild(createMarkerSvg('transfer'));
    const text = document.createElement('span');
    text.textContent = label;
    pill.appendChild(text);
  } else {
    const badgeColor =
      kind === 'start'
        ? 'bg-emerald-600 text-white border-emerald-300/60'
        : 'bg-rose-600 text-white border-rose-300/60';
    pill.className = `mb-1.5 pl-1.5 pr-2.5 py-1 rounded-xl text-xs font-bold shadow-lg shadow-black/25 border whitespace-nowrap flex items-center gap-1.5 ${badgeColor}`;

    if (roleTag) {
      const tag = document.createElement('span');
      tag.className =
        'px-1.5 py-0.5 rounded-md bg-black/20 text-[10px] font-extrabold uppercase tracking-wider leading-none';
      tag.textContent = roleTag;
      pill.appendChild(tag);
    }

    const text = document.createElement('span');
    text.textContent = label;
    pill.appendChild(text);
  }
  wrapper.appendChild(pill);

  const dotWrap = document.createElement('div');
  dotWrap.className = 'relative flex items-center justify-center';

  if (kind !== 'transfer') {
    const pulse = document.createElement('span');
    pulse.className = `absolute w-9 h-9 rounded-full animate-pulse-ring ${
      kind === 'start' ? 'bg-emerald-500/45' : 'bg-rose-500/45'
    }`;
    dotWrap.appendChild(pulse);
  }

  const dot = document.createElement('span');
  if (kind === 'transfer') {
    dot.className =
      'w-3.5 h-3.5 rounded-full bg-white dark:bg-zinc-950 border-[3px] border-zinc-900 dark:border-white shadow-md';
  } else {
    dot.className = `relative w-7 h-7 rounded-full border-[2.5px] border-white dark:border-zinc-950 shadow-lg shadow-black/30 text-white flex items-center justify-center ${
      kind === 'start' ? 'bg-emerald-600' : 'bg-rose-600'
    }`;
    dot.appendChild(createMarkerSvg(kind));
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
  startLabel,
  endLabel,
  isDark,
  mapStyleMode,
  isHome,
  isRevealed,
  playerRoute,
  optimalRoute,
  highlightedRoute,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const styleReadyRef = useRef(false);
  const styleKeyRef = useRef<string>('');
  const lastCameraKeyRef = useRef<string>('');
  const renderOverlaysRef = useRef<() => void>(() => {});

  // Initialize MapLibre instance (attach style.load before any setStyle call)
  useEffect(() => {
    if (!containerRef.current) return;

    styleReadyRef.current = false;
    styleKeyRef.current = '';
    lastCameraKeyRef.current = '';

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: MUNICH_CENTER,
      zoom: 11.4,
      minZoom: 9.2,
      maxZoom: 17,
      attributionControl: { compact: true },
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'bottom-right',
    );

    map.on('style.load', () => {
      styleReadyRef.current = true;
      renderOverlaysRef.current();
    });

    mapRef.current = map;

    return () => {
      styleReadyRef.current = false;
      styleKeyRef.current = '';
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync basemap style, label visibility, home transit network, markers, and route overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const renderOverlays = () => {
      if (mapStyleMode === 'standard') {
        setBasemapLabelsVisibility(map, isHome || isRevealed);
      }

      // Clear previous HTML markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Remove old GeoJSON layers/sources if present
      const layerIds = [
        'home-tram-casing',
        'home-tram-lines',
        'home-sbahn-casing',
        'home-sbahn-lines',
        'home-ubahn-casing',
        'home-ubahn-lines',
        'home-stations',
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
      const sourceIds = [
        'home-tram',
        'home-sbahn',
        'home-ubahn',
        'home-stations',
        'network-context',
        'optimal-route',
        'player-route',
        'route-stops',
      ];
      for (const sid of sourceIds) {
        if (map.getSource(sid)) map.removeSource(sid);
      }

      const isSatellite = mapStyleMode === 'satellite';
      const casingColor = isSatellite
        ? '#ffffff'
        : isDark
          ? '#09090b'
          : '#ffffff';

      if (isHome) {
        const tramFeatures: LineStringFeature[] = [];
        const sbahnFeatures: LineStringFeature[] = [];
        const ubahnFeatures: LineStringFeature[] = [];

        for (const line of Object.values(network.lines)) {
          const target =
            line.mode === 'ubahn'
              ? ubahnFeatures
              : line.mode === 'sbahn'
                ? sbahnFeatures
                : tramFeatures;
          for (const branch of line.branches) {
            const coords = branch
              .map((id) => network.stations[id])
              .filter(Boolean)
              .map((st) => [st.lon, st.lat] as [number, number]);
            if (coords.length >= 2) {
              target.push({
                type: 'Feature',
                properties: {
                  lineId: line.id,
                  color: line.color,
                  mode: line.mode,
                },
                geometry: { type: 'LineString', coordinates: coords },
              });
            }
          }
        }

        const stationFeatures: PointFeature[] = Object.values(
          network.stations,
        ).map((st) => ({
          type: 'Feature',
          properties: {
            stationId: st.id,
            isHub: st.lines.length >= 2,
          },
          geometry: {
            type: 'Point',
            coordinates: [st.lon, st.lat],
          },
        }));

        const addHomeLineGroup = (
          id: string,
          features: LineStringFeature[],
          width: number,
          casingWidth: number,
          opacity: number,
        ) => {
          map.addSource(id, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
          });
          map.addLayer({
            id: `${id}-casing`,
            type: 'line',
            source: id,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': casingColor,
              'line-width': casingWidth,
              'line-opacity': opacity * (isSatellite ? 0.75 : 0.85),
            },
          });
          map.addLayer({
            id: `${id}-lines`,
            type: 'line',
            source: id,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': ['get', 'color'],
              'line-width': width,
              'line-opacity': opacity,
            },
          });
        };

        // Draw all Munich lines (Tram -> S-Bahn -> U-Bahn) with clean visual hierarchy
        addHomeLineGroup(
          'home-tram',
          tramFeatures,
          2,
          3.8,
          networkMode === 'ust' ? 0.9 : 0.6,
        );
        addHomeLineGroup('home-sbahn', sbahnFeatures, 2.8, 5, 0.92);
        addHomeLineGroup('home-ubahn', ubahnFeatures, 3.6, 6, 0.98);

        map.addSource('home-stations', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: stationFeatures },
        });
        map.addLayer({
          id: 'home-stations',
          type: 'circle',
          source: 'home-stations',
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              9.5,
              ['case', ['get', 'isHub'], 2.4, 1.4],
              13,
              ['case', ['get', 'isHub'], 4.5, 2.8],
            ],
            'circle-color': isSatellite
              ? '#ffffff'
              : isDark
                ? '#18181b'
                : '#ffffff',
            'circle-stroke-color': isSatellite
              ? '#18181b'
              : isDark
                ? '#e4e4e7'
                : '#27272a',
            'circle-stroke-width': ['case', ['get', 'isHub'], 1.8, 1.2],
          },
        });

        const cameraKey = 'home';
        if (cameraKey !== lastCameraKeyRef.current) {
          lastCameraKeyRef.current = cameraKey;
          const isDesktop = window.innerWidth >= 768;
          map.easeTo({
            center: MUNICH_CENTER,
            zoom: isDesktop ? 11.6 : 10.7,
            padding: isDesktop
              ? { top: 40, bottom: 40, left: 420, right: 40 }
              : { top: 64, bottom: 340, left: 16, right: 16 },
            duration: 650,
          });
        }
        return;
      }

      const fromSt = network.stations[fromStationId];
      const toSt = network.stations[toStationId];
      if (!fromSt || !toSt) return;

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
            'line-width': isSatellite ? 2 : 1.5,
            'line-opacity': isSatellite ? 0.35 : isDark ? 0.2 : 0.16,
          },
        });

        const showOptimal =
          highlightedRoute === 'both' || highlightedRoute === 'optimal';
        const showPlayer =
          playerRoute !== null &&
          (highlightedRoute === 'both' || highlightedRoute === 'player');

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
              'line-opacity': showPlayer ? 0.8 : 0.95,
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
              'line-opacity': showPlayer ? 0.88 : 1,
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
            'circle-color': isSatellite ? '#ffffff' : isDark ? '#18181b' : '#ffffff',
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

      // Start & End icon pins (always visible)
      const startMarker = new maplibregl.Marker({
        element: createPinElement('start', fromSt.name, startLabel),
        anchor: 'bottom',
        offset: [0, 14],
      })
        .setLngLat([fromSt.lon, fromSt.lat])
        .addTo(map);

      const endMarker = new maplibregl.Marker({
        element: createPinElement('end', toSt.name, endLabel),
        anchor: 'bottom',
        offset: [0, 14],
      })
        .setLngLat([toSt.lon, toSt.lat])
        .addTo(map);

      markersRef.current.push(startMarker, endMarker);

      // Only refit viewport when the puzzle or reveal/route highlight changes (not on basemap toggles)
      const cameraKey = `play|${fromStationId}|${toStationId}|${isRevealed}|${highlightedRoute}`;
      if (cameraKey !== lastCameraKeyRef.current) {
        lastCameraKeyRef.current = cameraKey;
        const isDesktop = window.innerWidth >= 768;
        map.fitBounds(bounds, {
          padding: isDesktop
            ? { top: 96, bottom: 72, left: 450, right: 80 }
            : { top: 88, bottom: 380, left: 48, right: 48 },
          maxZoom: isRevealed ? 13.5 : 12.6,
          duration: 650,
        });
      }
    };

    renderOverlaysRef.current = renderOverlays;

    const nextKey = getBasemapKey(mapStyleMode, isDark);
    if (nextKey !== styleKeyRef.current) {
      styleKeyRef.current = nextKey;
      styleReadyRef.current = false;
      map.setStyle(getBasemapStyle(mapStyleMode, isDark));
    } else if (styleReadyRef.current) {
      renderOverlays();
    }
  }, [
    network,
    networkMode,
    fromStationId,
    toStationId,
    startLabel,
    endLabel,
    isDark,
    mapStyleMode,
    isHome,
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
