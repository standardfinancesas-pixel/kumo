import { useEffect, useState, useRef } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import {
  borradorVacio, conIdentidad, mascotaVacia, cuotaMensual, data, pasoOk, pasosDelAlta, payloadAlta,
  esGratis, planElegido, colors, motivoFotosDelAltaPesan, type BorradorAlta, type MascotaBorrador,
} from '@kumo/shared';
import { supabase } from '../../lib/supabase';
import { postAlta } from '../../lib/api';
import type { FotoElegida } from '../../lib/subirFoto';
import { Texto as Text, BRAND, MUTED } from '../ui/Texto';
import PasoMascotas from './PasoMascotas';
import Paso2Socio from './Paso2Socio';
import Paso3Plan, { type PlanAlta } from './Paso3Plan';
import Paso4Declaracion from './Paso4Declaracion';
import Paso5Cuota from './Paso5Cuota';

/**
 * El alta de socio en la app: los mismos pasos que la web.
 *
 * Son 4 o 5 según lo que elija — el del pago solo existe si eligió un plan, porque
 * entrar a Kumo es gratis. Todo lo que decide (qué es válido, cuántos pasos hay, cómo
 * se arma el pedido) vive en `@kumo/shared/alta`, y el alta la crea la MISMA ruta que
 * usa la web: acá no hay reglas de negocio propias, solo pantallas.
 *
 * Dos modos:
 *  · con contraseña — no hay sesión todavía; la crea el pedido.
 *  · con Google (`identidad`) — la sesión ya está, falta el perfil.
 *
 * `onListo` avisa a `App.tsx`, que es quien dibuja la pantalla final: si la mostrara
 * este componente, abrir la sesión lo desmontaría justo antes de que se vea.
 */
export default function Alta({
  identidad, onSalir, onListo,
}: {
  identidad?: { nombre: string; email: string } | null;
  onSalir: () => void;
  onListo: (r: { memberNo: number; avisoFoto: string | null; pagar: { plan: string; odonto: boolean } | null }) => void;
}) {
  const conGoogle = !!identidad;
  const [paso, setPaso] = useState(1);

  /*
   * Al cambiar de paso, el scroll vuelve arriba.
   *
   * Los cinco pasos comparten el MISMO ScrollView, así que la posición quedaba
   * donde el paso anterior la dejó: se tocaba "Continuar" al final de "Tus datos"
   * y los planes aparecían empezados por la mitad, con el título afuera. Cada
   * paso es una pantalla nueva y tiene que arrancar desde el título.
   */
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ y: 0, animated: false }); }, [paso]);
  const [b, setB] = useState<BorradorAlta>(() => borradorVacio({ nombre: identidad?.nombre, email: identidad?.email }));
  /* Igual que en la web: la identidad de Google puede llegar después del montaje,
     y el inicializador de `useState` corre una sola vez. Acá el orden hoy ayuda (la
     sesión se resuelve antes que el perfil), pero depender de ese orden es frágil. */
  useEffect(() => { setB((prev) => conIdentidad(prev, identidad)); }, [identidad]);
  const [fotos, setFotos] = useState<Record<string, FotoElegida>>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [planes, setPlanes] = useState<PlanAlta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');

  /*
   * Los planes se leen sin sesión: la política de `plans` es de lectura pública (la
   * landing los muestra antes de que nadie entre). Si la consulta falla, van los de
   * `@kumo/shared/data` como respaldo —es lo que hace la web— para que un problema de
   * red no deje el alta sin planes que elegir.
   */
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data: filas } = await supabase
        .from('plans')
        .select('id, name, base_price, tagline, perks, featured')
        .order('base_price', { ascending: true });
      if (!vivo) return;
      if (filas?.length) {
        setPlanes(filas.map((f) => ({
          id: String(f.id), name: String(f.name), basePrice: Number(f.base_price),
          tagline: String(f.tagline ?? ''), perks: (f.perks as string[] | null) ?? [], featured: f.featured === true,
        })));
      } else {
        setPlanes(data.plans.map((p) => ({
          id: p.id, name: p.name, basePrice: p.basePrice, tagline: p.tagline ?? '', perks: p.perks ?? [], featured: !!p.featured,
        })));
      }
    })();
    return () => { vivo = false; };
  }, []);

  const total = pasosDelAlta(b);
  const puedeSeguir = pasoOk(paso, b, conGoogle);
  const gratis = esGratis(b.eleccion);
  const plan = planElegido(b.eleccion);
  const cuota = cuotaMensual(planes.find((p) => p.name === plan)?.basePrice ?? 0, b.odonto);

  const setMascota = (uid: string, parte: Partial<MascotaBorrador>) =>
    setB((x) => ({ ...x, mascotas: x.mascotas.map((m) => (m.uid === uid ? { ...m, ...parte } : m)) }));

  const agregarMascota = () => {
    const nueva = mascotaVacia();
    setB((x) => ({ ...x, mascotas: [...x.mascotas, nueva] }));
    setAbierta(nueva.uid);
  };

  const quitarMascota = (uid: string) => {
    setB((x) => ({ ...x, mascotas: x.mascotas.filter((m) => m.uid !== uid) }));
    setFotos((f) => { const { [uid]: _fuera, ...resto } = f; return resto; });
  };

  const confirmar = async () => {
    /*
     * Las fotos van todas en el MISMO pedido, así que lo que importa es la suma.
     *
     * Vercel rechaza los cuerpos de más de 4,5 MB antes de ejecutar la función:
     * no queda log y acá se ve como un error de conexión. Un tester quedó
     * trabado en este paso leyendo "revisá tu conexión" con la conexión
     * perfecta. Se corta antes y se dice qué hacer.
     */
    const elegidas = b.mascotas.map((m) => fotos[m.uid]).filter(Boolean) as FotoElegida[];
    const pesan = motivoFotosDelAltaPesan(elegidas.reduce((t, f) => t + (f.bytes || 0), 0), elegidas.length);
    if (pesan) { setError(pesan); return; }

    setEnviando(true);
    setError('');
    const r = await postAlta(payloadAlta(b), b.mascotas.map((m) => fotos[m.uid]));
    if (!r.ok) {
      /*
       * Si el alta ya existía es casi seguro un doble toque: el primer pedido la
       * creó y el segundo choca. Antes de mostrar un error sobre un alta que salió
       * bien, se prueba entrar con lo que la persona tipeó.
       */
      if (/ya existe/i.test(r.error) && !conGoogle) {
        const { error: e } = await supabase.auth.signInWithPassword({ email: b.socio.email, password: b.socio.password });
        if (!e) { onListo({ memberNo: 0, avisoFoto: null, pagar: plan ? { plan, odonto: b.odonto } : null }); return; }
      }
      setError(r.error);
      setEnviando(false);
      return;
    }

    /*
     * La sesión se abre ACÁ y no en la pantalla final: para pagar hace falta el
     * token, y la pantalla final la dibuja `App.tsx` justo porque abrir la sesión
     * desmonta este árbol.
     */
    if (!conGoogle) {
      await supabase.auth.signInWithPassword({ email: b.socio.email, password: b.socio.password });
    }
    onListo({
      memberNo: r.memberNo,
      avisoFoto: r.avisoFoto,
      pagar: plan ? { plan, odonto: b.odonto } : null,
    });
  };

  const tituloCTA = paso === 4 ? 'Firmar y continuar' : paso === total ? (gratis ? 'Confirmar y unirme' : 'Confirmar y pagar') : 'Continuar';

  return (
    <View style={{ flex: 1 }}>
      {/* Encabezado: volver y en qué paso va. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 44, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.violet[50], flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => (paso > 1 ? setPaso(paso - 1) : onSalir())} style={{ paddingVertical: 6, paddingRight: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND }}>← {paso > 1 ? 'Atrás' : 'Salir'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12.5, color: MUTED, flex: 1 }}>Paso {paso} de {total}</Text>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 18, color: BRAND }}>Kumo</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingTop: 10 }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 100, backgroundColor: n <= paso ? BRAND : colors.violet[100] }} />
        ))}
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {paso === 1 ? (
          <PasoMascotas
            mascotas={b.mascotas}
            fotos={fotos}
            onCambio={(uid, datos) => setMascota(uid, { datos })}
            onFoto={(uid, f) => setFotos((x) => ({ ...x, [uid]: f }))}
            onAgregar={agregarMascota}
            onQuitar={quitarMascota}
          />
        ) : null}
        {paso === 2 ? <Paso2Socio socio={b.socio} onCambio={(socio) => setB({ ...b, socio })} conGoogle={conGoogle} /> : null}
        {paso === 3 ? (
          <Paso3Plan
            planes={planes}
            eleccion={b.eleccion}
            odonto={b.odonto}
            onEleccion={(eleccion) => setB({ ...b, eleccion, odonto: eleccion.modo === 'gratis' ? false : b.odonto })}
            onOdonto={(odonto) => setB({ ...b, odonto })}
          />
        ) : null}
        {paso === 4 ? (
          <Paso4Declaracion
            mascotas={b.mascotas}
            firma={b.firma}
            acepta={b.acepta}
            abierta={abierta}
            onAbrir={setAbierta}
            onCambioMascota={(uid, parte) => setMascota(uid, parte)}
            onFirma={(firma) => setB({ ...b, firma })}
            onAcepta={(acepta) => setB({ ...b, acepta })}
          />
        ) : null}
        {paso === 5 && b.eleccion?.modo === 'pago' ? (
          <Paso5Cuota plan={b.eleccion.plan} odonto={b.odonto} cuota={cuota} />
        ) : null}

        {error ? (
          <View style={{ backgroundColor: colors.danger.bg, borderRadius: 12, padding: 14, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: colors.danger.fg, fontWeight: '600', lineHeight: 19 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => (paso < total ? setPaso(paso + 1) : confirmar())}
          disabled={!puedeSeguir || enviando}
          style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, opacity: !puedeSeguir || enviando ? 0.45 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{enviando ? 'Creando tu cuenta…' : tituloCTA}</Text>
        </TouchableOpacity>
        {!puedeSeguir ? (
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 10 }}>Completá los datos para continuar.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
