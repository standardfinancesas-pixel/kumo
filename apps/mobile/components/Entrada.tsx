import { useState } from 'react';
import { View } from 'react-native';
import Login from './Login';
import RecuperarClave from './RecuperarClave';
import Alta from './alta/Alta';

/**
 * Lo que se ve sin sesión: ingresar, darse de alta o recuperar la contraseña.
 *
 * Es un `switch` y no un router: la app no tiene Expo Router (la navegación es un
 * estado en `App.tsx`) y meter uno solo para tres pantallas sin sesión sería sumar
 * una dependencia grande para reemplazar diez líneas.
 */
export type VistaEntrada = 'login' | 'alta' | 'recuperar';

export default function Entrada({ inicial = 'login' }: { inicial?: VistaEntrada }) {
  const [vista, setVista] = useState<VistaEntrada>(inicial);

  return (
    <View style={{ flex: 1 }}>
      {vista === 'login' ? (
        <Login onAlta={() => setVista('alta')} onRecuperar={() => setVista('recuperar')} />
      ) : null}
      {vista === 'recuperar' ? <RecuperarClave onVolver={() => setVista('login')} /> : null}
      {vista === 'alta' ? (
        /*
         * `onListo` no cambia de pantalla: al terminar el alta la app entra, y el
         * cambio de sesión desmonta todo esto solo. Volver a `login` acá sería
         * pelearle a `onAuthStateChange`.
         */
        <Alta onSalir={() => setVista('login')} onListo={() => setVista('login')} />
      ) : null}
    </View>
  );
}
