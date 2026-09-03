import { View } from 'react-native';
import type { selloCarnet } from '@kumo/shared';
import { colors } from '@kumo/shared';
import { Texto as Text, INK, LIME, BRAND } from './Texto';

/** Lo que devuelve `selloCarnet`, tomado de ahí y no copiado: si el helper suma un
 *  tono, este componente se rompe en el typecheck en vez de pintarlo mal. */
type Sello = ReturnType<typeof selloCarnet>;

/**
 * El sello del carnet: ACTIVO · GRATUITO · ACTIVANDO · CUOTA VENCIDA.
 *
 * Existe porque estaba escrito a mano en dos lugares y en uno de ellos decía
 * "ACTIVO" fijo: la tarjeta de la mascota mostraba ACTIVO **incluso a un socio
 * gratuito**, mientras la webapp —que sí usa `selloCarnet`— decía GRATUITO. O sea
 * que la misma cuenta se leía distinta en cada superficie, y la que mentía era la
 * app. El texto y el tono los decide `selloCarnet` de @kumo/shared, que es la única
 * fuente: acá solo se pintan.
 *
 * Los tonos son los mismos que el `SelloCarnet` de la web.
 *
 * EL NEUTRO ERA BLANCO AL 18%, y ese era el problema: se pensó para apoyarse sobre
 * el violeta de la tarjeta, pero el sello quedó montado sobre el BORDE DE LA FOTO
 * de la mascota. Sobre una foto clara, un fondo casi transparente con letra blanca
 * no se lee — y es justo el tono que le toca al socio que NO está activo, o sea
 * quien más necesita entender qué dice ahí. Ahora es una píldora clara con letra
 * violeta, como la de alerta pero sin la carga de la alerta: se lee sobre la foto,
 * sobre el violeta y sobre lo que venga.
 */
export function SelloCarnet({ sello }: { sello: Sello }) {
  const fondo = sello.tono === 'ok' ? LIME : sello.tono === 'alerta' ? '#fbe8ef' : colors.violet[100];
  const tinta = sello.tono === 'ok' ? INK : sello.tono === 'alerta' ? '#c14d7a' : BRAND;
  return (
    /* En una sola línea SIEMPRE: "CUOTA PENDIENTE" es más ancho que la foto del
       carnet y se partía en dos renglones, saliéndose de la píldora. La webapp no
       lo sufre porque su equivalente ya usa `white-space: nowrap`. */
    <View style={{ backgroundColor: fondo, borderRadius: 100, paddingVertical: 4, paddingHorizontal: 9 }}>
      <Text numberOfLines={1} style={{ color: tinta, fontWeight: '800', fontSize: 10 }}>{sello.texto}</Text>
    </View>
  );
}
