import { useState } from 'react';
import { Image, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '@kumo/shared';
import { Texto as Text, BRAND, INK, MUTED } from './ui/Texto';

/**
 * El mapa de la app, con geografía de verdad y sin módulos nativos.
 *
 * Los dos mapas de la app eran dibujos: rectángulos grises de "manzanas" y los pines
 * ubicados con un hash del id, sin relación con dónde queda nada. La web ya tiene el
 * mapa real (Leaflet + teselas de CARTO), pero acá **no se puede usar Leaflet**: no
 * hay DOM, y meterlo en un WebView o usar el mapa nativo son módulos nativos, o sea
 * un APK nuevo — y los teléfonos que ya tienen la app instalada se quedarían sin el
 * arreglo hasta reinstalar.
 *
 * Así que el mapa se dibuja acá: **una tesela es un PNG en una URL** (`{z}/{x}/{y}`),
 * así que alcanza con calcular qué teselas caen en el recuadro y ponerlas como
 * `<Image>`. Las mismas de la web (CARTO Positron), así los dos mapas se ven igual.
 * Todo esto es JavaScript, así que viaja por OTA.
 *
 * Lo que NO tiene, a propósito: arrastrar y hacer zoom. El mapa contesta "quién hay
 * cerca" de un vistazo, y para "llevame hasta acá" la ficha ya tiene la dirección,
 * que abre la app de mapas del teléfono. El día que haga falta moverlo, es Leaflet en
 * un WebView y este archivo se borra.
 *
 * La atribución es obligatoria y va abajo a la derecha.
 */
export type PinMapa = {
  id: string;
  nombre: string;
  lat: number;
  lng: number;
  /** Texto corto adentro del pin (el descuento del beneficio). Sin esto, la patita. */
  etiqueta?: string;
};

const TESELA = 256;
const TESELAS = 'https://a.basemaps.cartocdn.com/light_all';
/** La clave de las teselas de CARTO, que dejó de servirlas sin clave (27/08/2026):
 *  sin esto cada tesela llega con "API KEY REQUIRED" dibujado adentro. Es pública
 *  a propósito —viaja horneada en el bundle, atada al dominio declarado— y si
 *  falta, el mapa muestra el cartel pero nada se rompe. */
const CLAVE_TESELAS = process.env.EXPO_PUBLIC_CARTO_KEY ?? '';

/* ── La proyección ─────────────────────────────────────────────────── */

/**
 * De coordenadas a píxeles del mundo, en Web Mercator — la misma que usan todos los
 * mapas de teselas. En el zoom `z` el mundo mide `256 * 2^z` píxeles, y la tesela
 * `{x}/{y}` es el recorte de 256×256 que empieza en `(x*256, y*256)`.
 */
function aPixeles(lat: number, lng: number, z: number): { x: number; y: number } {
  const mundo = TESELA * 2 ** z;
  const x = ((lng + 180) / 360) * mundo;
  const sen = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sen) / (1 - sen)) / (4 * Math.PI)) * mundo;
  return { x, y };
}

/** Cuántos metros mide un píxel, que depende del zoom Y de la latitud (el mundo se
 *  estira hacia los polos). Se usa para elegir el zoom y para dibujar el radio. */
function metrosPorPixel(lat: number, z: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** z;
}

/**
 * El zoom que hace entrar lo que hay que mostrar.
 *
 * Acotado a los dos extremos por el mismo motivo que en la web: con un radio de 1 km
 * el encuadre exacto queda a nivel vereda, y con uno de 25 la ciudad se vuelve una
 * manchita y los pines se apilan en el medio. Fuera de ese rango el círculo se sale
 * un poco del recuadro, y está bien: es un radio de búsqueda, no un marco.
 */
function zoomPara(metros: number, lado: number, lat: number): number {
  if (!(metros > 0) || !(lado > 0)) return 13;
  const necesarios = metros / (lado / 2);
  const z = Math.log2((156543.03392 * Math.cos((lat * Math.PI) / 180)) / necesarios);
  return Math.max(11, Math.min(15, Math.floor(z)));
}

/* ── El pin ────────────────────────────────────────────────────────── */

/** La gota violeta, igual que en la web: la punta apunta al lugar. */
function Gota({ etiqueta }: { etiqueta?: string }) {
  return (
    <View style={{ width: 34, height: 42 }}>
      <Svg width={34} height={42} viewBox="0 0 34 42">
        <Path
          d="M17 0C7.6 0 0 7.6 0 17c0 10.6 13.3 22.8 15.7 24.8a2 2 0 0 0 2.6 0C20.7 39.8 34 27.6 34 17 34 7.6 26.4 0 17 0z"
          fill={BRAND}
        />
        <Circle cx={17} cy={16} r={11.5} fill="#ffffff" fillOpacity={0.16} />
        {/* Sin etiqueta va la patita de Kumo: es "un prestador", sin prometer rubro.
            Los íconos por rubro viven adentro de `Ic` en App.tsx y traerlos hasta acá
            sería mover medio archivo. */}
        {!etiqueta && (
          <>
            <Circle cx={13.5} cy={14.5} r={1.5} fill="#fff" />
            <Circle cx={16.2} cy={12.2} r={1.6} fill="#fff" />
            <Circle cx={19.2} cy={12.2} r={1.6} fill="#fff" />
            <Circle cx={21.8} cy={14.5} r={1.5} fill="#fff" />
            <Path
              d="M15 17.4c-.9.7-1.3 1.7-1 2.6.2.9 1 1.4 2 1.2.7-.1 1.1-.4 1.8-.4s1.1.3 1.8.4c1 .2 1.8-.3 2-1.2.3-1-.1-1.9-1-2.6-.8-.6-1.5-1-2.8-1s-2 .4-2.8 1z"
              fill="#fff"
            />
          </>
        )}
      </Svg>
      {etiqueta ? (
        <Text style={{ position: 'absolute', top: 9, left: 0, right: 0, textAlign: 'center', color: '#fff', fontWeight: '700', fontSize: 10.5 }}>
          {etiqueta.slice(0, 5)}
        </Text>
      ) : null}
    </View>
  );
}

/* ── El mapa ───────────────────────────────────────────────────────── */

export function MapaLugares({
  pins, centro, radioKm, onPin, alto = 230,
}: {
  pins: PinMapa[];
  /** El centro: el domicilio del socio. `etiqueta` es cómo se llama ("Tu casa") y es
   *  null cuando no sabemos dónde vive y el centro es el de CABA — ahí no se dibuja
   *  ninguna casa, porque no es la de nadie. */
  centro: { lat: number; lng: number; etiqueta: string | null };
  /** El radio elegido con el slider, en km. Sin radio, el encuadre lo dan los pines
   *  (Beneficios no filtra por distancia: un descuento sirve aunque quede lejos). */
  radioKm?: number;
  onPin?: (id: string) => void;
  alto?: number;
}) {
  /* El ancho se mide en pantalla: el recuadro es del ancho de la pantalla menos los
     márgenes, y los teléfonos no miden todos lo mismo. Hasta que se mida no se
     dibuja nada, para no pedir teselas de un tamaño que no es. */
  const [ancho, setAncho] = useState(0);
  const medir = (e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width));

  /* Qué tiene que entrar en el recuadro: el radio si hay, y si no la distancia al pin
     más lejos (con un piso, para que un solo pin al lado no deje el mapa a nivel
     baldosa). */
  const metros = radioKm != null
    ? radioKm * 1000
    : Math.max(
      800,
      ...pins.map((p) => {
        const R = 6371000;
        const rad = (d: number) => (d * Math.PI) / 180;
        const dLat = rad(p.lat - centro.lat);
        const dLng = rad(p.lng - centro.lng);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(centro.lat)) * Math.cos(rad(p.lat)) * Math.sin(dLng / 2) ** 2;
        return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
      }),
    );
  const z = zoomPara(metros, Math.min(ancho || 320, alto), centro.lat);

  const c = aPixeles(centro.lat, centro.lng, z);
  const origen = { x: c.x - (ancho || 320) / 2, y: c.y - alto / 2 };

  /*
   * Las teselas que tocan el recuadro.
   *
   * El índice `x` se normaliza al ancho del mundo (`2^z`) porque cruzando el
   * antimeridiano da negativo, pero la POSICIÓN se calcula con el índice sin
   * normalizar: si no, la tesela del borde salta al otro extremo del mapa. `y` no se
   * normaliza: arriba del Polo Norte no hay tesela, y esas filas simplemente no van.
   */
  const teselas: { x: number; y: number; left: number; top: number }[] = [];
  if (ancho > 0) {
    const limite = 2 ** z;
    for (let tx = Math.floor(origen.x / TESELA); tx <= Math.floor((origen.x + ancho) / TESELA); tx++) {
      for (let ty = Math.floor(origen.y / TESELA); ty <= Math.floor((origen.y + alto) / TESELA); ty++) {
        if (ty < 0 || ty >= limite) continue;
        teselas.push({
          x: ((tx % limite) + limite) % limite,
          y: ty,
          left: tx * TESELA - origen.x,
          top: ty * TESELA - origen.y,
        });
      }
    }
  }

  const radioPx = radioKm != null ? (radioKm * 1000) / metrosPorPixel(centro.lat, z) : 0;

  return (
    <View
      onLayout={medir}
      style={{ height: alto, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#e6e3f0', backgroundColor: '#eef0f4' }}
    >
      {/* Las teselas */}
      {teselas.map((t) => (
        <Image
          key={`${z}/${t.x}/${t.y}/${t.left}`}
          source={{ uri: `${TESELAS}/${z}/${t.x}/${t.y}.png${CLAVE_TESELAS ? `?key=${CLAVE_TESELAS}` : ''}` }}
          style={{ position: 'absolute', left: t.left, top: t.top, width: TESELA, height: TESELA }}
        />
      ))}

      {/* El círculo del radio */}
      {radioPx > 0 ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: (ancho || 320) / 2 - radioPx,
            top: alto / 2 - radioPx,
            width: radioPx * 2,
            height: radioPx * 2,
            borderRadius: radioPx,
            borderWidth: 1.25,
            borderColor: 'rgba(93,84,145,0.45)',
            backgroundColor: 'rgba(93,84,145,0.07)',
          }}
        />
      ) : null}

      {/* La casa del socio. No se dibuja si el centro no es un lugar suyo. */}
      {ancho > 0 && centro.etiqueta ? (
        <View style={{ position: 'absolute', left: (ancho || 320) / 2 - 14, top: alto / 2 - 14 }}>
          <View style={{ width: 28, height: 28, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.brand.lime, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={14} height={14} viewBox="0 0 24 24">
              <Path d="M3 10.5 12 3l9 7.5" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M5 9.5V20h14V9.5" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </View>
      ) : null}

      {/* Los pines. La punta de la gota va en el lugar, así que se corre 17 a la
          izquierda y 42 hacia arriba. */}
      {ancho > 0 && pins.map((p) => {
        const q = aPixeles(p.lat, p.lng, z);
        const left = q.x - origen.x - 17;
        const top = q.y - origen.y - 42;
        // Un pin que cae afuera del recuadro no se dibuja: en Android, una vista
        // fuera de los límites igual consume memoria y captura toques.
        if (left < -34 || top < -42 || left > (ancho || 320) || top > alto) return null;
        return (
          <TouchableOpacity
            key={p.id}
            disabled={!onPin}
            onPress={() => onPin?.(p.id)}
            style={{ position: 'absolute', left, top }}
          >
            <Gota etiqueta={p.etiqueta} />
          </TouchableOpacity>
        );
      })}

      {/* La atribución, obligatoria. */}
      <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 6, paddingVertical: 1, borderTopLeftRadius: 8 }}>
        <Text style={{ fontSize: 9.5, color: MUTED }}>© OpenStreetMap © CARTO</Text>
      </View>
    </View>
  );
}
