import { TouchableOpacity, View } from 'react-native';
import { colors, cbuValido, marcaTarjeta, formatDni, type PagoAlta } from '@kumo/shared';
import { Texto as Text, BRAND, INK, LIME, MUTED } from '../ui/Texto';
import { Campo, Punto, Tilde } from '../ui/Controles';

const plata = (n: number) => '$' + n.toLocaleString('es-AR');

const METODOS: { key: 'tarjeta' | 'cbu'; label: string }[] = [
  { key: 'tarjeta', label: 'Tarjeta de crédito/débito' },
  { key: 'cbu', label: 'Débito por CBU/CVU' },
];

/**
 * Paso 5 · Cómo paga y a dónde le transferimos.
 *
 * Se validan SOLO los campos de la forma elegida (la regla vive en `pagoOk` de
 * `@kumo/shared`). En la web esto estaba mal y era un bug con consecuencia
 * comercial: validaba siempre la tarjeta, así que quien elegía CBU se quedaba con
 * el botón bloqueado para siempre y el alta no se podía terminar.
 *
 * De la tarjeta no sale de acá ni el número completo ni el código de seguridad:
 * viajan solo la marca, los últimos cuatro y el vencimiento. El número completo
 * metería al servidor en el alcance de PCI DSS aunque no se guardara.
 *
 * El CBU es además la cuenta donde el club le transfiere los reintegros, y por eso
 * se pide el DNI del titular: sin ese dato el club termina pidiéndolo por WhatsApp.
 */
export default function Paso5Pago({
  pago, onCambio, plan, cuota,
}: { pago: PagoAlta; onCambio: (p: PagoAlta) => void; plan: string | null; cuota: number }) {
  const set = (parte: Partial<PagoAlta>) => onCambio({ ...pago, ...parte });
  const setBanco = (parte: Partial<PagoAlta['banco']>) => onCambio({ ...pago, banco: { ...pago.banco, ...parte } });

  const digitosCbu = pago.banco.cbu.replace(/\D/g, '').length;
  const marca = pago.numero.replace(/\D/g, '').length >= 4 ? marcaTarjeta(pago.numero) : null;

  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Medio de pago</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Tu cuota incluye IVA. Sin permanencia.</Text>

      <View style={{ backgroundColor: BRAND, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View>
          <Text style={{ color: '#c9c3e3', fontSize: 13 }}>Plan {plan ?? '—'}</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cuota mensual</Text>
        </View>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: LIME }}>{plata(cuota)}</Text>
      </View>

      <View style={{ gap: 10, marginBottom: 16 }}>
        {METODOS.map((m) => {
          const on = pago.metodo === m.key;
          return (
            <TouchableOpacity
              key={m.key}
              onPress={() => set({ metodo: m.key })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, borderColor: on ? BRAND : colors.violet[200], backgroundColor: on ? colors.violet[50] : '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14 }}
            >
              <Text style={{ flex: 1, fontWeight: '600', fontSize: 14.5, color: INK }}>{m.label}</Text>
              <Punto on={on} />
            </TouchableOpacity>
          );
        })}
      </View>

      {pago.metodo === 'tarjeta' ? (
        <View>
          <Campo
            label="Número de tarjeta" valor={pago.numero} onCambio={(t) => set({ numero: t })}
            placeholder="0000 0000 0000 0000" keyboardType="numeric"
            ayuda={marca ? `Detectamos una ${marca}.` : undefined}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Campo label="Vencimiento" valor={pago.exp} onCambio={(t) => set({ exp: t })} placeholder="MM/AA" keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo label="CVV" valor={pago.cvv} onCambio={(t) => set({ cvv: t })} placeholder="123" keyboardType="numeric" secureTextEntry />
            </View>
          </View>
          <Campo label="Titular de la tarjeta" valor={pago.titular} onCambio={(t) => set({ titular: t })} placeholder="Como figura en la tarjeta" autoCapitalize="words" />
          <Text style={{ fontSize: 12, color: MUTED, lineHeight: 18, marginBottom: 14 }}>
            De la tarjeta guardamos solo la marca, los últimos 4 dígitos y el vencimiento, para que puedas identificarla. El número completo y el código de seguridad no se almacenan.
          </Text>
        </View>
      ) : (
        <View>
          <Campo
            label="CBU o CVU" valor={pago.banco.cbu} onCambio={(t) => setBanco({ cbu: t })}
            mal={digitosCbu > 0 && !cbuValido(pago.banco.cbu)} placeholder="22 dígitos" keyboardType="numeric"
            ayuda={digitosCbu > 0 && !cbuValido(pago.banco.cbu) ? `Tiene 22 dígitos y pusiste ${digitosCbu}.` : undefined}
          />
          <Campo label="Alias (opcional)" valor={pago.banco.alias} onCambio={(t) => setBanco({ alias: t })} placeholder="mi.alias.banco" autoCapitalize="none" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Campo label="Banco" valor={pago.banco.bank} onCambio={(t) => setBanco({ bank: t })} placeholder="Ej. Galicia" />
            </View>
            <View style={{ flex: 1 }}>
              <Campo label="CUIT / CUIL" valor={pago.banco.cuit} onCambio={(t) => setBanco({ cuit: t })} placeholder="20-00000000-0" keyboardType="numeric" />
            </View>
          </View>
          <Campo label="Titular de la cuenta" valor={pago.banco.holder} onCambio={(t) => setBanco({ holder: t })} placeholder="Nombre y apellido" autoCapitalize="words" />
          <Campo label="DNI del titular" valor={pago.banco.holderDni} onCambio={(t) => setBanco({ holderDni: formatDni(t) })} placeholder="00.000.000" keyboardType="numeric" />
          <Text style={{ fontSize: 12, color: MUTED, lineHeight: 18, marginBottom: 14 }}>
            Es también la cuenta donde te vamos a transferir los reintegros, así no te la pedimos de nuevo en cada solicitud.
          </Text>
        </View>
      )}

      <Tilde marcado={pago.aceptaCuota} onCambio={(v) => set({ aceptaCuota: v })}>
        Acepto que la cuota se actualiza cada 3 meses según IPC y los plazos de carencia (60/90/180 días). Tengo 10 días de arrepentimiento.
      </Tilde>
    </View>
  );
}
