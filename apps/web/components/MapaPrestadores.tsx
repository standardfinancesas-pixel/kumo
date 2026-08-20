'use client';
import type { CSSProperties } from 'react';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * El mapa de prestadores, con geografía de verdad.
 *
 * Es **Leaflet con teselas de OpenStreetMap**, no Google Maps. Por qué:
 *
 *  · No hay que cargar una tarjeta ni administrar una clave de API. Google Maps
 *    JavaScript exige facturación activa aunque el uso entre en el tramo gratis, y
 *    eso convierte "mostrar cinco veterinarias" en un trámite del cliente.
 *  · Leaflet son ~42 kB y no manda nada a Google desde el navegador del socio.
 *
 * Se usa `leaflet` pelado y NO `react-leaflet` a propósito: el wrapper arrastra su
 * propia compatibilidad con la versión de React, y `apps/web` está en React 19 por
 * exigencia del App Router. Un `useEffect` de veinte líneas no necesita wrapper.
 *
 * OJO CON LAS TESELAS EN PRODUCCIÓN: `tile.openstreetmap.org` es el servidor
 * comunitario y su política pide uso moderado — sirve para probar y para un club
 * chico, pero no es una CDN. Si esto crece, la única línea que hay que cambiar es la
 * URL de las teselas por una de MapTiler, Stadia o Carto (tienen tramo gratis con
 * clave). La atribución es obligatoria y va puesta.
 */
export type PinMapa = {
  id: string;
  nombre: string;
  categoria: string;
  lat: number;
  lng: number;
};

export function MapaPrestadores({
  pins, centro, radioKm, onPin, style,
}: {
  pins: PinMapa[];
  /** El centro del mapa: hoy la zona del socio. */
  centro: { lat: number; lng: number };
  /** El radio de búsqueda que el socio eligió con el slider, en km. */
  radioKm: number;
  onPin?: (id: string) => void;
  style?: CSSProperties;
}) {
  const nodo = useRef<HTMLDivElement | null>(null);
  /* El mapa, el círculo y los pines viven en refs y no en estado: son objetos de
     Leaflet, no datos de React. Metidos en estado, cada render los recrearía y el
     mapa parpadearía volviendo al centro. */
  const mapa = useRef<import('leaflet').Map | null>(null);
  const circulo = useRef<import('leaflet').Circle | null>(null);
  const marcas = useRef<import('leaflet').Marker[]>([]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Import dinámico: Leaflet toca `window` al cargarse, así que en el server
      // build de Next revienta si se importa arriba.
      const L = (await import('leaflet')).default;
      if (!vivo || !nodo.current || mapa.current) return;

      mapa.current = L.map(nodo.current, {
        center: [centro.lat, centro.lng],
        zoom: 13,
        // Sin el control de zoom de Leaflet: el mapa es chico y los botones tapaban
        // un pin. Se sigue haciendo zoom con la rueda y con dos dedos.
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(mapa.current);
    })();
    return () => { vivo = false; };
  }, [centro.lat, centro.lng]);

  /* Los pines se redibujan cuando cambia la lista (el socio filtra por rubro o por
     radio). Se borran los viejos primero: sin eso, cada filtrado dejaba los
     anteriores encima y el mapa terminaba con veinte pines para cinco prestadores. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !mapa.current) return;

      for (const m of marcas.current) m.remove();
      marcas.current = [];

      for (const p of pins) {
        const icono = L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:50%;background:#5D5491;border:2.5px solid #fff;box-shadow:0 3px 10px rgba(33,30,51,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:700 12px 'DM Sans',sans-serif">${p.nombre.trim().charAt(0).toUpperCase()}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marca = L.marker([p.lat, p.lng], { icon: icono, title: p.nombre })
          .addTo(mapa.current)
          .bindTooltip(`${p.nombre} · ${p.categoria}`, { direction: 'top', offset: [0, -14] });
        if (onPin) marca.on('click', () => onPin(p.id));
        marcas.current.push(marca);
      }
    })();
    return () => { vivo = false; };
  }, [pins, onPin]);

  /* El círculo del radio: se mueve con el slider sin recrear el mapa. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !mapa.current) return;
      if (!circulo.current) {
        circulo.current = L.circle([centro.lat, centro.lng], {
          radius: radioKm * 1000,
          color: '#5D5491', weight: 1.5, dashArray: '5 5', fillColor: '#5D5491', fillOpacity: 0.08,
        }).addTo(mapa.current);
      } else {
        circulo.current.setLatLng([centro.lat, centro.lng]);
        circulo.current.setRadius(radioKm * 1000);
      }
    })();
    return () => { vivo = false; };
  }, [radioKm, centro.lat, centro.lng]);

  // Al desmontar hay que destruir el mapa: si no, Leaflet deja el contenedor
  // marcado como usado y al volver a la pantalla tira "Map container is already
  // initialized".
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);

  return <div ref={nodo} style={{ height: 250, borderRadius: 20, overflow: 'hidden', border: '1px solid rgb(230,227,240)', background: 'rgb(233,235,241)', ...style }} />;
}
