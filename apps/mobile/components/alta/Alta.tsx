import { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';
import {
  borradorVacio, cuotaMensual, data, pasoOk, payloadAlta, colors, type BorradorAlta,
} from '@kumo/shared';
import { supabase } from '../../lib/supabase';
import { postAlta } from '../../lib/api';
import type { FotoElegida } from '../../lib/subirFoto';
import { Texto as Text, BRAND, INK, LIME, MUTED } from '../ui/Texto';
import Paso1Mascota from './Paso1Mascota';
import Paso2Socio from './Paso2Socio';
import Paso3Plan, { type PlanAlta } from './Paso3Plan';
import Paso4Declaracion from './Paso4Declaracion';
import Paso5Pago from './Paso5Pago';

/**
 * El alta de socio en la app, los mismos 5 pasos que la web.
 *
 * Todo lo que decide (qué es válido, cómo se arma el pedido) vive en
 * `@kumo/shared/alta`, y el alta la crea la MISMA ruta que usa la web
 * (`/api/onboarding`): acá no hay reglas de negocio propias, solo pantallas.
 *
 * Dos modos, como en la web:
 *  · con contraseña — no hay sesión todavía; la crea el pedido y se entra al final.
 *  · con Google (`identidad`) — la sesión ya está, falta el perfil. No se pide
 *    contraseña y el mail no se puede editar: el servidor lo lee de la sesión.
 */
export default function Alta({
  identidad, onSalir, onListo,
}: {
  identidad?: { nombre: string; email: string } | null;
  onSalir: () => void;
  onListo: () => void;
}) {
  const conGoogle = !!identidad;
  const [paso, setPaso] = useState(1);
  const [b, setB] = useState<BorradorAlta>(() => borradorVacio({ nombre: identidad?.nombre, email: identidad?.email }));
  const [foto, setFoto] = useState<FotoElegida | null>(null);
  const [planes, setPlanes] = useState<PlanAlta[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState<{ memberNo: number; avisoFoto: string | null } | null>(null);

  /*
   * Los planes se leen sin sesión: la política de `plans` es de lectura pública
   * (la landing los muestra antes de que nadie entre). Si la consulta falla, van
   * los de `@kumo/shared/data` como respaldo — es lo que hace la web — para que un
   * problema de red no deje el alta sin planes que elegir.
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

  const puedeSeguir = pasoOk(paso, b, conGoogle);
  const cuota = cuotaMensual(planes.find((p) => p.name === b.plan)?.basePrice ?? 0, b.odonto);

  const confirmar = async () => {
    setEnviando(true);
    setError('');
    const r = await postAlta(payloadAlta(b), foto);
    if (!r.ok) {
      /*
       * Si el alta ya existía es casi seguro un doble toque: el primer pedido la
       * creó y el segundo choca. Antes de mostrar un error sobre un alta que salió
       * bien, se prueba entrar con lo que la persona tipeó.
       */
      if (/ya existe/i.test(r.error) && !conGoogle) {
        const { error: e } = await supabase.auth.signInWithPassword({ email: b.socio.email, password: b.socio.password });
        if (!e) { onListo(); return; }
      }
      setError(r.error);
      setEnviando(false);
      return;
    }
    setListo({ memberNo: r.memberNo, avisoFoto: r.avisoFoto });
    setEnviando(false);
  };

  /*
   * El login va acá y no al recibir la respuesta: en cuanto hay sesión, la app
   * cambia de pantalla y esta se desmonta, así que la bienvenida no se vería nunca.
   */
  const entrar = async () => {
    if (!conGoogle) {
      await supabase.auth.signInWithPassword({ email: b.socio.email, password: b.socio.password });
    }
    onListo();
  };

  if (listo) {
    return (
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60, flexGrow: 1, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <View style={{ width: 66, height: 66, borderRadius: 33, backgroundColor: LIME, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 30, color: INK, fontWeight: '800' }}>✓</Text>
          </View>
          <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, textAlign: 'center' }}>¡Bienvenido al club!</Text>
          <Text style={{ fontSize: 14.5, color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 21 }}>
            Ya sos {listo.memberNo ? `el socio #${listo.memberNo}` : 'socio'} de Kumo. Tu carnet digital de {b.pet.nombre} está listo.
          </Text>
        </View>

        <View style={{ backgroundColor: BRAND, borderRadius: 18, padding: 20, marginTop: 22 }}>
          <Text style={{ color: '#c9c3e3', fontSize: 12, fontWeight: '700' }}>PLAN {b.plan}</Text>
          <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: '#fff', marginTop: 2 }}>{b.pet.nombre}</Text>
          <Text style={{ color: '#c9c3e3', fontSize: 13, marginTop: 6 }}>
            Cuota mensual ${cuota.toLocaleString('es-AR')}{b.odonto ? ' · con cobertura odontológica' : ''}
          </Text>
        </View>

        {listo.avisoFoto ? (
          <View style={{ backgroundColor: 'rgb(251,243,226)', borderRadius: 12, padding: 14, marginTop: 16 }}>
            <Text style={{ fontSize: 13, color: 'rgb(146,105,10)', lineHeight: 19 }}>
              {listo.avisoFoto} La podés cargar cuando quieras desde el carnet de {b.pet.nombre}.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={entrar}
          style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Entrar a la app</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Encabezado: volver y en qué paso va. */}
      <View style={{ paddingHorizontal: 20, paddingTop: 44, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.violet[50], flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <TouchableOpacity onPress={() => (paso > 1 ? setPaso(paso - 1) : onSalir())} style={{ paddingVertical: 6, paddingRight: 6 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: BRAND }}>← {paso > 1 ? 'Atrás' : 'Salir'}</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12.5, color: MUTED, flex: 1 }}>Paso {paso} de 5</Text>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 18, color: BRAND }}>Kumo</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingTop: 10 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <View key={n} style={{ flex: 1, height: 4, borderRadius: 100, backgroundColor: n <= paso ? BRAND : colors.violet[100] }} />
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {paso === 1 ? <Paso1Mascota pet={b.pet} onCambio={(pet) => setB({ ...b, pet })} foto={foto} onFoto={setFoto} /> : null}
        {paso === 2 ? <Paso2Socio socio={b.socio} onCambio={(socio) => setB({ ...b, socio })} conGoogle={conGoogle} /> : null}
        {paso === 3 ? <Paso3Plan planes={planes} elegido={b.plan} odonto={b.odonto} onPlan={(plan) => setB({ ...b, plan })} onOdonto={(odonto) => setB({ ...b, odonto })} /> : null}
        {paso === 4 ? <Paso4Declaracion declaracion={b.declaracion} onCambio={(declaracion) => setB({ ...b, declaracion })} nombreMascota={b.pet.nombre} /> : null}
        {paso === 5 ? <Paso5Pago pago={b.pago} onCambio={(pago) => setB({ ...b, pago })} plan={b.plan} cuota={cuota} /> : null}

        {error ? (
          <View style={{ backgroundColor: colors.danger.bg, borderRadius: 12, padding: 14, marginTop: 8 }}>
            <Text style={{ fontSize: 13, color: colors.danger.fg, fontWeight: '600', lineHeight: 19 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          onPress={() => (paso < 5 ? setPaso(paso + 1) : confirmar())}
          disabled={!puedeSeguir || enviando}
          style={{ backgroundColor: BRAND, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, opacity: !puedeSeguir || enviando ? 0.45 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {enviando ? 'Creando tu cuenta…' : paso < 5 ? 'Continuar' : 'Confirmar y unirme'}
          </Text>
        </TouchableOpacity>
        {!puedeSeguir ? (
          <Text style={{ fontSize: 12.5, color: MUTED, textAlign: 'center', marginTop: 10 }}>Completá los datos para continuar.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
