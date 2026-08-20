'use client';
import type { CSSProperties } from 'react';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

/**
 * El mapa de prestadores.
 *
 * Es **Leaflet** con teselas de **CARTO Positron**, no Google Maps. Por qué:
 *
 *  · No hay que cargar una tarjeta ni administrar una clave de API. Google Maps
 *    JavaScript exige facturación activa aunque el uso entre en el tramo gratis, y
 *    eso convierte "mostrar cinco veterinarias" en un trámite del cliente.
 *  · Leaflet son ~42 kB y no manda nada a Google desde el navegador del socio.
 *
 * **Por qué Positron y no las teselas de openstreetmap.org**: el estilo default de
 * OSM es un mapa de ruta —autopistas amarillas, cada comercio con su ícono, verde
 * saturado— y compite con lo único que este mapa tiene que mostrar, que son los
 * pines. Positron es gris pálido, casi sin color: los pines violetas se leen de
 * lejos y el mapa se parece al resto de la app. Es gratis y sin clave, igual que
 * antes, y la atribución (obligatoria) va puesta abajo.
 *
 * SI ESTO CRECE: tanto Positron como el servidor de OSM son servicios comunitarios
 * con expectativa de uso razonable, no CDNs contratadas. Para un club chico están
 * bien; el día que haga falta, lo único que cambia es la URL de las teselas por una
 * de MapTiler, Stadia o Carto con cuenta.
 *
 * Se usa `leaflet` pelado y NO `react-leaflet` a propósito: el wrapper arrastra su
 * propia compatibilidad con la versión de React, y `apps/web` está en React 19 por
 * exigencia del App Router. Un par de `useEffect` no necesitan wrapper.
 */
export type PinMapa = {
  id: string;
  nombre: string;
  categoria: string;
  lat: number;
  lng: number;
  /** Texto corto dentro de la gota, en vez del ícono del rubro. Lo usa el mapa de
   *  Beneficios para mostrar el descuento ("-20%"), que es el dato por el que uno
   *  mira ese mapa. */
  etiqueta?: string;
};

/*
 * Los íconos de los pines, en markup crudo.
 *
 * Son los mismos dibujos que los chips de rubro de la pantalla (`RUBRO_ICONS` en
 * AppClient), repetidos acá como texto porque un pin de Leaflet es un `divIcon`:
 * recibe HTML, no JSX. Si se agrega un rubro nuevo y no está en esta lista, el pin
 * sale con la patita, que es el genérico de Kumo.
 */
const ICONOS: Record<string, string> = {
  Paseador: '<circle cx="5.5" cy="10" r="1.7"/><circle cx="9.7" cy="6.4" r="1.8"/><circle cx="14.3" cy="6.4" r="1.8"/><circle cx="18.5" cy="10" r="1.7"/><path d="M8 14.2c-1.3 1-1.9 2.4-1.5 3.8.3 1.3 1.5 2 2.9 1.7 1-.2 1.6-.6 2.6-.6s1.6.4 2.6.6c1.4.3 2.6-.4 2.9-1.7.4-1.4-.2-2.8-1.5-3.8-1.1-.9-2.1-1.5-4-1.5s-2.9.6-4 1.5z"/>',
  'Guardería': '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>',
  Adiestrador: '<path d="M22 9 12 5 2 9l10 4 10-4z"/><path d="M6 11v5c0 1.3 2.7 3 6 3s6-1.7 6-3v-5"/>',
  'Baño y estética': '<path d="M12 3s6 5.7 6 10a6 6 0 0 1-12 0c0-4.3 6-10 6-10z"/>',
  Cuidador: '<circle cx="12" cy="8" r="3.4"/><path d="M5.5 20c.7-3.4 3.3-5.4 6.5-5.4s5.8 2 6.5 5.4"/>',
};
const PATITA = ICONOS.Paseador!;

const VIOLETA = '#5D5491';
const LIMA = '#E1FB62';
const TINTA = '#211E33';

/** Escapar lo que va adentro del SVG: el texto sale de la base (el descuento lo
 *  escribe el club a mano) y un "<" suelto rompería el marcador entero. */
const escapar = (t: string) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] ?? c));

/** El pin: una gota violeta con el ícono del rubro —o un texto corto— adentro. */
function pinHtml(pin: PinMapa): string {
  const adentro = pin.etiqueta
    // Cinco caracteres es lo que entra en 34 px sin salirse de la gota.
    ? `<text x="17" y="20" text-anchor="middle" font-family="DM Sans, sans-serif" font-size="10.5" font-weight="700" fill="#ffffff">${escapar(pin.etiqueta.slice(0, 5))}</text>`
    : `<g transform="translate(17 16) scale(0.63) translate(-12 -12)" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ICONOS[pin.categoria] ?? PATITA}</g>`;
  return `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 10.6 13.3 22.8 15.7 24.8a2 2 0 0 0 2.6 0C20.7 39.8 34 27.6 34 17 34 7.6 26.4 0 17 0z" fill="${VIOLETA}"/>
    <circle cx="17" cy="16" r="11.5" fill="#ffffff" fill-opacity="0.16"/>
    ${adentro}
  </svg>`;
}

/** El centro: la casa del socio, en lima para que no se confunda con un prestador. */
const CASA_HTML = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
  <circle cx="14" cy="14" r="12" fill="${LIMA}" stroke="#ffffff" stroke-width="3"/>
  <g transform="translate(14 14) scale(0.52) translate(-12 -12)" fill="none" stroke="${TINTA}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>
  </g>
</svg>`;

export function MapaPrestadores({
  pins, centro, radioKm, onPin, style,
}: {
  pins: PinMapa[];
  /** El centro del mapa: el domicilio del socio. `etiqueta` es cómo se llama en el
   *  mapa ("Tu casa", "Tu zona") y es null cuando no sabemos dónde vive y el centro
   *  es el de CABA — ahí no se dibuja ninguna casa, porque no es la de nadie. */
  centro: { lat: number; lng: number; etiqueta: string | null };
  /** El radio de búsqueda que el socio eligió con el slider, en km. Sin radio no se
   *  dibuja círculo y el encuadre lo deciden los pines: Beneficios no filtra por
   *  distancia (un descuento sirve aunque quede lejos), así que ahí no hay slider. */
  radioKm?: number;
  onPin?: (id: string) => void;
  style?: CSSProperties;
}) {
  const nodo = useRef<HTMLDivElement | null>(null);
  /* El mapa, el círculo, la casa y los pines viven en refs y no en estado: son
     objetos de Leaflet, no datos de React. Metidos en estado, cada render los
     recrearía y el mapa parpadearía volviendo al centro. */
  const mapa = useRef<import('leaflet').Map | null>(null);
  const circulo = useRef<import('leaflet').Circle | null>(null);
  const casa = useRef<import('leaflet').Marker | null>(null);
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
        // Sin los botones de zoom: el mapa es chico y tapaban un pin. El zoom lo
        // maneja el slider del radio (más abajo se encuadra el círculo), y en el
        // teléfono se hace con dos dedos.
        zoomControl: false,
        // La rueda NO hace zoom: este mapa vive en medio de una pantalla que se
        // scrollea, y con el zoom activado pasar el mouse por encima secuestra el
        // scroll de la página. Doble clic y pinch siguen funcionando.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 20,
        // En pantallas retina pide las teselas @2x: sin esto el mapa se ve borroso
        // justo en los teléfonos, que es donde más se usa.
        detectRetina: true,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(mapa.current);
      // "Leaflet" no hace falta en la esquina; la atribución de los datos sí, y es
      // la que queda.
      mapa.current.attributionControl.setPrefix('');
    })();
    return () => { vivo = false; };
  }, [centro.lat, centro.lng]);

  /* La casa del socio, en el centro. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !mapa.current) return;
      casa.current?.remove();
      casa.current = null;
      if (!centro.etiqueta) return;
      casa.current = L.marker([centro.lat, centro.lng], {
        icon: L.divIcon({ className: 'kumo-pin', html: CASA_HTML, iconSize: [28, 28], iconAnchor: [14, 14] }),
        title: centro.etiqueta,
        // Abajo de los pines: si dos coinciden, el que interesa tocar es el prestador.
        zIndexOffset: -100,
      }).addTo(mapa.current).bindTooltip(centro.etiqueta, { direction: 'top', offset: [0, -13] });
    })();
    return () => { vivo = false; };
  }, [centro.lat, centro.lng, centro.etiqueta]);

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
        const marca = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: 'kumo-pin',
            html: pinHtml(p),
            iconSize: [34, 42],
            // La punta de la gota es el lugar, no el centro del dibujo.
            iconAnchor: [17, 42],
          }),
          title: p.nombre,
        })
          .addTo(mapa.current)
          .bindTooltip(`${p.nombre} · ${p.categoria}`, { direction: 'top', offset: [0, -40] });
        if (onPin) marca.on('click', () => onPin(p.id));
        marcas.current.push(marca);
      }
    })();
    return () => { vivo = false; };
  }, [pins, onPin]);

  /* El círculo del radio, y el encuadre.
     El zoom lo decide el círculo: así el slider además de filtrar acerca y aleja,
     que es lo que uno espera al mover un radio. Pero acotado a los dos extremos —con
     1 km el encuadre exacto quedaba a nivel vereda, y con 25 km caía a zoom 9, donde
     Buenos Aires es una manchita y los cinco pines se apilan en el medio: el mapa
     dejaba de contestar "quién hay cerca". Fuera de ese rango el círculo se sale un
     poco del cuadro, y está bien: es un radio de búsqueda, no un marco. */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !mapa.current) return;

      /* Sin radio (Beneficios) el encuadre lo dan la casa y los pines, con el mismo
         tope de zoom: un beneficio en otra provincia no tiene que convertir el mapa
         en un planisferio. */
      if (radioKm == null) {
        circulo.current?.remove();
        circulo.current = null;
        const puntos: [number, number][] = [[centro.lat, centro.lng], ...pins.map((p) => [p.lat, p.lng] as [number, number])];
        const caja = L.latLngBounds(puntos).pad(0.15);
        const zoom = Math.min(15, Math.max(11, mapa.current.getBoundsZoom(caja, false, L.point(8, 8))));
        mapa.current.setView(caja.getCenter(), zoom, { animate: true });
        return;
      }

      if (!circulo.current) {
        circulo.current = L.circle([centro.lat, centro.lng], {
          radius: radioKm * 1000,
          color: VIOLETA, weight: 1.25, opacity: 0.45, fillColor: VIOLETA, fillOpacity: 0.07,
        }).addTo(mapa.current);
      } else {
        circulo.current.setLatLng([centro.lat, centro.lng]);
        circulo.current.setRadius(radioKm * 1000);
      }
      // `getBoundsZoom` en vez de `fitBounds` para poder acotar el zoom antes de
      // moverse: con `fitBounds` animado, preguntar el zoom después devuelve el
      // anterior y la corrección llegaba tarde.
      const zoom = Math.min(15, Math.max(11, mapa.current.getBoundsZoom(circulo.current.getBounds(), false, L.point(8, 8))));
      mapa.current.setView([centro.lat, centro.lng], zoom, { animate: true });
    })();
    return () => { vivo = false; };
  }, [radioKm, centro.lat, centro.lng, pins]);

  // Al desmontar hay que destruir el mapa: si no, Leaflet deja el contenedor
  // marcado como usado y al volver a la pantalla tira "Map container is already
  // initialized".
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);

  return <div ref={nodo} style={{ height: 250, borderRadius: 20, overflow: 'hidden', border: '1px solid rgb(230,227,240)', background: 'rgb(238,240,244)', ...style }} />;
}
