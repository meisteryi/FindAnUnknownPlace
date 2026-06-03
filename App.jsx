import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { latLngToCell, cellToBoundary } from 'h3-js';
import exifr from 'exifr';
import 'mapbox-gl/dist/mapbox-gl.css';

// TODO: 발급받은 Mapbox Access Token으로 교체하세요.
mapboxgl.accessToken = 'YOUR_MAPBOX_ACCESS_TOKEN';

const App = () => {
  const mapContainer = useRef(null);
  const map = useRef(null);

  const [visitedHexagons, setVisitedHexagons] = useState(new Set());
  const [geoJsonData, setGeoJsonData] = useState({
    type: 'FeatureCollection',
    features: [],
  });

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [139.715, 35.72],
      zoom: 13,
    });

    map.current.on('load', () => {
      map.current.addSource('hexagons', {
        type: 'geojson',
        data: geoJsonData,
      });

      map.current.addLayer({
        id: 'hexagons-layer',
        type: 'fill',
        source: 'hexagons',
        paint: {
          'fill-color': '#fced4a',
          'fill-opacity': 0.6,
          'fill-outline-color': '#fced4a',
        },
      });
    });
  }, []);

  useEffect(() => {
    if (map.current && map.current.getSource('hexagons')) {
      map.current.getSource('hexagons').setData(geoJsonData);
    }
  }, [geoJsonData]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const gpsData = await exifr.gps(file);

      if (!gpsData || !gpsData.latitude || !gpsData.longitude) {
        alert('위치 정보가 없는 사진입니다.');
        event.target.value = '';
        return;
      }

      const { latitude, longitude } = gpsData;
      const hexId = latLngToCell(latitude, longitude, 10);

      if (visitedHexagons.has(hexId)) {
        event.target.value = '';
        return;
      }

      const boundary = cellToBoundary(hexId);
      const coordinates = boundary.map((coord) => [coord[1], coord[0]]);
      coordinates.push(coordinates[0]); // 닫힌 폴리곤(Closed Polygon) 만들기

      const newFeature = {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coordinates],
        },
        properties: { id: hexId },
      };

      setVisitedHexagons((prev) => new Set(prev).add(hexId));
      setGeoJsonData((prev) => ({
        ...prev,
        features: [...prev.features, newFeature],
      }));

      map.current.flyTo({
        center: [longitude, latitude],
        zoom: 14,
        essential: true,
        speed: 1.2,
      });
    } catch (error) {
      console.error('EXIF 파싱 오류:', error);
      alert('사진 데이터를 처리하는 중 오류가 발생했습니다.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          color: 'white',
          padding: '24px',
          borderRadius: '12px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          minWidth: '250px',
          backdropFilter: 'blur(4px)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '20px', color: '#fced4a' }}>
          Unseen Map
        </h1>

        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
          방문한 격자 수 :{' '}
          <span style={{ color: '#fced4a' }}>{visitedHexagons.size}</span> 개
        </div>

        <label
          style={{
            backgroundColor: '#333',
            padding: '10px',
            borderRadius: '6px',
            cursor: 'pointer',
            textAlign: 'center',
            fontSize: '14px',
            border: '1px solid #555',
          }}
        >
          사진 업로드 (위치 탐색)
          <input
            type="file"
            accept="image/jpeg, image/png, image/heic"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </label>

        <p
          style={{
            margin: 0,
            fontSize: '12px',
            color: '#aaa',
            lineHeight: '1.4',
          }}
        >
          * 사진은 서버로 전송되지 않고
          <br />
          기기 내부에서만 안전하게 분석됩니다.
        </p>
      </div>
    </div>
  );
};

export default App;
