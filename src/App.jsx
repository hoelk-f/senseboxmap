import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { format, parseISO } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import './App.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const MAP_CENTER = [51.2596, 7.1602];
const BASE_URL = 'https://tmdt-solid-community-server.de/iotworkshop/public';
const REFRESH_INTERVAL = 60_000;

const SENSEBOXES = [
  { id: 0, name: 'SenseBox 0', position: [51.2599, 7.1599], file: 'sensebox0.json' },
  { id: 1, name: 'SenseBox 1', position: [51.2593, 7.1604], file: 'sensebox1.json' },
  { id: 2, name: 'SenseBox 2', position: [51.2596, 7.1609], file: 'sensebox2.json' },
  { id: 3, name: 'SenseBox 3', position: [51.2601, 7.1606], file: 'sensebox3.json' },
  { id: 4, name: 'SenseBox 4', position: [51.2594, 7.1597], file: 'sensebox4.json' }
];

const defaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = defaultIcon;

function SenseboxPopup({ box }) {
  const hasData = box.readings && box.readings.length > 0;
  const latest = hasData ? box.readings[box.readings.length - 1] : null;
  const recent = hasData ? [...box.readings.slice(-5)].reverse() : [];

  return (
    <div className="popup">
      <h3>{box.name}</h3>
      {latest ? (
        <>
          <p className="timestamp">
            Letzte Messung: {format(parseISO(latest.ts), 'dd.MM.yyyy HH:mm:ss')} Uhr
          </p>
          <div className="metrics-grid">
            <Metric label="Temperatur" value={`${latest.temperature.toFixed(1)} °C`} />
            <Metric label="Luftfeuchtigkeit" value={`${latest.humidity.toFixed(1)} %`} />
            <Metric label="Beleuchtungsstärke" value={`${latest.illu} lx`} />
            <Metric label="Licht" value={`${latest.light.toFixed(2)} V`} />
          </div>
          <h4>Letzte 5 Werte</h4>
          <ul className="history-list">
            {recent.map((entry, idx) => (
              <li key={`${box.id}-${idx}`}>
                <span>{format(parseISO(entry.ts), 'HH:mm:ss')}</span>
                <span>{entry.temperature.toFixed(1)} °C</span>
                <span>{entry.humidity.toFixed(1)} %</span>
                <span>{entry.illu} lx</span>
                <span>{entry.light.toFixed(2)} V</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Keine Daten verfügbar.</p>
      )}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
    </div>
  );
}

export default function App() {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const results = await Promise.all(
          SENSEBOXES.map(async (box) => {
            const response = await fetch(`${BASE_URL}/${box.file}`, { cache: 'no-store' });
            if (!response.ok) {
              throw new Error(`Fehler beim Laden von ${box.name}`);
            }
            const readings = await response.json();
            return { ...box, readings };
          })
        );
        if (!isMounted) return;
        setBoxes(results);
        setError(null);
        setLoading(false);
      } catch (err) {
        if (!isMounted) return;
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const mapBounds = useMemo(() => {
    const positions = boxes.length ? boxes.map((box) => box.position) : SENSEBOXES.map((box) => box.position);
    return L.latLngBounds(positions);
  }, [boxes]);

  return (
    <div className="app">
      <header>
        <h1>SenseBox Monitoring – Alte Papierfabrik Wuppertal</h1>
        <p>
          Die Daten werden jede Minute aus dem Solid Pod geladen. Klicken Sie auf eine SenseBox, um die aktuellen Werte
          zu sehen.
        </p>
        {loading && <p className="status">Lade Daten…</p>}
        {error && <p className="status error">{error}</p>}
      </header>
      <main>
        <MapContainer
          className="map"
          center={MAP_CENTER}
          zoom={18}
          scrollWheelZoom
          bounds={mapBounds}
          boundsOptions={{ padding: [40, 40] }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {boxes.map((box) => (
            <Marker position={box.position} key={box.id}>
              <Tooltip direction="top" offset={[0, -30]} permanent>
                {box.name}
              </Tooltip>
              <Popup closeButton={false}>
                <SenseboxPopup box={box} />
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}
