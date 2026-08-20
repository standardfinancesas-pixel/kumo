'use client';
import type { CSSProperties } from 'react';

import { useState } from 'react';
import { chequeosClave } from '@kumo/shared';

/**
 * Un campo de contraseña con el ojito para verla y, si se está eligiendo una, los
 * requisitos tildándose mientras se escribe.
 *
 * El ojito no es un adorno: en un teléfono, una clave que no se puede ver es la
 * causa número uno de "mi contraseña no funciona" cuando en realidad se tipeó mal.
 * Y los requisitos van a la vista desde el principio y no como error después de
 * apretar el botón, que obliga a adivinar qué falta.
 *
 * `requisitos` se apaga en el login: ahí no se elige una clave, se escribe la que ya
 * se tiene, y mostrarle "al menos 8 caracteres" a alguien que se registró con la
 * regla vieja (6) lo haría dudar de su propia cuenta.
 */
export function CampoClave({
  value, onChange, id, placeholder = '••••••••', autoComplete = 'new-password', requisitos = true, mal = false, style,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  placeholder?: string;
  autoComplete?: string;
  requisitos?: boolean;
  mal?: boolean;
  style?: CSSProperties;
}) {
  const [ver, setVer] = useState(false);
  const checks = chequeosClave(value);

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={ver ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          style={{ ...style, width: '100%', paddingRight: 44, borderColor: mal ? '#c14d7a' : (style?.borderColor ?? '#e6e3f0') }}
        />
        <button
          type="button"
          onClick={() => setVer((v) => !v)}
          aria-label={ver ? 'Ocultar la contraseña' : 'Ver la contraseña'}
          aria-pressed={ver}
          style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', padding: 8, cursor: 'pointer', color: '#8781a0', display: 'flex', alignItems: 'center' }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="3.2" />
            {/* La barra tachada solo cuando la clave está a la vista: el ícono muestra
                qué va a pasar si se toca, no en qué estado está. */}
            {ver ? <path d="M4 20L20 4" /> : null}
          </svg>
        </button>
      </div>
      {requisitos && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 8 }}>
          {checks.map((c) => (
            <span key={c.texto} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: c.ok ? 'rgb(47,143,91)' : '#8781a0' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {c.ok ? <path d="M4 12l5 5L20 6" /> : <circle cx="12" cy="12" r="8" strokeWidth="2" />}
              </svg>
              {c.texto}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
