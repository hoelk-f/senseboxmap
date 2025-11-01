import { useEffect, useMemo, useState, useRef } from 'react';
import { MapContainer, Marker, Popup, TileLayer, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { format, parseISO } from 'date-fns';
import 'leaflet/dist/leaflet.css';
import './App.css';

import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const MAP_CENTER = [51.2524, 7.1287];
const BASE_URL = 'https://tmdt-solid-community-server.de/iotworkshop/public';
const REFRESH_INTERVAL = 60_000;

const SENSEBOXES = [
  { id: 0, name: 'SenseBox 0', position: [51.25249146683472, 7.128714956019335], file: 'sensebox0.json' },
  { id: 1, name: 'SenseBox 1', position: [51.25234545733288, 7.128517708781204], file: 'sensebox1.json' },
  { id: 2, name: 'SenseBox 2', position: [51.25247128668728, 7.128386842825138], file: 'sensebox2.json' },
  { id: 3, name: 'SenseBox 3', position: [51.252534201235335, 7.1285670205907365], file: 'sensebox3.json' },
  { id: 4, name: 'SenseBox 4', position: [51.2523240900498, 7.1288515117995805], file: 'sensebox4.json' }
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
  const history = hasData ? box.readings.slice(-20) : [];

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
          <h4>Verlauf</h4>
          <div className="chart-section">
            <LineChart
              data={history}
              valueKey="temperature"
              color="#ef4444"
              label="Temperatur"
              valueFormatter={(value) => `${value.toFixed(1)} °C`}
            />
            <LineChart
              data={history}
              valueKey="humidity"
              color="#3b82f6"
              label="Luftfeuchtigkeit"
              valueFormatter={(value) => `${value.toFixed(1)} %`}
            />
            <LineChart
              data={history}
              valueKey="illu"
              color="#22c55e"
              label="Beleuchtungsstärke"
              valueFormatter={(value) => `${value} lx`}
            />
            <LineChart
              data={history}
              valueKey="light"
              color="#f59e0b"
              label="Licht"
              valueFormatter={(value) => `${value.toFixed(2)} V`}
            />
          </div>
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

function LineChart({ data, valueKey, color, label, valueFormatter }) {
  if (!data || data.length === 0) {
    return null;
  }

  const width = 280;
  const height = 120;

  const values = data.map((entry) => entry[valueKey]);
  const timestamps = data.map((entry) => parseISO(entry.ts));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const gradientIdRef = useRef(
    `gradient-${valueKey}-${Math.random().toString(36).slice(2, 9)}`
  );
  const gradientId = gradientIdRef.current;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const normalized = range === 0 ? 0.5 : (value - minValue) / range;
      const y = height - normalized * height;
      return `${x},${y}`;
    })
    .join(' ');

  const firstLabel = timestamps[0] ? format(timestamps[0], 'HH:mm') : '';
  const lastLabel = timestamps[timestamps.length - 1]
    ? format(timestamps[timestamps.length - 1], 'HH:mm')
    : '';
  const latestValue = values[values.length - 1];

  return (
    <div className="line-chart">
      <div className="line-chart__header">
        <span className="line-chart__label">{label}</span>
        <span className="line-chart__value">{valueFormatter(latestValue)}</span>
      </div>
      <svg
        className="line-chart__svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill={`url(#${gradientId})`} />
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      <div className="line-chart__footer">
        <span>{firstLabel}</span>
        <span>
          Min: {valueFormatter(minValue)} · Max: {valueFormatter(maxValue)}
        </span>
        <span>{lastLabel}</span>
      </div>
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
