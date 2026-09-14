import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { LatLng, RouteData, Waypoint } from '../types/route';

interface MapViewProps {
  route: RouteData | null;
  waypoints: Waypoint[];
  onAddWaypoint?: (coord: LatLng) => void;
  onUpdateWaypoint?: (id: string, coord: LatLng) => void;
  isDesignMode: boolean;
  pacerPosition: LatLng | null;
  pacerBearing?: number;
  userPosition: LatLng | null;
  pacerSpeedKmH: number;
}

export const MapView: React.FC<MapViewProps> = ({
  route,
  waypoints,
  onAddWaypoint,
  onUpdateWaypoint,
  isDesignMode,
  pacerPosition,
  pacerBearing = 0,
  userPosition,
  pacerSpeedKmH,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Layer references
  const polylineLayerRef = useRef<L.Polyline | null>(null);
  const waypointMarkersRef = useRef<L.Marker[]>([]);
  const pacerMarkerRef = useRef<L.Marker | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (e.g., Berlin or central Germany, will auto-pan to route or GPS)
    const map = L.map(mapContainerRef.current, {
      center: [52.52, 13.405],
      zoom: 14,
      zoomControl: false,
    });

    // Add CartoDB Dark Matter / OSM tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // Zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    // Try to get user's initial location to center the map
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!route || route.coordinates.length === 0) {
            map.setView([pos.coords.latitude, pos.coords.longitude], 15);
          }
        },
        () => {},
        { timeout: 5000 }
      );
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle map clicks for adding waypoints
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (isDesignMode && onAddWaypoint) {
        onAddWaypoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [isDesignMode, onAddWaypoint]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineLayerRef.current) {
      map.removeLayer(polylineLayerRef.current);
      polylineLayerRef.current = null;
    }

    if (route && route.coordinates.length >= 2) {
      // Create glowing polyline
      const polyline = L.polyline(route.coordinates, {
        color: '#6366f1',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      polylineLayerRef.current = polyline;

      // Fit bounds when route changes
      map.fitBounds(polyline.getBounds(), { padding: [60, 60], maxZoom: 17 });
    }
  }, [route]);

  // Update Waypoint Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    waypointMarkersRef.current.forEach((marker) => marker.remove());
    waypointMarkersRef.current = [];

    waypoints.forEach((wp, idx) => {
      const isStart = idx === 0;
      const isFinish = idx === waypoints.length - 1 && waypoints.length > 1;

      let bgColor = 'bg-indigo-600';
      let label = `${idx + 1}`;

      if (isStart) {
        bgColor = 'bg-emerald-500';
        label = 'S';
      } else if (isFinish) {
        bgColor = 'bg-rose-500';
        label = 'Z';
      }

      const iconHtml = `
        <div class="relative flex items-center justify-center">
          <div class="${bgColor} text-white font-bold text-xs rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-white cursor-pointer hover:scale-110 transition-transform">
            ${label}
          </div>
          <div class="absolute -bottom-1 w-2 h-2 ${bgColor} rotate-45"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-waypoint-icon',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker([wp.lat, wp.lng], {
        icon: customIcon,
        draggable: isDesignMode,
      }).addTo(map);

      if (isDesignMode && onUpdateWaypoint) {
        marker.on('dragend', (e) => {
          const newLatLng = e.target.getLatLng();
          onUpdateWaypoint(wp.id, { lat: newLatLng.lat, lng: newLatLng.lng });
        });
      }

      marker.bindPopup(`
        <div class="p-1 font-sans">
          <div class="font-bold text-sm text-gray-800">${wp.name || (isStart ? 'Startpunkt' : isFinish ? 'Zielpunkt' : `Wegpunkt ${idx + 1}`)}</div>
          <div class="text-xs text-gray-500">${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</div>
        </div>
      `);

      waypointMarkersRef.current.push(marker);
    });
  }, [waypoints, isDesignMode, onUpdateWaypoint]);

  // Update Pacer (Idealpunkt) Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!pacerPosition) {
      if (pacerMarkerRef.current) {
        map.removeLayer(pacerMarkerRef.current);
        pacerMarkerRef.current = null;
      }
      return;
    }

    const pacerHtml = `
      <div class="relative flex items-center justify-center pacer-marker-pulse rounded-full">
        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-red-500 flex items-center justify-center shadow-xl border-2 border-white text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style="transform: rotate(${pacerBearing}deg);">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      </div>
    `;

    const pacerIcon = L.divIcon({
      html: pacerHtml,
      className: 'custom-pacer-icon',
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!pacerMarkerRef.current) {
      const marker = L.marker([pacerPosition.lat, pacerPosition.lng], {
        icon: pacerIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      marker.bindTooltip(
        `Idealpunkt: ${pacerSpeedKmH > 0 ? `${pacerSpeedKmH.toFixed(1)} km/h` : 'Startbereit'}`,
        { direction: 'top', offset: [0, -20] }
      );
      pacerMarkerRef.current = marker;
    } else {
      pacerMarkerRef.current.setLatLng([pacerPosition.lat, pacerPosition.lng]);
      pacerMarkerRef.current.setIcon(pacerIcon);
      pacerMarkerRef.current.setTooltipContent(
        `Idealpunkt: ${pacerSpeedKmH > 0 ? `${pacerSpeedKmH.toFixed(1)} km/h` : 'Startbereit'}`
      );
    }
  }, [pacerPosition, pacerBearing, pacerSpeedKmH]);

  // Update User Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!userPosition) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }
      return;
    }

    const userHtml = `
      <div class="relative flex items-center justify-center user-marker-pulse rounded-full">
        <div class="w-6 h-6 rounded-full bg-blue-500 border-2 border-white shadow-lg flex items-center justify-center">
          <div class="w-2 h-2 rounded-full bg-white"></div>
        </div>
      </div>
    `;

    const userIcon = L.divIcon({
      html: userHtml,
      className: 'custom-user-icon',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    if (!userMarkerRef.current) {
      const marker = L.marker([userPosition.lat, userPosition.lng], {
        icon: userIcon,
        zIndexOffset: 900,
      }).addTo(map);
      marker.bindTooltip('Mein Standort (GPS)', { direction: 'top', offset: [0, -12] });
      userMarkerRef.current = marker;
    } else {
      userMarkerRef.current.setLatLng([userPosition.lat, userPosition.lng]);
    }
  }, [userPosition]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
      {isDesignMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] bg-slate-900/90 text-amber-300 text-xs sm:text-sm px-4 py-2 rounded-full shadow-lg border border-amber-500/40 backdrop-blur-md flex items-center gap-2 pointer-events-none">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          Klicke auf die Karte, um Wegpunkte hinzuzufügen. Ziehe Punkte zum Verschieben.
        </div>
      )}
    </div>
  );
};
