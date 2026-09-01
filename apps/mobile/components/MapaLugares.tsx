import { useEffect, useRef, useState } from 'react';
import { Animated, Image, PanResponder, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
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
 * Lo que NO tiene, a propósito: arrastrar. El mapa contesta "quién hay cerca" de un
 * vistazo, y para "llevame hasta acá" la ficha ya tiene la dirección, que abre la app
 * de mapas del teléfono. El día que haga falta moverlo, es Leaflet en un WebView y
 * este archivo se borra.
 *
 * Zoom sí tiene: con dos dedos y con los botones. Es todo JavaScript —una tesela es
 * una URL con el zoom adentro— así que viaja por OTA como el resto.
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

/** El camino de vuelta: de píxeles del mundo a coordenadas. Hace falta para saber
 *  sobre qué punto quedó el mapa después de arrastrarlo. */
function aCoords(x: number, y: number, z: number): { lat: number; lng: number } {
  const mundo = TESELA * 2 ** z;
  const lng = (x / mundo) * 360 - 180;
  const n = Math.PI - 2 * Math.PI * (y / mundo);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
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

/**
 * Los topes del zoom que puede pedir la persona, más anchos que los de `zoomPara`.
 *
 * Son otro objetivo: `zoomPara` encuadra el círculo del radio, y acá lo que se
 * quiere es mirar la cuadra. CARTO sirve teselas hasta z20; en 18 ya se leen los
 * portales, y bajar de 10 convierte la ciudad en una manchita sin pines.
 */
const ZOOM_MIN = 10;
const ZOOM_MAX = 18;

/** La distancia entre dos dedos, que es lo único que define un pinch. */
const separacion = (t: { pageX: number; pageY: number }[]): number => {
  const [a, b] = t;
  /* Devolver 0 y no romper si llegó un solo dedo: el 0 hace que el gesto se
     considere no iniciado y el movimiento se ignore, que es lo correcto. */
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

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
  pins, centro, radioKm, onPin, onCentro, alto = 230,
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
  /**
   * Sobre qué punto quedó el mapa después de moverlo.
   *
   * Se avisa al SOLTAR y no mientras el dedo se mueve: quien escucha esto vuelve a
   * filtrar la lista de prestadores, y hacerlo en cada cuadro del gesto la haría
   * saltar y recargarse sin parar debajo del dedo.
   */
  onCentro?: (c: { lat: number; lng: number }) => void;
  alto?: number;
}) {
  /* El ancho se mide en pantalla: el recuadro es del ancho de la pantalla menos los
     márgenes, y los teléfonos no miden todos lo mismo. Hasta que se mida no se
     dibuja nada, para no pedir teselas de un tamaño que no es. */
  const [ancho, setAncho] = useState(0);
  const medir = (e: LayoutChangeEvent) => setAncho(Math.round(e.nativeEvent.layout.width));

  /* Cuántos niveles se corrió la persona respecto del encuadre automático. Se guarda
     el DESVÍO y no el zoom absoluto para que el encuadre siga mandando: si cambian
     los pines, el mapa se reacomoda solo y el acercamiento pedido se respeta igual. */
  const [zoomExtra, setZoomExtra] = useState(0);

  /* Cuánto se corrió el mapa con el dedo, en píxeles de pantalla. Es un desvío
     respecto del encuadre, igual que el zoom: si cambian los pines o el radio, el
     mapa se reacomoda y esto vuelve a cero. */
  const [mov, setMov] = useState({ x: 0, y: 0 });
  const movInicio = useRef({ x: 0, y: 0 });
  const arrastrando = useRef(false);

  /* El slider re-encuadra: mover el radio vuelve al zoom que hace entrar el círculo.
     Sin esto, después de acercarse con los dedos el slider parecía no hacer nada —
     seguía filtrando, pero el mapa no se movía y se leía como que estaba roto. */
  useEffect(() => { setZoomExtra(0); setMov({ x: 0, y: 0 }); }, [radioKm]);

  /* El pinch se muestra estirando las teselas que YA están, y recién al soltar se
     piden las del zoom nuevo. Es el mismo criterio que el slider del radio: pedir
     teselas en cada cuadro del gesto llena la pantalla de imágenes a medio cargar.
     `Animated` para que el estirado no re-renderice el mapa entero mientras se
     mueven los dedos. */
  const escala = useRef(new Animated.Value(1)).current;
  const inicial = useRef(0);
  const factor = useRef(1);

  /* El PanResponder se crea UNA vez, así que no puede leer el zoom de este render.
     Lo que necesita al soltar vive acá y se reescribe en cada render: sin esto, el
     gesto calculaba siempre contra el primer zoom y el segundo pinch saltaba. */
  const alSoltar = useRef<(f: number) => void>(() => {});

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
  const zBase = zoomPara(metros, Math.min(ancho || 320, alto), centro.lat);
  const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zBase + zoomExtra));

  /* Se pide un zoom absoluto y se guarda como desvío del encuadre, con los topes
     aplicados antes de restar: así, al llegar al tope, el desvío deja de crecer y
     el botón no acumula toques invisibles que después hay que deshacer. */
  const irA = (objetivo: number) => setZoomExtra(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, objetivo)) - zBase);

  /* Dónde quedó el centro del recuadro. Se guarda en una referencia y no se calcula
     adentro del gesto porque el PanResponder se crea una sola vez y no ve los
     valores de este render. */
  const avisarCentro = useRef<() => void>(() => {});
  avisarCentro.current = () => {
    if (!onCentro) return;
    const p = aPixeles(centro.lat, centro.lng, z);
    onCentro(aCoords(p.x - mov.x, p.y - mov.y, z));
  };
  alSoltar.current = (f: number) => irA(Math.round(z + Math.log2(f)));

  const gestos = useRef(
    PanResponder.create({
      /* Nunca al TOCAR, sólo al mover: así un toque simple sigue llegando a los
         pines y no se traga el tap. */
      onStartShouldSetPanResponder: () => false,
      /*
       * Con dos dedos, zoom. Con uno, arrastrar — pero recién cuando el dedo se
       * movió más de 6 px.
       *
       * Ese umbral no es capricho: el mapa vive adentro de una pantalla que
       * scrollea, y sin él el mapa se quedaba con CUALQUIER roce, incluido el
       * comienzo de un scroll vertical. Con el umbral, un desliz que arranca sobre
       * el mapa alcanza a irse al ScrollView antes de que el mapa lo reclame.
       */
      onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.touches.length === 2
        || Math.hypot(g.dx, g.dy) > 6,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) { inicial.current = separacion(t); factor.current = 1; }
        else { arrastrando.current = true; movInicio.current = mov; }
      },
      onPanResponderMove: (e, g) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) {
          /* Pasó de arrastrar a pellizcar: se corta el arrastre para que el mapa no
             salga disparado mientras los dedos se acomodan. */
          arrastrando.current = false;
          if (!inicial.current) { inicial.current = separacion(t); factor.current = 1; return; }
          /* Acotado a un nivel para cada lado por gesto: sin tope, un pinch largo
             estira las teselas hasta que se ven los píxeles y el salto al soltar es
             tan grande que se pierde de vista dónde estaba. */
          factor.current = Math.max(0.5, Math.min(2, separacion(t) / inicial.current));
          escala.setValue(factor.current);
          return;
        }
        if (arrastrando.current) {
          setMov({ x: movInicio.current.x + g.dx, y: movInicio.current.y + g.dy });
        }
      },
      /* Terminate además de Release: si el sistema le saca el gesto (una llamada, el
         scroll de atrás), sin esto el mapa se quedaba estirado para siempre. */
      onPanResponderRelease: () => {
        if (inicial.current) alSoltar.current(factor.current);
        escala.setValue(1); inicial.current = 0; factor.current = 1; arrastrando.current = false;
        /* Al soltar se avisa dónde quedó el mapa. En el próximo cuadro: `setMov` del
           último movimiento todavía no se aplicó y avisar acá daría la posición
           anterior. */
        requestAnimationFrame(() => avisarCentro.current());
      },
      onPanResponderTerminate: () => {
        escala.setValue(1); inicial.current = 0; factor.current = 1; arrastrando.current = false;
      },
    }),
  ).current;

  const c = aPixeles(centro.lat, centro.lng, z);
  /* El desplazamiento se resta del origen: correr el dedo a la derecha equivale a
     mirar más a la izquierda del mundo. Todo lo demás —teselas, círculo, casa y
     pines— se calcula contra `origen`, así que se mueve solo. */
  const origen = { x: c.x - (ancho || 320) / 2 - mov.x, y: c.y - alto / 2 - mov.y };

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
      {/* Todo lo que es "el mapa" va acá adentro: se estira junto durante el pinch.
          El escalado de React Native es respecto del centro de la vista, y el centro
          de la vista ES el centro del mapa, así que acercarse no lo descoloca.
          Los botones y la atribución quedan afuera: no son mapa. */}
      <Animated.View
        {...gestos.panHandlers}
        style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, transform: [{ scale: escala }] }}
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
              /* El círculo marca el ÁREA QUE SE ESTÁ BUSCANDO, así que va siempre
                 en el centro del recuadro: al arrastrar, la búsqueda se mueve con
                 el mapa. La casa, en cambio, se queda donde vive (ver abajo). */
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
          <View style={{ position: 'absolute', left: (ancho || 320) / 2 + mov.x - 14, top: alto / 2 + mov.y - 14 }}>
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

      </Animated.View>

      {/* Volver al domicilio. Sólo aparece si el mapa se movió: un botón permanente
          que no hace nada es ruido, y acá además dice algo — que te fuiste. Sin
          esto, alejarse era un camino de ida: no hay forma de volver a tu casa con
          precisión arrastrando a ojo. */}
      {(mov.x !== 0 || mov.y !== 0) && (
        <TouchableOpacity
          onPress={() => setMov({ x: 0, y: 0 })}
          accessibilityRole="button"
          accessibilityLabel="Volver a mi domicilio"
          style={{ position: 'absolute', left: 8, top: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 100, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.94)', borderWidth: 1, borderColor: '#e6e3f0', paddingHorizontal: 11, paddingVertical: 7 }}
        >
          <Svg width={13} height={13} viewBox="0 0 24 24">
            <Path d="M3 10.5 12 3l9 7.5" fill="none" stroke={BRAND} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M5 9.5V20h14V9.5" fill="none" stroke={BRAND} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={{ fontSize: 12, fontWeight: '700', color: BRAND }}>Volver</Text>
        </TouchableOpacity>
      )}

      {/* Los botones. Arriba a la derecha porque abajo va la atribución y el centro
          lo ocupa el círculo del radio. Chicos a propósito: el mapa mide 230 de alto
          y en la web los botones se sacaron justamente por tapar un pin. */}
      <View style={{ position: 'absolute', right: 8, top: 8, borderRadius: 10, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: '#e6e3f0' }}>
        {([['+', 1], ['−', -1]] as const).map(([signo, paso], i) => {
          const tope = paso > 0 ? z >= ZOOM_MAX : z <= ZOOM_MIN;
          return (
            <TouchableOpacity
              key={signo}
              disabled={tope}
              onPress={() => irA(z + paso)}
              accessibilityRole="button"
              accessibilityLabel={paso > 0 ? 'Acercar el mapa' : 'Alejar el mapa'}
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderTopWidth: i === 1 ? 1 : 0, borderTopColor: '#e6e3f0', opacity: tope ? 0.35 : 1 }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: BRAND, lineHeight: 21 }}>{signo}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* La atribución, obligatoria. */}
      <View style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', paddingHorizontal: 6, paddingVertical: 1, borderTopLeftRadius: 8 }}>
        <Text style={{ fontSize: 9.5, color: MUTED }}>© OpenStreetMap © CARTO</Text>
      </View>
    </View>
  );
}
