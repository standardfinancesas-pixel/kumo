/*
 * Página legal (contenido placeholder hasta tener los textos definitivos).
 * Destino de los links del footer: /legal#terminos, #privacidad, #arrepentimiento.
 */

const h2: React.CSSProperties = { fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, letterSpacing: '-0.02em', color: 'rgb(33,30,51)', margin: '0 0 12px', scrollMarginTop: 90 };
const p: React.CSSProperties = { color: 'rgb(91,86,112)', fontSize: 15, lineHeight: 1.65, margin: '0 0 12px' };

export default function Legal() {
  return (
    <main style={{ minHeight: '100vh' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(245,244,248,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgb(230,227,240)' }}>
        <div style={{ maxWidth: 780, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 26, color: 'rgb(93,84,145)', textDecoration: 'none' }}>Kumo</a>
          <a href="/" style={{ fontFamily: '"DM Sans"', fontWeight: 600, fontSize: 14, color: 'rgb(135,129,160)', textDecoration: 'none' }}>← Volver</a>
        </div>
      </div>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '48px 24px 80px' }}>
        <h1 style={{ fontFamily: '"Baloo 2"', fontWeight: 800, fontSize: 36, letterSpacing: '-0.02em', margin: '0 0 32px' }}>Información legal</h1>

        <section id="terminos" style={{ marginBottom: 40 }}>
          <h2 style={h2}>Términos y condiciones</h2>
          <p style={p}>Kumo es un club de beneficios para dueños de mascotas administrado desde CABA, Argentina, habilitado a operar en todo el territorio nacional. Kumo no es un seguro ni una prepaga.</p>
          <p style={p}>La membresía es mensual, sin permanencia mínima: podés cambiar de plan o cancelar cuando quieras. Los reintegros aplican según el plan contratado, con los topes y carencias publicados en la página de planes.</p>
        </section>

        <section id="privacidad" style={{ marginBottom: 40 }}>
          <h2 style={h2}>Política de privacidad</h2>
          <p style={p}>Tus datos personales y los de tus mascotas se usan únicamente para operar el club: gestionar tu membresía, procesar reintegros y contactarte por novedades del servicio. No vendemos tus datos a terceros.</p>
          <p style={p}>Podés pedir la actualización o eliminación de tus datos escribiendo a hola@kumoclub.com.ar.</p>
        </section>

        <section id="arrepentimiento" style={{ marginBottom: 40 }}>
          <h2 style={h2}>Derecho de arrepentimiento</h2>
          <p style={p}>De acuerdo con la Ley 24.240 de Defensa del Consumidor, contás con 10 días corridos desde la contratación para arrepentirte sin costo. Escribinos a hola@kumoclub.com.ar o por WhatsApp y gestionamos la baja y la devolución.</p>
        </section>

        <p style={{ fontSize: 12.5, color: 'rgb(162,157,186)' }}>© 2026 Kumo. Todos los derechos reservados. Tus derechos como consumidor están protegidos por la Ley 24.240.</p>
      </div>
    </main>
  );
}
