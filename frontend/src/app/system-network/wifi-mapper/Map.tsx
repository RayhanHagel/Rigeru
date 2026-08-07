"use client";
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon path issues with Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapProps {
  networks: any[];
  center: [number, number];
}

export default function Map({ networks, center }: MapProps) {
  function MapUpdater({ center }: { center: [number, number] }) {
    const map = useMap();
    useEffect(() => {
      if (center[0] !== 0 || center[1] !== 0) {
        map.setView(center, map.getZoom(), { animate: true });
      }
    }, [center, map]);
    return null;
  }

  return (
    <MapContainer center={center} zoom={17} style={{ height: '100%', width: '100%' }} className="rounded-xl overflow-hidden z-0">
      <MapUpdater center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {center[0] !== 0 && center[1] !== 0 && (
        <Circle center={center} radius={100} pathOptions={{ color: 'red', fillColor: 'red' }}>
          <Popup>Scanner Location</Popup>
        </Circle>
      )}
      {networks.map((n, idx) => (
        n.last_lat && n.last_lon ? (
          <Marker key={idx} position={[n.last_lat, n.last_lon]}>
            <Popup>
              <div className="text-sm">
                <strong>{n.ssid}</strong><br/>
                BSSID: {n.bssid}<br/>
                Security: {n.security}<br/>
                Signal: {n.signal}<br/>
                Last seen: {new Date(n.last_seen * 1000).toLocaleTimeString()}
              </div>
            </Popup>
          </Marker>
        ) : null
      ))}
    </MapContainer>
  );
}
