'use client';
import type { CSSProperties } from 'react';

import { useEffect, useRef, useState } from 'react';

/**
 * El campo de domicilio, con las direcciones reales del callejero argentino.
 *
 * Lo que se elige de la lista llena los tres campos de una vez —domicilio, localidad
 * y provincia— y ya normalizados. Eso es lo que arregla el problema de fondo: los
 * domicilios que había cargados eran "luis maria campos 405, 1", "caba" y "mendoza",
 * y de ahí salieron todas las reglas de limpieza del geocodificador.
 *
 * **Sigue siendo un campo de texto libre.** El callejero no tiene todo (barrios
 * nuevos, countries, "km 12 de la ruta 9") y nadie puede quedarse sin poder darse de
 * alta porque su casa no figure en una base. La lista sugiere; no obliga.
 *
 * La búsqueda es contra `/api/lugares`, que es un pasamanos con caché: así el
 * domicilio de alguien no viaja desde su navegador a un tercero.
 */
export type LugarElegido = { domicilio: string; localidad: string; provincia: string };
type Sugerencia = LugarElegido & { id: string; etiqueta: string };

/** Cuánto se espera después de la última tecla. 350 ms es el tiempo en el que una
 *  persona termina de escribir una palabra: con menos, se consulta por cada letra. */
const ESPERA_MS = 350;
/** Menos de esto no es una dirección, es alguien empezando a escribir. */
const MINIMO = 4;

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
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [marcada, setMarcada] = useState(-1);
  /* Lo último que se eligió de la lista: evita que al elegir se dispare una búsqueda
     nueva con ese mismo texto y la lista vuelva a abrirse sola. */
  const elegido = useRef<string | null>(null);
  const caja = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const texto = valor.trim();
    if (texto === elegido.current) return;
    if (texto.length < MINIMO) { setSugerencias([]); setAbierto(false); return; }

    const corte = new AbortController();
    const reloj = setTimeout(async () => {
      try {
        const url = `/api/lugares?q=${encodeURIComponent(texto)}${provincia ? `&provincia=${encodeURIComponent(provincia)}` : ''}`;
        const r = await fetch(url, { signal: corte.signal });
        if (!r.ok) return;
        const { sugerencias: lista } = (await r.json()) as { sugerencias: Sugerencia[] };
        setSugerencias(lista);
        setMarcada(-1);
        setAbierto(lista.length > 0);
      } catch {
        // Pedido cancelado o red caída: el campo sigue funcionando como texto.
      }
    }, ESPERA_MS);

    return () => { clearTimeout(reloj); corte.abort(); };
  }, [valor, provincia]);

  /* Cerrar al tocar afuera. No se usa `onBlur` del input porque el blur llega antes
     del click en la sugerencia y la lista se cerraba sin haber elegido nada. */
  useEffect(() => {
    if (!abierto) return;
    const afuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', afuera);
    return () => document.removeEventListener('mousedown', afuera);
  }, [abierto]);

  const elegir = (s: Sugerencia) => {
    elegido.current = s.domicilio;
    setAbierto(false);
    setSugerencias([]);
    onElegir({ domicilio: s.domicilio, localidad: s.localidad, provincia: s.provincia });
  };

  const teclas = (e: React.KeyboardEvent) => {
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setMarcada((i) => (i + 1) % sugerencias.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setMarcada((i) => (i <= 0 ? sugerencias.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && marcada >= 0) { e.preventDefault(); elegir(sugerencias[marcada]!); }
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
                onClick={() => elegir(s)}
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
