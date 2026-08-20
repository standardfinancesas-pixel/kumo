import Image from 'next/image';

/**
 * El carnet que se ve al terminar el alta.
 *
 * Es presentacional a propósito: el `Carnet` de la webapp es una pantalla entera
 * —calendario, alta de vacunas, contactos de emergencia, cambiar la foto— que
 * necesita el contexto de la app y datos que a los diez segundos del alta todavía no
 * existen. Acá se muestra lo que la persona acaba de cargar, y nada más.
 */
export function CarnetAlta({
  nombre, especie, raza, edad, peso, microchip, fotoUrl, etiqueta, memberNo,
}: {
  nombre: string;
  especie: string;
  raza: string | null;
  edad: number | null;
  peso: number | null;
  microchip: string | null;
  fotoUrl: string | null;
  /** "Plan FAMILIA", "Plan gratuito"… lo decide `etiquetaPlan` de shared. */
  etiqueta: string;
  memberNo: number | null;
}) {
  const fila = (k: string, v: string) => (
    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
      <span style={{ fontSize: 12.5, color: '#c9c3e3' }}>{k}</span>
      <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 600, textAlign: 'right' }}>{v}</span>
    </div>
  );

  return (
    <div style={{ background: 'rgb(93,84,145)', borderRadius: 20, padding: 20, color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ width: 62, height: 62, borderRadius: 18, overflow: 'hidden', background: 'rgba(255,255,255,0.14)', flex: '0 0 auto', position: 'relative' }}>
          {/* La foto sale de la base y no del archivo local: un blob del navegador no
              sobrevive la vuelta de Mercado Pago, así que el carnet se veía sin foto
              justo después de pagar. Si la subida falló, no hay foto y se avisa aparte. */}
          {fotoUrl ? <Image src={fotoUrl} alt="" fill sizes="62px" style={{ objectFit: 'cover' }} unoptimized /> : null}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 22, lineHeight: 1.1 }}>{nombre}</div>
          <div style={{ fontSize: 12.5, color: '#c9c3e3', marginTop: 2 }}>
            {etiqueta}{memberNo ? ` · Socio #${memberNo}` : ''}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', background: 'rgb(225,251,98)', color: 'rgb(33,30,51)', fontSize: 10.5, fontWeight: 800, padding: '4px 10px', borderRadius: 100, flex: '0 0 auto' }}>
          ACTIVO
        </span>
      </div>
      <div>
        {fila('Especie', especie)}
        {raza ? fila('Raza', raza) : null}
        {edad ? fila('Edad', `${edad} ${edad === 1 ? 'año' : 'años'}`) : null}
        {peso ? fila('Peso', `${peso} kg`) : null}
        {microchip ? fila('Microchip', microchip) : null}
      </div>
    </div>
  );
}
