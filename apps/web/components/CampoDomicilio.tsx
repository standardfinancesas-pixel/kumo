'use client';
import type { CSSProperties, ReactNode } from 'react';

import { useEffect, useRef, useState } from 'react';

/**
 * Los campos de lugar, con los datos reales del callejero argentino.
 *
 * Dos campos, porque son dos preguntas distintas:
 *
 *  · **`CampoDomicilio`** busca DIRECCIONES (calle y altura). Al elegir de la lista
 *    llena domicilio, localidad y provincia de una vez y ya normalizados. Eso es lo
 *    que arregla el problema de fondo: los domicilios cargados eran "luis maria
 *    campos 405, 1", "caba" y "mendoza", y de ahí salieron todas las reglas de
 *    limpieza del geocodificador.
 *  · **`CampoZona`** busca LOCALIDADES Y BARRIOS, que es lo que va en un campo de
 *    zona ("Palermo", "Tandil"). Además del tipeo arregla un problema silencioso: las
 *    listas de prestadores y de la comunidad filtran por zona comparando texto, así
 *    que "Palermo", "palermo" y "Palermo, CABA" eran tres zonas distintas.
 *
 * **Los dos siguen siendo texto libre.** El callejero no tiene todo —countries,
 * barrios nuevos, "km 12 de la ruta 9", "Zona Sur GBA"— y nadie puede quedarse sin
 * poder darse de alta porque su casa no figure en una base. La lista sugiere; no
 * obliga.
 *
 * La búsqueda va contra `/api/lugares`, que es un pasamanos con caché: así el
 * domicilio de alguien no viaja desde su navegador a un tercero.
 */
export type LugarElegido = { domicilio: string; localidad: string; provincia: string };
export type ZonaElegida = { zona: string; localidad: string; provincia: string };
type Fila = { id: string; etiqueta: string };

/** Cuánto se espera después de la última tecla. 350 ms es el tiempo en el que una
 *  persona termina de escribir una palabra: con menos, se consulta por cada letra. */
const ESPERA_MS = 350;

/**
 * La búsqueda con debounce, compartida por los dos campos.
 *
 * `elegido` guarda lo último que se eligió de la lista para que al elegir no se
 * dispare una búsqueda nueva con ese mismo texto y la lista vuelva a abrirse sola.
 */
function useSugerencias<T extends Fila>(valor: string, tipo: 'direccion' | 'localidad', provincia?: string) {
  const [sugerencias, setSugerencias] = useState<T[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(-1);
  const elegido = useRef<string | null>(null);
  const minimo = tipo === 'localidad' ? 3 : 4;

  useEffect(() => {
    const texto = valor.trim();
    if (texto === elegido.current) return;
    if (texto.length < minimo) { setSugerencias([]); setAbierto(false); return; }

    const corte = new AbortController();
    const reloj = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: texto });
        if (tipo === 'localidad') params.set('tipo', 'localidad');
        if (provincia) params.set('provincia', provincia);
        const r = await fetch(`/api/lugares?${params}`, { signal: corte.signal });
        if (!r.ok) return;
        const { sugerencias: lista } = (await r.json()) as { sugerencias: T[] };
        setSugerencias(lista);
        setMarcada(-1);
        setAbierto(lista.length > 0);
      } catch {
        // Pedido cancelado o red caída: el campo sigue funcionando como texto.
      }
    }, ESPERA_MS);

    return () => { clearTimeout(reloj); corte.abort(); };
  }, [valor, provincia, tipo, minimo]);

  const cerrar = (textoElegido?: string) => {
    if (textoElegido !== undefined) elegido.current = textoElegido;
    setAbierto(false);
    setSugerencias([]);
  };

  return { sugerencias, abierto, setAbierto, marcada, setMarcada, cerrar };
}

/** El input con su lista, sin saber qué se está buscando. */
function CampoConLista<T extends Fila>({
  valor, onCambio, onElegir, sugerencias, abierto, setAbierto, marcada, setMarcada, id, placeholder, style,
}: {
  valor: string;
  onCambio: (t: string) => void;
  onElegir: (fila: T) => void;
  sugerencias: T[];
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  marcada: number;
  setMarcada: (n: number) => void;
  id?: string;
  placeholder?: string;
  style?: CSSProperties;
}): ReactNode {
  const caja = useRef<HTMLDivElement | null>(null);

  /* Cerrar al tocar afuera. No se usa `onBlur` del input porque el blur llega antes
     del click en la sugerencia y la lista se cerraba sin haber elegido nada. */
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, [abierto, setAbierto]);

  const teclas = (e: React.KeyboardEvent) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcada((marcada + 1) % sugerencias.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcada(marcada <= 0 ? sugerencias.length - 1 : marcada - 1); }
    else if (e.key === 'Enter' && marcada >= 0) { e.preventDefault(); onElegir(sugerencias[marcada]!); }
    else if (e.key === 'Escape') { setAbierto(false); }
  };

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <input
        id={id}
        // El autocompletado del navegador molesta acá: tapa la lista con su propio
        // desplegable de direcciones guardadas.
        autoComplete="off"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        onKeyDown={teclas}
        onFocus={() => { if (sugerencias.length) setAbierto(true); }}
        placeholder={placeholder}
        style={style}
      />
      {abierto && (
        <ul
          role="listbox"
          style={{
            position: 'absolute', zIndex: 30, left: 0, right: 0, top: 'calc(100% + 4px)',
            listStyle: 'none', margin: 0, padding: 4, maxHeight: 208, overflowY: 'auto',
            background: '#fff', border: '1px solid rgb(230,227,240)', borderRadius: 12,
            boxShadow: '0 12px 28px rgba(33,30,51,0.14)',
          }}
        >
          {sugerencias.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseEnter={() => setMarcada(i)}
                onClick={() => onElegir(s)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                  background: i === marcada ? 'rgb(240,237,249)' : 'transparent',
                  borderRadius: 9, padding: '9px 11px', fontFamily: '"DM Sans"', fontSize: 13.5,
                  color: 'rgb(33,30,51)', lineHeight: 1.35,
                }}
              >
                {s.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CampoDomicilio({
  valor, provincia, onCambio, onElegir, id, placeholder, style,
}: {
  valor: string;
  /** La provincia ya elegida, si hay: acota la búsqueda muchísimo. */
  provincia?: string;
  onCambio: (texto: string) => void;
  onElegir: (lugar: LugarElegido) => void;
  id?: string;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const busqueda = useSugerencias<Fila & LugarElegido>(valor, 'direccion', provincia);
  return (
    <CampoConLista
      {...busqueda}
      valor={valor}
      onCambio={onCambio}
      onElegir={(f) => {
        busqueda.cerrar(f.domicilio);
        onElegir({ domicilio: f.domicilio, localidad: f.localidad, provincia: f.provincia });
      }}
      id={id}
      placeholder={placeholder}
      style={style}
    />
  );
}

export function CampoZona({
  valor, provincia, onCambio, onElegir, id, placeholder, style,
}: {
  valor: string;
  provincia?: string;
  onCambio: (texto: string) => void;
  onElegir: (zona: ZonaElegida) => void;
  id?: string;
  placeholder?: string;
  style?: CSSProperties;
}) {
  const busqueda = useSugerencias<Fila & ZonaElegida>(valor, 'localidad', provincia);
  return (
    <CampoConLista
      {...busqueda}
      valor={valor}
      onCambio={onCambio}
      onElegir={(f) => {
        busqueda.cerrar(f.zona);
        onElegir({ zona: f.zona, localidad: f.localidad, provincia: f.provincia });
      }}
      id={id}
      placeholder={placeholder}
      style={style}
    />
  );
}
