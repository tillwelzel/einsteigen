import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type {
  ComputedRoute,
  MapStyleMode,
  MunichNetwork,
  NetworkMode,
} from '../types';
import { smoothPolyline, type LngLat } from '../utils/map-geometry';

interface LineStringFeature {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
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
  recenterTrigger: number;
  mobileBottomInset?: number;
  isSheetCollapsed?: boolean;
  onCanRecenterChange?: (canRecenter: boolean) => void;
}

interface CameraSnapshot {
  center: maplibregl.LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}

const MUNICH_CENTER: [number, number] = [11.5761, 48.1371];

const OPENFREEMAP_LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron';
const OPENFREEMAP_DARK_STYLE = 'https://tiles.openfreemap.org/styles/fiord';

function createCartoFallbackStyle(
  isDark: boolean,
  showLabels: boolean,
): maplibregl.StyleSpecification {
  const variant = isDark
    ? showLabels
      ? 'dark_all'
      : 'dark_nolabels'
    : showLabels
      ? 'light_all'
      : 'light_nolabels';
  return {
    version: 8,
    sources: {
      'carto-basemap': {
        type: 'raster',
        tiles: [
          `https://a.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
          `https://b.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
          `https://c.basemaps.cartocdn.com/${variant}/{z}/{x}/{y}@2x.png`,
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
      },
    },
    layers: [
      {
        id: 'carto-basemap-layer',
        type: 'raster',
        source: 'carto-basemap',
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

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

function getBasemapKey(
  mapStyleMode: MapStyleMode,
  isDark: boolean,
  useCartoFallback: boolean,
  showLabels: boolean,
): string {
  if (mapStyleMode === 'satellite') return 'satellite';
  if (useCartoFallback) {
    return `carto-${isDark ? 'dark' : 'light'}-${showLabels ? 'labels' : 'nolabels'}`;
  }
  return isDark ? 'standard-dark' : 'standard-light';
}

function getBasemapStyle(
  mapStyleMode: MapStyleMode,
  isDark: boolean,
  useCartoFallback: boolean,
  showLabels: boolean,
): string | maplibregl.StyleSpecification {
  if (mapStyleMode === 'satellite') {
    return createSatelliteStyle();
  }
  if (useCartoFallback) {
    return createCartoFallbackStyle(isDark, showLabels);
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
        .map((st) => [st.lon, st.lat] as LngLat);
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
          coordinates: smoothPolyline(coords),
        },
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null);
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
      'mb-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold bg-white/95 dark:bg-zinc-900/95 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 shadow-md whitespace-nowrap flex items-center gap-1';
    pill.appendChild(createMarkerSvg('transfer'));
    const text = document.createElement('span');
    text.className = 'max-w-[150px] sm:max-w-none truncate';
    text.textContent = label;
    pill.appendChild(text);
  } else {
    const badgeColor =
      kind === 'start'
        ? 'bg-emerald-600 text-white border-emerald-300/60'
        : 'bg-rose-600 text-white border-rose-300/60';
    pill.className = `mb-1 sm:mb-1.5 pl-1.5 pr-2 sm:pr-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold shadow-lg shadow-black/25 border whitespace-nowrap flex items-center gap-1 sm:gap-1.5 ${badgeColor}`;

    if (roleTag) {
      const tag = document.createElement('span');
      tag.className =
        'px-1 sm:px-1.5 py-0.5 rounded-md bg-black/20 text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider leading-none shrink-0';
      tag.textContent = roleTag;
      pill.appendChild(tag);
    }

    const text = document.createElement('span');
    text.className = 'max-w-[165px] sm:max-w-none truncate';
    text.textContent = label;
    pill.appendChild(text);
  }
  wrapper.appendChild(pill);

  const dotWrap = document.createElement('div');
  dotWrap.className = 'relative flex items-center justify-center';

  if (kind !== 'transfer') {
    const pulse = document.createElement('span');
    pulse.className = `absolute w-8 h-8 sm:w-9 sm:h-9 rounded-full animate-pulse-ring ${kind === 'start' ? 'bg-emerald-500/45' : 'bg-rose-500/45'
      }`;
    dotWrap.appendChild(pulse);
  }

  const dot = document.createElement('span');
  if (kind === 'transfer') {
    dot.className =
      'w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-white dark:bg-zinc-950 border-[2.5px] sm:border-[3px] border-zinc-900 dark:border-white shadow-md';
  } else {
    dot.className = `relative w-6 h-6 sm:w-7 sm:h-7 rounded-full border-[2.5px] border-white dark:border-zinc-950 shadow-lg shadow-black/30 text-white flex items-center justify-center ${kind === 'start' ? 'bg-emerald-600' : 'bg-rose-600'
      }`;
    dot.appendChild(createMarkerSvg(kind));
  }
  dotWrap.appendChild(dot);
  wrapper.appendChild(dotWrap);

  return wrapper;
}

function computeMobilePadding(
  vh: number,
  bottomInset: number,
  isHome: boolean,
): { top: number; bottom: number; left: number; right: number } {
  const top = isHome ? 56 : 74;
  const fallbackBottom = isHome
    ? Math.round(vh * 0.42)
    : Math.round(vh * 0.48);
  const rawBottom = bottomInset > 0 ? bottomInset + 14 : fallbackBottom;
  // Always keep at least 140px of clear map viewport height for fitBounds
  const maxBottom = Math.max(80, vh - top - 140);
  const bottom = Math.min(rawBottom, maxBottom);
  return isHome
    ? { top, bottom, left: 16, right: 16 }
    : { top, bottom, left: 32, right: 32 };
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
  recenterTrigger,
  mobileBottomInset = 0,
  isSheetCollapsed = false,
  onCanRecenterChange,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const styleReadyRef = useRef(false);
  const styleKeyRef = useRef<string>('');
  const useCartoFallbackRef = useRef(false);
  const lastCameraKeyRef = useRef<string>('');
  const renderOverlaysRef = useRef<() => void>(() => { });
  const recenterCameraRef = useRef<((duration?: number) => void) | null>(null);
  const defaultCameraRef = useRef<CameraSnapshot | null>(null);
  const isProgrammaticMoveRef = useRef(false);
  const lastReportedMovedRef = useRef(false);
  const onCanRecenterChangeRef = useRef(onCanRecenterChange);
  const mapStyleModeRef = useRef(mapStyleMode);
  const isDarkRef = useRef(isDark);
  const showLabelsRef = useRef(isHome || isRevealed);
  const mobileBottomInsetRef = useRef(mobileBottomInset);
  const lastFittedInsetRef = useRef(0);

  onCanRecenterChangeRef.current = onCanRecenterChange;
  mapStyleModeRef.current = mapStyleMode;
  isDarkRef.current = isDark;
  showLabelsRef.current = isHome || isRevealed;
  mobileBottomInsetRef.current = mobileBottomInset;

  // Initialize MapLibre instance (attach style.load before any setStyle call)
  useEffect(() => {
    if (!containerRef.current) return;

    styleReadyRef.current = false;
    styleKeyRef.current = '';
    lastCameraKeyRef.current = '';
    defaultCameraRef.current = null;
    isProgrammaticMoveRef.current = false;
    lastReportedMovedRef.current = false;
    onCanRecenterChangeRef.current?.(false);

    const reportMovedAway = (moved: boolean) => {
      if (moved === lastReportedMovedRef.current) return;
      lastReportedMovedRef.current = moved;
      onCanRecenterChangeRef.current?.(moved);
    };

    const hasMovedFromDefault = (m: maplibregl.Map): boolean => {
      const def = defaultCameraRef.current;
      if (!def) return true;
      const curPx = m.project(m.getCenter());
      const defPx = m.project(def.center);
      const distPx = Math.hypot(curPx.x - defPx.x, curPx.y - defPx.y);
      const zoomDelta = Math.abs(m.getZoom() - def.zoom);
      const bearingDelta = Math.abs(m.getBearing() - def.bearing);
      const pitchDelta = Math.abs(m.getPitch() - def.pitch);
      return distPx > 28 || zoomDelta > 0.35 || bearingDelta > 2 || pitchDelta > 2;
    };

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

    map.on('movestart', (e) => {
      const isAutoFit = Boolean((e as { isAutoFit?: boolean }).isAutoFit);
      if (!isAutoFit) {
        isProgrammaticMoveRef.current = false;
      }
    });

    map.on('move', (e) => {
      const isAutoFit = Boolean((e as { isAutoFit?: boolean }).isAutoFit);
      if (isAutoFit || isProgrammaticMoveRef.current) return;
      reportMovedAway(hasMovedFromDefault(map));
    });

    map.on('moveend', (e) => {
      const isAutoFit = Boolean((e as { isAutoFit?: boolean }).isAutoFit);
      if (isAutoFit) {
        if (!defaultCameraRef.current) {
          defaultCameraRef.current = {
            center: map.getCenter(),
            zoom: map.getZoom(),
            bearing: map.getBearing(),
            pitch: map.getPitch(),
          };
        }
        isProgrammaticMoveRef.current = false;
        reportMovedAway(hasMovedFromDefault(map));
        return;
      }
      if (!isProgrammaticMoveRef.current) {
        reportMovedAway(hasMovedFromDefault(map));
      }
    });

    map.on('style.load', () => {
      styleReadyRef.current = true;
      map.resize();
      renderOverlaysRef.current();
    });

    // If OpenFreeMap style fails to load (e.g. blocked/unreachable), automatically fall back to CARTO tiles
    map.on('error', () => {
      if (
        mapStyleModeRef.current === 'standard' &&
        !useCartoFallbackRef.current &&
        !styleReadyRef.current
      ) {
        useCartoFallbackRef.current = true;
        const fallbackKey = getBasemapKey(
          'standard',
          isDarkRef.current,
          true,
          showLabelsRef.current,
        );
        styleKeyRef.current = fallbackKey;
        map.setStyle(
          getBasemapStyle(
            'standard',
            isDarkRef.current,
            true,
            showLabelsRef.current,
          ),
          { diff: false },
        );
      }
    });

    mapRef.current = map;

    const handleResize = () => {
      map.resize();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      styleReadyRef.current = false;
      styleKeyRef.current = '';
      recenterCameraRef.current = null;
      defaultCameraRef.current = null;
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
      if (mapStyleMode === 'standard' && !useCartoFallbackRef.current) {
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
        'network-context-lines',
        'optimal-casing',
        'optimal-line',
        'player-casing',
        'player-line',
      ];
      for (const lid of layerIds) {
        if (map.getLayer(lid)) map.removeLayer(lid);
      }
      const sourceIds = [
        'home-tram',
        'home-sbahn',
        'home-ubahn',
        'network-context',
        'optimal-route',
        'player-route',
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
          if (networkMode === 'us' && line.mode === 'tram') continue;
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
              .map((st) => [st.lon, st.lat] as LngLat);
            if (coords.length >= 2) {
              target.push({
                type: 'Feature',
                properties: {
                  lineId: line.id,
                  color: line.color,
                  mode: line.mode,
                },
                geometry: {
                  type: 'LineString',
                  coordinates: smoothPolyline(coords),
                },
              });
            }
          }
        }

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

        // Draw active Munich lines (Tram -> S-Bahn -> U-Bahn) with clean visual hierarchy
        if (networkMode === 'ust') {
          addHomeLineGroup('home-tram', tramFeatures, 2, 3.8, 0.9);
        }
        addHomeLineGroup('home-sbahn', sbahnFeatures, 2.8, 5, 0.92);
        addHomeLineGroup('home-ubahn', ubahnFeatures, 3.6, 6, 0.98);

        const applyHomeCamera = (duration = 650) => {
          const isDesktop = window.innerWidth >= 768;
          const zoom = isDesktop ? 11.6 : 10.9;
          const padding = isDesktop
            ? { top: 40, bottom: 40, left: 420, right: 40 }
            : computeMobilePadding(
                window.innerHeight,
                mobileBottomInsetRef.current,
                true,
              );
          defaultCameraRef.current = {
            center: new maplibregl.LngLat(MUNICH_CENTER[0], MUNICH_CENTER[1]),
            zoom,
            bearing: 0,
            pitch: 0,
          };
          isProgrammaticMoveRef.current = true;
          if (lastReportedMovedRef.current) {
            lastReportedMovedRef.current = false;
            onCanRecenterChangeRef.current?.(false);
          }
          map.easeTo(
            {
              center: MUNICH_CENTER,
              zoom,
              bearing: 0,
              pitch: 0,
              padding,
              duration,
            },
            { isAutoFit: true },
          );
        };
        recenterCameraRef.current = (duration = 550) => applyHomeCamera(duration);

        const cameraKey = 'home';
        if (cameraKey !== lastCameraKeyRef.current) {
          lastCameraKeyRef.current = cameraKey;
          applyHomeCamera(650);
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
              .map((st) => [st.lon, st.lat] as LngLat);
            if (coords.length >= 2) {
              contextFeatures.push({
                type: 'Feature',
                properties: { color: line.color },
                geometry: {
                  type: 'LineString',
                  coordinates: smoothPolyline(coords),
                },
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
          layout: { 'line-cap': 'round', 'line-join': 'round' },
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

      const applyPlayCamera = (duration = 650) => {
        const isDesktop = window.innerWidth >= 768;
        const padding = isDesktop
          ? { top: 96, bottom: 72, left: 450, right: 80 }
          : computeMobilePadding(
              window.innerHeight,
              mobileBottomInsetRef.current,
              false,
            );
        const maxZoom = isRevealed ? 13.5 : 12.6;
        const target = map.cameraForBounds(bounds, {
          padding,
          maxZoom,
          bearing: 0,
        });
        defaultCameraRef.current = target?.center
          ? {
            center: maplibregl.LngLat.convert(target.center),
            zoom: target.zoom ?? maxZoom,
            bearing: 0,
            pitch: 0,
          }
          : null;
        isProgrammaticMoveRef.current = true;
        if (lastReportedMovedRef.current) {
          lastReportedMovedRef.current = false;
          onCanRecenterChangeRef.current?.(false);
        }
        map.fitBounds(
          bounds,
          {
            padding,
            maxZoom,
            bearing: 0,
            pitch: 0,
            duration,
          },
          { isAutoFit: true },
        );
      };
      recenterCameraRef.current = (duration = 550) => applyPlayCamera(duration);

      // Only refit viewport when the puzzle or reveal/route highlight changes (not on basemap toggles)
      const cameraKey = `play|${fromStationId}|${toStationId}|${isRevealed}|${highlightedRoute}`;
      if (cameraKey !== lastCameraKeyRef.current) {
        lastCameraKeyRef.current = cameraKey;
        applyPlayCamera(650);
      }
    };

    renderOverlaysRef.current = renderOverlays;

    const showLabels = isHome || isRevealed;
    const nextKey = getBasemapKey(
      mapStyleMode,
      isDark,
      useCartoFallbackRef.current,
      showLabels,
    );
    if (nextKey !== styleKeyRef.current) {
      styleKeyRef.current = nextKey;
      styleReadyRef.current = false;
      // Always disable style diffing so `style.load` fires reliably on every
      // Light <-> Dark and Standard <-> Satellite transition.
      map.setStyle(
        getBasemapStyle(
          mapStyleMode,
          isDark,
          useCartoFallbackRef.current,
          showLabels,
        ),
        { diff: false },
      );
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

  // Trigger smooth recenter when requested by the user
  useEffect(() => {
    if (recenterTrigger === 0) return;
    recenterCameraRef.current?.(550);
  }, [recenterTrigger]);

  // Smoothly re-frame the visible map area on mobile when the bottom sheet height
  // changes meaningfully (e.g. collapse/expand, Home -> Game, filter drawer toggle)
  // while the user hasn't manually panned away.
  useEffect(() => {
    if (window.innerWidth >= 768) return;
    if (!styleReadyRef.current || lastReportedMovedRef.current) return;
    if (Math.abs(mobileBottomInset - lastFittedInsetRef.current) < 20) return;
    lastFittedInsetRef.current = mobileBottomInset;
    const id = window.setTimeout(() => {
      if (!lastReportedMovedRef.current) {
        recenterCameraRef.current?.(350);
      }
    }, 50);
    return () => window.clearTimeout(id);
  }, [mobileBottomInset, isSheetCollapsed]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full bg-zinc-100 dark:bg-zinc-950"
      aria-label="Munich Transit Map"
    />
  );
}
