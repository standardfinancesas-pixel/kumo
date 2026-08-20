/**
 * Preguntarle a Mercado Pago cómo salió el pago, en vez de esperar su aviso.
 *
 * Lo llaman las dos pantallas que esperan (la final del alta y la hoja del plan),
 * y está acá para que las dos manden lo mismo: el `preapproval_id` que Mercado Pago
 * deja en la URL al volver, que le sirve al servidor cuando el socio todavía no
 * tiene ninguna suscripción guardada.
 *
 * Nunca tira: si la consulta falla, el sondeo sigue y el webhook termina el trabajo.
 * Que no se pueda confirmar más rápido no es un pago fallido.
 */
export async function confirmarPago(): Promise<{ suscripcion: string | null; hasta: string | null; acreditado: boolean } | null> {
  try {
    const preapprovalId = new URLSearchParams(window.location.search).get('preapproval_id');
    const res = await fetch('/api/pagos/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preapprovalId }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
