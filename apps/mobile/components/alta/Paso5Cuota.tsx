import { View } from 'react-native';
import { colors } from '@kumo/shared';
import { Texto as Text, INK, LIME, MUTED, BRAND } from '../ui/Texto';
import { Tilde } from '../ui/Controles';

const plata = (n: number) => '$' + n.toLocaleString('es-AR');

/**
 * Paso 5 · La cuota. Solo existe si eligió un plan.
 *
 * Ya no se piden ni la tarjeta ni el CBU:
 *
 *  · La tarjeta se tipea en el sitio de Mercado Pago, así que no pasa por Kumo y no
 *    hay nada que podamos filtrar ni obligaciones de PCI DSS que cumplir.
 *  · El CBU era para los REINTEGROS, no para cobrar la cuota. Se pide al cargar el
 *    primer reintegro, que es cuando recién hace falta — y ahí el formulario ya lo
 *    guarda en el perfil para no volver a pedirlo.
 *
 * Lo único que queda es aceptar las condiciones.
 */
export default function Paso5Cuota({
  plan, odonto, cuota, acepta, onAcepta,
}: {
  plan: string;
  odonto: boolean;
  cuota: number;
  acepta: boolean;
  onAcepta: (v: boolean) => void;
}) {
  return (
    <View>
      <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 26, color: INK, marginBottom: 4 }}>Tu cuota</Text>
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 18 }}>Incluye IVA. Sin permanencia.</Text>

      <View style={{ backgroundColor: BRAND, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <View>
          <Text style={{ color: '#c9c3e3', fontSize: 13 }}>Plan {plan}{odonto ? ' + odontológica' : ''}</Text>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cuota mensual</Text>
        </View>
        <Text style={{ fontFamily: 'Baloo2_800ExtraBold', fontSize: 24, color: LIME }}>{plata(cuota)}</Text>
      </View>

      <View style={{ backgroundColor: '#f7f6fa', borderWidth: 1, borderColor: colors.violet[50], borderRadius: 14, padding: 16, marginBottom: 16 }}>
        <Text style={{ fontWeight: '700', fontSize: 14.5, color: INK, marginBottom: 6 }}>Vas a pagar con Mercado Pago</Text>
        <Text style={{ fontSize: 13, color: '#5b5670', lineHeight: 19 }}>
          Al confirmar te llevamos a Mercado Pago para autorizar el débito automático. Los datos de tu
          tarjeta no pasan por Kumo, y podés darlo de baja cuando quieras desde Mi perfil.
        </Text>
      </View>

      <Tilde marcado={acepta} onCambio={onAcepta}>
        Acepto que la cuota se actualiza cada 3 meses según IPC y los plazos de carencia (60/90/180 días). Tengo 10 días de arrepentimiento.
      </Tilde>
    </View>
  );
}
