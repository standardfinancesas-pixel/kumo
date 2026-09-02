'use client';
import type { CSSProperties } from 'react';

import { useEffect, useRef, useState } from 'react';
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

/* Las esquinas del botón de pantalla completa: hacia afuera para ampliar, hacia
   adentro para volver. Es el ícono estándar de cualquier reproductor, así que no
   necesita explicación al lado. */
const AMPLIAR = 'M9 4H4v5 M15 4h5v5 M9 20H4v-5 M15 20h5v-5';
const ACHICAR = 'M4 9h5V4 M20 9h-5V4 M4 15h5v5 M20 15h-5v5';

function Esquinas({ abierto }: { abierto: boolean }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={VIOLETA} strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      {(abierto ? ACHICAR : AMPLIAR).split(' M').map((d, i) => (
        <path key={d} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}

/** El centro: la casa del socio, en lima para que no se confunda con un prestador. */
const CASA_HTML = `<svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
  <circle cx="14" cy="14" r="12" fill="${LIMA}" stroke="#ffffff" stroke-width="3"/>
  <g transform="translate(14 14) scale(0.52) translate(-12 -12)" fill="none" stroke="${TINTA}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/>
  </g>
</svg>`;

export function MapaPrestadores({
  pins, centro, radioKm, onPin, onCentro, style,
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
  /**
   * Sobre qué punto quedó el mapa después de moverlo.
   *
   * Se avisa al TERMINAR el movimiento (`moveend`) y no durante: quien escucha
   * esto vuelve a filtrar la lista de prestadores, y hacerlo en cada cuadro del
   * arrastre la haría saltar y recargarse debajo del cursor.
   */
  onCentro?: (c: { lat: number; lng: number }) => void;
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
  /* ¿La persona movió el mapa con la mano? A partir de ahí el mapa deja de
     recentrarse solo: si te llevaste el mapa a tres barrios de distancia y algo
     vuelve a encuadrarlo en tu casa, es imposible explorar. */
  const movidoAMano = useRef(false);
  /* Con qué radio y qué domicilio se encuadró la última vez. Mover el slider o
     mudarse SÍ vuelven a encuadrar: son pedidos explícitos de re-encuadre. */
  const ultimoEncuadre = useRef<string>('');
  const avisarCentro = useRef<(c: { lat: number; lng: number }) => void>(() => {});
  avisarCentro.current = (c) => onCentro?.(c);

  /*
   * Pantalla completa.
   *
   * Es un `position: fixed` que tapa la ventana, y NO la Fullscreen API del
   * navegador: `requestFullscreen` sobre un div no existe en Safari de iPhone
   * —ahí sólo los `<video>` van a pantalla completa—, y el teléfono es justo
   * donde un mapa de 250 px pide agrandarse. Un overlay funciona igual en todas
   * partes y se cierra con Escape.
   */
  const [abierto, setAbierto] = useState(false);
  /* Los botones de zoom de Leaflet, que sólo existen en pantalla completa (ver
     abajo por qué). */
  const ctrlZoom = useRef<import('leaflet').Control.Zoom | null>(null);

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
        // teléfono se hace con dos dedos. En pantalla completa sí aparecen, donde
        // no hay nada que tapar (ver el efecto de `abierto`).
        zoomControl: false,
        // La rueda NO hace zoom: este mapa vive en medio de una pantalla que se
        // scrollea, y con el zoom activado pasar el mouse por encima secuestra el
        // scroll de la página. Doble clic y pinch siguen funcionando, y en pantalla
        // completa la rueda se enciende porque ya no hay página atrás.
        scrollWheelZoom: false,
        attributionControl: true,
      });
      /* Arrastrar el mapa lo "toma" la persona: desde ese momento no se vuelve a
         centrar solo. Leaflet ya traía el arrastre habilitado; lo que lo hacía
         inútil era que un efecto lo devolvía al centro. */
      mapa.current.on('dragstart', () => { movidoAMano.current = true; });
      /* Al terminar de moverse se avisa dónde quedó, para que la lista siga al
         mapa. Por referencia: este listener se registra una sola vez y no ve el
         `onCentro` de renders posteriores. */
      mapa.current.on('moveend', () => {
        const c = mapa.current?.getCenter();
        if (!c) return;
        /* El círculo marca el ÁREA QUE SE ESTÁ BUSCANDO, así que acompaña al mapa.
           La casa se queda donde vive: si el círculo siguiera al domicilio, la
           lista buscaría en un lado y el dibujo mostraría otro. */
        circulo.current?.setLatLng(c);
        avisarCentro.current({ lat: c.lat, lng: c.lng });
      });
      /*
       * La clave va en la URL y es PÚBLICA a propósito: CARTO dejó de servir
       * teselas sin clave (27/08/2026 — de un día para otro los mapas de las dos
       * superficies mostraron "API KEY REQUIRED" dibujado en cada tesela) y su
       * clave es de las que viajan al navegador, atada al dominio declarado al
       * pedirla. Sin la variable, el mapa muestra ese cartel — feo pero no rompe
       * nada, y así el deploy no depende de tener la clave ya.
       */
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png${process.env.NEXT_PUBLIC_CARTO_KEY ? `?key=${process.env.NEXT_PUBLIC_CARTO_KEY}` : ''}`, {
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
          /* El tooltip va ESCAPADO: Leaflet inserta su contenido como HTML, y el
             nombre del prestador lo escribe un socio al dar de alta su negocio. Sin
             escapar, un nombre con una etiqueta adentro ejecuta script en el navegador
             de cualquiera que abra Servicios. */
          .bindTooltip(escapar(`${p.nombre} · ${p.categoria}`), { direction: 'top', offset: [0, -40] });
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
  /* Firma estable de los pines: `pins` se arma con un `.map()` en cada render del
     padre, así que como dependencia cambia SIEMPRE aunque los prestadores sean los
     mismos. Con el array crudo, este efecto corría en cada render y devolvía el
     mapa al centro — de ahí la sensación de que no se podía mover. */
  const firmaPins = pins.map((p) => p.id).join('|');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      if (!vivo || !mapa.current) return;

      /* Mover el slider o mudarse re-encuadran y le devuelven el control al mapa.
         Si sólo cambiaron los pines y la persona ya había movido el mapa, se la
         deja donde está. */
      const encuadre = `${radioKm ?? 'sin'}|${centro.lat}|${centro.lng}`;
      const pidieronEncuadre = encuadre !== ultimoEncuadre.current;
      if (pidieronEncuadre) movidoAMano.current = false;
      ultimoEncuadre.current = encuadre;
      const puedeEncuadrar = pidieronEncuadre || !movidoAMano.current;

      /* Sin radio (Beneficios) el encuadre lo dan la casa y los pines, con el mismo
         tope de zoom: un beneficio en otra provincia no tiene que convertir el mapa
         en un planisferio. */
      if (radioKm == null) {
        circulo.current?.remove();
        circulo.current = null;
        const puntos: [number, number][] = [[centro.lat, centro.lng], ...pins.map((p) => [p.lat, p.lng] as [number, number])];
        const caja = L.latLngBounds(puntos).pad(0.15);
        if (puedeEncuadrar) {
          /* Acá NO va el piso de 11 del caso del radio: lo que encuadra son los
             PINES, que pueden estar a 300 km (un socio de Tandil, con los locales en
             Buenos Aires). Con 11 el mapa se abría en su ciudad sin un solo beneficio
             a la vista, que es peor que verlos chiquitos. El círculo del radio, en
             cambio, siempre está alrededor tuyo y ahí 11 sigue bien. */
          const zoom = Math.min(15, Math.max(5, mapa.current.getBoundsZoom(caja, false, L.point(8, 8))));
          mapa.current.setView(caja.getCenter(), zoom, { animate: true });
        }
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
      if (puedeEncuadrar) {
        const zoom = Math.min(15, Math.max(11, mapa.current.getBoundsZoom(circulo.current.getBounds(), false, L.point(8, 8))));
        mapa.current.setView([centro.lat, centro.lng], zoom, { animate: true });
      }
    })();
    return () => { vivo = false; };
  }, [radioKm, centro.lat, centro.lng, firmaPins]);

  /*
   * Lo que hay que reacomodar al abrir y cerrar la pantalla completa.
   *
   *  · `invalidateSize`: el contenedor cambió de tamaño por CSS y Leaflet no se
   *    entera solo. Sin esto queda con las teselas del recuadro chico y el resto
   *    de la pantalla en gris hasta que algo lo mueva.
   *  · La rueda del mouse: en el recuadro chico está apagada a propósito (el mapa
   *    vive en medio de una página que scrollea y pasar el mouse por encima le
   *    secuestraría el scroll). En pantalla completa no hay página atrás que
   *    scrollear, así que la rueda pasa a ser lo que uno espera.
   *  · Los botones de + y −: sin rueda y sin botones, en una computadora la única
   *    forma de alejarse era Shift+doble clic, que nadie conoce. Se agregan acá y
   *    no en la creación del mapa porque en el recuadro chico tapaban un pin.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const L = (await import('leaflet')).default;
      const m = mapa.current;
      if (!vivo || !m) return;
      m.invalidateSize();
      if (abierto) {
        m.scrollWheelZoom.enable();
        if (!ctrlZoom.current) ctrlZoom.current = L.control.zoom({ position: 'topleft' }).addTo(m);
      } else {
        m.scrollWheelZoom.disable();
        ctrlZoom.current?.remove();
        ctrlZoom.current = null;
      }
    })();
    return () => { vivo = false; };
  }, [abierto]);

  /* Escape cierra, y mientras está abierto el cuerpo no scrollea: el overlay tapa
     la página, pero sin esto el dedo sobre el mapa seguía moviendo lo que hay
     detrás y al cerrar aparecías en otra parte de la pantalla. */
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    window.addEventListener('keydown', tecla);
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [abierto]);

  // Al desmontar hay que destruir el mapa: si no, Leaflet deja el contenedor
  // marcado como usado y al volver a la pantalla tira "Map container is already
  // initialized".
  useEffect(() => () => { mapa.current?.remove(); mapa.current = null; }, []);

  /*
   * Tres capas, y las tres hacen falta:
   *
   *  1. El hueco en la página, que conserva su alto y sus márgenes SIEMPRE. Al
   *     abrir la pantalla completa la capa de adentro se va a `fixed` y deja de
   *     ocupar lugar; sin este hueco, todo lo que sigue en la pantalla salta
   *     hacia arriba y al cerrar vuelve a bajar.
   *  2. La caja del mapa, que es la que se convierte en overlay.
   *  3. El div de Leaflet, que NO cambia de lugar en el árbol al abrir: si se
   *     moviera, React lo desmontaría y Leaflet tiraría "Map container is
   *     already initialized".
   */
  return (
    <div style={{ position: 'relative', height: 250, ...style }}>
      <div
        style={
          abierto
            ? { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgb(238,240,244)' }
            : { position: 'absolute', inset: 0 }
        }
      >
        <div
          ref={nodo}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: abierto ? 0 : 20,
            overflow: 'hidden',
            border: abierto ? 'none' : '1px solid rgb(230,227,240)',
            background: 'rgb(238,240,244)',
          }}
        />
        {/* Arriba a la derecha: abajo va la atribución (obligatoria) y arriba a la
            izquierda, en pantalla completa, los botones de zoom. El z-index le
            gana a los controles de Leaflet, que llegan a 800. */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={abierto ? 'Cerrar el mapa' : 'Ver el mapa en pantalla completa'}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 11px',
            borderRadius: 100,
            border: '1px solid rgb(230,227,240)',
            background: 'rgba(255,255,255,0.94)',
            color: VIOLETA,
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <Esquinas abierto={abierto} />
          {abierto ? 'Cerrar' : 'Ampliar'}
        </button>
      </div>
    </div>
  );
}
