import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Coordinates lookup for Bangalore wards & civic localities
const LOCALITY_COORDS = {
  'bellandur': [12.9260, 77.6762],
  'ward 150': [12.9260, 77.6762],
  'ward 150 bellandur': [12.9260, 77.6762],
  'koramangala': [12.9352, 77.6245],
  'ward 151': [12.9352, 77.6245],
  'ward 151 koramangala': [12.9352, 77.6245],
  'indiranagar': [12.9784, 77.6408],
  'ward 80': [12.9784, 77.6408],
  'hsr layout': [12.9121, 77.6446],
  'ward 174': [12.9121, 77.6446],
  'jayanagar': [12.9308, 77.5838],
  'ward 168': [12.9308, 77.5838],
  'whitefield': [12.9698, 77.7500],
  'ward 84': [12.9698, 77.7500],
  'marathahalli': [12.9591, 77.6974],
  'malleshwaram': [13.0031, 77.5643],
  'hebbal': [13.0358, 77.5970],
  'greenway': [42.3601, -71.0589],
  'lakeview': [42.3555, -71.0640],
  'default': [12.9260, 77.6762], // Bellandur default
};

const BANGALORE_WARDS = [
  { label: '📍 Ward 150 Bellandur', key: 'bellandur', coords: [12.9260, 77.6762] },
  { label: '📍 Ward 151 Koramangala', key: 'koramangala', coords: [12.9352, 77.6245] },
  { label: '📍 Ward 80 Indiranagar', key: 'indiranagar', coords: [12.9784, 77.6408] },
  { label: '📍 Ward 174 HSR Layout', key: 'hsr layout', coords: [12.9121, 77.6446] },
  { label: '📍 Ward 168 Jayanagar', key: 'jayanagar', coords: [12.9308, 77.5838] },
  { label: '📍 Ward 84 Whitefield', key: 'whitefield', coords: [12.9698, 77.7500] },
  { label: '📍 Malleshwaram', key: 'malleshwaram', coords: [13.0031, 77.5643] },
  { label: '📍 Hebbal', key: 'hebbal', coords: [13.0358, 77.5970] }
];

// Tile Layers including Google Maps Roadmap, Satellite (Hybrid), and Terrain
const TILE_LAYERS = {
  google_roads: {
    name: '🗺️ Google Maps',
    url: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  },
  google_satellite: {
    name: '🛰️ Google Satellite',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  },
  google_terrain: {
    name: '⛰️ Google Terrain',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps'
  },
  osm: {
    name: '🌐 OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors'
  },
  dark: {
    name: '🌑 Dark Canvas',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; CARTO'
  }
};

function resolveCoords(locality) {
  if (!locality) return LOCALITY_COORDS.default;
  const key = locality.toLowerCase().trim();
  for (const [name, coords] of Object.entries(LOCALITY_COORDS)) {
    if (key.includes(name)) return coords;
  }
  return LOCALITY_COORDS.default;
}

// Haversine distance formula in meters
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

function createPinIcon(emoji, bg) {
  return L.divIcon({
    className: 'civic-marker-pin',
    html: `<div style="background-color: ${bg}; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 3px 10px rgba(0,0,0,0.3); border: 2.5px solid #ffffff;">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20]
  });
}

export default function CivicMap({ analysisId, locality, policies, impacts, onOpenEvidence }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const circleLayerRef = useRef(null);
  const citizenMarkerRef = useRef(null);
  const markersGroupRef = useRef(null);

  const [viewMode, setViewMode] = useState('leaflet'); // 'leaflet' | 'google_embed'
  const [activeFilter, setActiveFilter] = useState('all');
  const [baseMap, setBaseMap] = useState('google_roads'); // default to Google Maps!
  const [bufferRadius, setBufferRadius] = useState(1000); // 500, 1000, 2000 meters
  const [activeLocality, setActiveLocality] = useState(locality || 'Ward 150 Bellandur');

  // Derive source section IDs from policies for evidence links
  const policySecMap = {};
  if (Array.isArray(policies)) {
    policies.forEach(p => {
      const pName = (p.name || '').toLowerCase();
      if (pName.includes('ward committee') || pName.includes('sabha')) policySecMap.ward = p.source_section_id;
      if (pName.includes('tax') || pName.includes('unit area')) policySecMap.tax = p.source_section_id;
      if (pName.includes('rainwater') || pName.includes('rwh')) policySecMap.rwh = p.source_section_id;
      if (pName.includes('waste') || pName.includes('sanitation')) policySecMap.waste = p.source_section_id;
      if (pName.includes('building') || pName.includes('deviation')) policySecMap.building = p.source_section_id;
    });
  }

  const fallbackSecId = policies?.[0]?.source_section_id || 's_kmc_13h';
  const centerCoords = resolveCoords(activeLocality);

  // Civic Points of Interest around current center
  const pointsOfInterest = [
    {
      id: 'poi_ward',
      type: 'ward',
      title: 'Ward Committee Office & Area Sabha Center',
      category: 'Citizen Governance',
      citation: 'Section 13H & 13I',
      sectionId: policySecMap.ward || fallbackSecId,
      offset: [0.0032, -0.0025],
      icon: createPinIcon('🏛️', '#1e40af'),
      desc: 'Convenes monthly public Ward Committee meetings chaired by the local Councillor for budget, works, and sanitation oversight.'
    },
    {
      id: 'poi_tax',
      type: 'tax',
      title: 'BBMP ARO Office (Unit Area Value Tax Hub)',
      category: 'Taxation & UAV',
      citation: 'Section 108A',
      sectionId: policySecMap.tax || fallbackSecId,
      offset: [-0.0038, 0.0035],
      icon: createPinIcon('🏢', '#7c3aed'),
      desc: 'Designated Assistant Revenue Officer (ARO) desk for UAV property tax classification, assessment grievance, and self-assessment returns.'
    },
    {
      id: 'poi_rwh',
      type: 'rwh',
      title: 'Rainwater Harvesting Compliance Hotspot',
      category: 'Water Conservation',
      citation: 'Section 295A',
      sectionId: policySecMap.rwh || fallbackSecId,
      offset: [0.0025, 0.0048],
      icon: createPinIcon('💧', '#0284c7'),
      desc: 'Mandatory RWH enforcement area for residential plots >= 2,400 sq. ft. and new constructions >= 1,200 sq. ft. with recharge well audits.'
    },
    {
      id: 'poi_waste',
      type: 'waste',
      title: 'Dry Waste Collection Center (DWCC) & Health Inspection Point',
      category: 'Solid Waste Management',
      citation: 'Section 431-A',
      sectionId: policySecMap.waste || fallbackSecId,
      offset: [-0.0028, -0.0042],
      icon: createPinIcon('♻️', '#d97706'),
      desc: 'Daily segregated dry waste processing and municipal sanitary inspection hub enforcing spot fines under Section 431-A.'
    },
    {
      id: 'poi_building',
      type: 'building',
      title: 'Town Planning & Setback Verification Desk',
      category: 'Building Bye-laws',
      citation: 'Section 321-A & 295',
      sectionId: policySecMap.building || fallbackSecId,
      offset: [0.0045, 0.0012],
      icon: createPinIcon('📐', '#059669'),
      desc: 'Jurisdictional inspection desk monitoring building deviations, FAR compliance, and regularisation protocols under statutory building bye-laws.'
    }
  ];

  // Initialize Leaflet Map
  useEffect(() => {
    if (viewMode !== 'leaflet' || !mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: centerCoords,
      zoom: 14,
      scrollWheelZoom: false,
    });

    mapInstanceRef.current = map;

    // Google Maps or selected tile layer
    tileLayerRef.current = L.tileLayer(TILE_LAYERS[baseMap].url, {
      maxZoom: 20,
      attribution: TILE_LAYERS[baseMap].attribution
    }).addTo(map);

    // Buffer circle
    circleLayerRef.current = L.circle(centerCoords, {
      color: '#1e3a8a',
      fillColor: '#3b82f6',
      fillOpacity: 0.12,
      weight: 2,
      dashArray: '6, 6',
      radius: bufferRadius
    }).addTo(map).bindPopup(`<strong>${activeLocality} Jurisdiction Buffer</strong><br/><span style="font-size: 12px; color: #64748b;">Radius: ${bufferRadius}m • Statutory civic enforcement boundary</span>`);

    // Markers layer group
    markersGroupRef.current = L.layerGroup().addTo(map);

    // Map click handler for Citizen Geo-Reporting
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      const wardOfficeCoord = [centerCoords[0] + pointsOfInterest[0].offset[0], centerCoords[1] + pointsOfInterest[0].offset[1]];
      const dist = calculateDistanceMeters(lat, lng, wardOfficeCoord[0], wardOfficeCoord[1]);
      const walkMin = Math.round(dist / 80);

      if (citizenMarkerRef.current) {
        citizenMarkerRef.current.remove();
      }

      const reportIcon = createPinIcon('📍', '#dc2626');
      const marker = L.marker([lat, lng], { icon: reportIcon, draggable: true }).addTo(map);
      citizenMarkerRef.current = marker;

      const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`;
      const gmapsNav = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`;

      const popupDiv = document.createElement('div');
      popupDiv.style.minWidth = '230px';
      popupDiv.innerHTML = `
        <div style="font-size: 11px; font-weight: 700; color: #dc2626; text-transform: uppercase; margin-bottom: 4px;">
          📍 Citizen Geo-Issue Location
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
          GPS: ${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E
        </div>
        <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
          Distance to Ward Office: <strong>${dist}m</strong> (~ ${walkMin} min walk)
        </div>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <a href="${gmapsNav}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 5px; background: #ea4335; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none;">
            🚗 Google Directions
          </a>
          <a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 5px; background: #4285f4; color: #fff; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none;">
            🗺️ Open Google Maps
          </a>
        </div>
      `;

      const copyBtn = document.createElement('button');
      copyBtn.innerText = '📋 Copy Coordinates for RTI Form';
      copyBtn.style.cssText = 'width: 100%; padding: 6px 10px; background-color: #1e3a8a; color: #ffffff; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer;';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(`GPS Location: ${lat.toFixed(5)}, ${lng.toFixed(5)} (Distance to Ward Office: ${dist}m, Ward: ${activeLocality})`);
        copyBtn.innerText = '✓ Coordinates Copied!';
      };
      popupDiv.appendChild(copyBtn);

      marker.bindPopup(popupDiv).openPopup();
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [viewMode]);

  // Update Base Map Layer
  useEffect(() => {
    if (viewMode !== 'leaflet' || !mapInstanceRef.current) return;
    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    tileLayerRef.current = L.tileLayer(TILE_LAYERS[baseMap].url, {
      maxZoom: 20,
      attribution: TILE_LAYERS[baseMap].attribution
    }).addTo(mapInstanceRef.current);
  }, [baseMap, viewMode]);

  // Update Buffer Radius
  useEffect(() => {
    if (circleLayerRef.current) {
      circleLayerRef.current.setRadius(bufferRadius);
      circleLayerRef.current.setLatLng(centerCoords);
    }
  }, [bufferRadius, centerCoords]);

  // Update Markers when Filter or Center changes
  useEffect(() => {
    if (viewMode !== 'leaflet' || !markersGroupRef.current || !mapInstanceRef.current) return;

    markersGroupRef.current.clearLayers();

    const filtered = activeFilter === 'all'
      ? pointsOfInterest
      : pointsOfInterest.filter(p => p.type === activeFilter);

    filtered.forEach(poi => {
      const lat = centerCoords[0] + poi.offset[0];
      const lng = centerCoords[1] + poi.offset[1];

      const marker = L.marker([lat, lng], { icon: poi.icon }).addTo(markersGroupRef.current);

      const gmapsLink = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(5)},${lng.toFixed(5)}`;
      const gmapsNav = `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`;

      const popupContent = document.createElement('div');
      popupContent.style.minWidth = '240px';
      popupContent.style.padding = '4px';

      popupContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #1e3a8a; background: #eff6ff; padding: 2px 6px; border-radius: 4px;">
            ${poi.category}
          </span>
          <span style="font-size: 11px; font-weight: 600; color: #64748b;">
            ${poi.citation}
          </span>
        </div>
        <h4 style="font-size: 14px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">
          ${poi.title}
        </h4>
        <p style="font-size: 12px; line-height: 1.4; color: #475569; margin: 0 0 8px 0;">
          ${poi.desc}
        </p>
        <div style="display: flex; gap: 6px; margin-bottom: 8px;">
          <a href="${gmapsNav}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 5px 8px; background-color: #ea4335; color: #ffffff; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <span>🚗 Directions</span>
          </a>
          <a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; padding: 5px 8px; background-color: #4285f4; color: #ffffff; border-radius: 4px; font-size: 11px; font-weight: 600; text-decoration: none; display: flex; align-items: center; justify-content: center; gap: 4px;">
            <span>🗺️ Google Maps</span>
          </a>
        </div>
      `;

      if (poi.sectionId && onOpenEvidence) {
        const btn = document.createElement('button');
        btn.innerHTML = '🔍 View Source Legal Citation →';
        btn.style.cssText = 'width: 100%; padding: 6px 10px; background-color: #0d9488; color: #ffffff; border: none; border-radius: 4px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.15s;';
        btn.onmouseover = () => btn.style.backgroundColor = '#0f766e';
        btn.onmouseout = () => btn.style.backgroundColor = '#0d9488';
        btn.onclick = (e) => {
          e.preventDefault();
          onOpenEvidence(analysisId, poi.sectionId, poi.citation, poi.title);
        };
        popupContent.appendChild(btn);
      }

      marker.bindPopup(popupContent);
    });
  }, [activeFilter, centerCoords, analysisId, viewMode]);

  // Handle Locality FlyTo
  const handleLocalitySelect = (targetLoc) => {
    setActiveLocality(targetLoc);
    const coords = resolveCoords(targetLoc);
    if (mapInstanceRef.current && viewMode === 'leaflet') {
      mapInstanceRef.current.flyTo(coords, 14, { animate: true, duration: 1.2 });
    }
  };

  const bufferAreaSqKm = ((Math.PI * Math.pow(bufferRadius / 1000, 2))).toFixed(2);
  const estHouseholds = Math.round((bufferRadius / 1000) * 18500);

  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${centerCoords[0]},${centerCoords[1]}`;
  const googleMapsEmbedUrl = `https://maps.google.com/maps?q=${centerCoords[0]},${centerCoords[1]}&hl=en&z=15&output=embed`;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 28 }}>
      {/* Top Map Controls Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 22 }}>🗺️</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)', margin: 0 }}>
              Civic Geographic Intelligence &amp; Google Maps
            </h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Interactive statutory infrastructure map with Google Maps integration, satellite views, and citizen GIS tools.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {/* Mode Switcher: Interactive GIS vs Native Google Maps */}
          <div style={{
            display: 'inline-flex',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            backgroundColor: '#ffffff'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('leaflet')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: viewMode === 'leaflet' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'leaflet' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              🗺️ Interactive Civic Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode('google_embed')}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                backgroundColor: viewMode === 'google_embed' ? '#ea4335' : 'transparent',
                color: viewMode === 'google_embed' ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              📍 Native Google Maps
            </button>
          </div>

          {/* Open Directly in Google Maps External Tab */}
          <a
            href={googleMapsSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#1a73e8',
              borderColor: '#aecbfa',
              backgroundColor: '#e8f0fe',
              fontWeight: 700
            }}
          >
            <span>🔴 Open in Google Maps ↗</span>
          </a>
        </div>
      </div>

      {/* Control Bar: Locality Jumper & Google Tiles (when in interactive mode) */}
      <div style={{
        padding: '10px 18px',
        backgroundColor: '#f8fafc',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        fontSize: 12
      }}>
        {/* Locality Quick-Jumper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Ward:</span>
          <select
            value={activeLocality}
            onChange={(e) => handleLocalitySelect(e.target.value)}
            style={{
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #cbd5e1',
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: '#ffffff',
              cursor: 'pointer'
            }}
          >
            {BANGALORE_WARDS.map(w => (
              <option key={w.key} value={w.label.replace('📍 ', '')}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        {viewMode === 'leaflet' && (
          <>
            {/* Google Maps Base Layer Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Map Style:</span>
              {Object.entries(TILE_LAYERS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBaseMap(key)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: baseMap === key ? '#1a73e8' : '#cbd5e1',
                    backgroundColor: baseMap === key ? '#1a73e8' : '#ffffff',
                    color: baseMap === key ? '#ffffff' : 'var(--text-main)',
                    fontWeight: 600,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  {item.name}
                </button>
              ))}
            </div>

            {/* Buffer Radius Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Buffer:</span>
              {[500, 1000, 2000].map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setBufferRadius(r)}
                  style={{
                    padding: '3px 7px',
                    borderRadius: 4,
                    border: '1px solid',
                    borderColor: bufferRadius === r ? 'var(--accent)' : '#cbd5e1',
                    backgroundColor: bufferRadius === r ? 'var(--accent-light)' : '#ffffff',
                    color: bufferRadius === r ? 'var(--accent)' : 'var(--text-main)',
                    fontWeight: 700,
                    fontSize: 11,
                    cursor: 'pointer'
                  }}
                >
                  {r >= 1000 ? `${r/1000} km` : `${r}m`}
                </button>
              ))}
            </div>

            {/* Live Buffer Stats */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#334155' }}>
              <span>Area: <strong>{bufferAreaSqKm} km²</strong></span>
              <span>Residents: <strong>~{estHouseholds.toLocaleString()}</strong></span>
            </div>
          </>
        )}
      </div>

      {/* Layer Filter Pills (Interactive Mode) */}
      {viewMode === 'leaflet' && (
        <div style={{
          display: 'flex',
          gap: 6,
          padding: '10px 18px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border)',
          overflowX: 'auto'
        }}>
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 9999,
              border: '1px solid',
              borderColor: activeFilter === 'all' ? 'var(--primary)' : 'var(--border)',
              backgroundColor: activeFilter === 'all' ? 'var(--primary)' : '#ffffff',
              color: activeFilter === 'all' ? '#ffffff' : 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            All Facilities ({pointsOfInterest.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('ward')}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 9999,
              border: '1px solid',
              borderColor: activeFilter === 'ward' ? '#1e40af' : 'var(--border)',
              backgroundColor: activeFilter === 'ward' ? '#eff6ff' : '#ffffff',
              color: activeFilter === 'ward' ? '#1e40af' : 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            🏛️ Ward Committee (Sec 13H)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('tax')}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 9999,
              border: '1px solid',
              borderColor: activeFilter === 'tax' ? '#7c3aed' : 'var(--border)',
              backgroundColor: activeFilter === 'tax' ? '#f5f3ff' : '#ffffff',
              color: activeFilter === 'tax' ? '#7c3aed' : 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            🏢 UAV Tax Desk (Sec 108A)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('rwh')}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 9999,
              border: '1px solid',
              borderColor: activeFilter === 'rwh' ? '#0284c7' : 'var(--border)',
              backgroundColor: activeFilter === 'rwh' ? '#e0f2fe' : '#ffffff',
              color: activeFilter === 'rwh' ? '#0284c7' : 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            💧 RWH Hotspots (Sec 295A)
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter('waste')}
            style={{
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 9999,
              border: '1px solid',
              borderColor: activeFilter === 'waste' ? '#d97706' : 'var(--border)',
              backgroundColor: activeFilter === 'waste' ? '#fef3c7' : '#ffffff',
              color: activeFilter === 'waste' ? '#d97706' : 'var(--text-main)',
              cursor: 'pointer'
            }}
          >
            ♻️ DWCC Facilities (Sec 431-A)
          </button>
        </div>
      )}

      {/* Map Display Area */}
      {viewMode === 'leaflet' ? (
        <div style={{ position: 'relative' }}>
          <div
            ref={mapContainerRef}
            style={{
              height: 490,
              width: '100%',
              backgroundColor: '#e5e7eb',
              zIndex: 1
            }}
          />

          {/* Map Tip Overlay */}
          <div style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 1000,
            backgroundColor: 'rgba(15, 23, 42, 0.88)',
            backdropFilter: 'blur(4px)',
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: 6,
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontSize: 14 }}>📍</span>
            <span>Click anywhere to drop a pin, get Google directions &amp; export GPS to RTI Form</span>
          </div>
        </div>
      ) : (
        /* Native Google Maps Embed */
        <div style={{ position: 'relative', width: '100%', height: 490 }}>
          <iframe
            title="Google Maps Embed View"
            width="100%"
            height="100%"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={googleMapsEmbedUrl}
          />
        </div>
      )}

      {/* Bottom Legend */}
      <div style={{
        padding: '14px 20px',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid var(--border)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: 10,
        fontSize: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏛️</span>
          <span><strong>Ward Committee:</strong> Sec 13H/13I Monthly Citizen Meeting</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>💧</span>
          <span><strong>RWH Hotspot:</strong> Sec 295A Mandatory Sizing (&ge; 2,400 sq.ft.)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>♻️</span>
          <span><strong>DWCC Facility:</strong> Sec 431-A Segregation &amp; Penalty Hub</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏢</span>
          <span><strong>UAV Tax Hub:</strong> Sec 108A Property Assessment ARO Desk</span>
        </div>
      </div>
    </div>
  );
}
