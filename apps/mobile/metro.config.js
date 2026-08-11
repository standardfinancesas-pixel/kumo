// Metro config para monorepo pnpm.
//
// El .npmrc NO usa node-linker=hoisted (rompe el build de producción de Next 15,
// ver el comentario ahí), así que node_modules es el layout isolated de pnpm:
// cada paquete es un symlink a .pnpm/<paquete>/node_modules/<paquete> y sus
// dependencias viven al lado, dentro de esa carpeta de .pnpm.
//
// Para que Metro resuelva eso necesita dos cosas:
//   - seguir symlinks (unstable_enableSymlinks)
//   - poder subir por el árbol desde el archivo que hace el require, así un
//     paquete dentro de .pnpm encuentra sus propias deps (por eso
//     disableHierarchicalLookup queda en false; con true, Expo no encuentra
//     expo-modules-core)
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
// Sin nodeModulesPaths a propósito: si se fija la lista, Metro busca SOLO ahí y
// un paquete que vive en .pnpm no encuentra sus propias dependencias (fallaba
// con @react-native/assets-registry). Dejándolo al lookup jerárquico, cada
// archivo resuelve subiendo desde su propia carpeta, que es como está armado
// el layout isolated de pnpm.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = false;
module.exports = config;
