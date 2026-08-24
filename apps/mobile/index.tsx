import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import App from './App';

/*
 * El SafeAreaProvider va acá y no adentro de App para no envolver las ~140
 * líneas del árbol de App en un nivel más de indentación.
 *
 * Hace falta desde el SDK 57: Android dibuja edge-to-edge de forma obligatoria
 * (la app ocupa toda la pantalla, incluida la franja de la barra de estado y la
 * de navegación) y el SafeAreaView de react-native quedó deprecado justamente
 * porque en Android nunca reservó nada. El de react-native-safe-area-context sí,
 * en las dos plataformas, pero necesita este provider arriba para medir.
 */
function Root() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
