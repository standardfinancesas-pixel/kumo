-- ============================================================
--  Kumo · Seed (datos de ejemplo del prototipo)
--  Se ejecuta después de las migraciones en `supabase db reset`.
--  Datos de catálogo (planes, beneficios, faqs, prestadores,
--  ajustes). Socios/mascotas/reintegros se crean con auth real.
-- ============================================================

-- Planes
insert into plans (name, base_price, tagline, perks, featured) values
('AMIGO', 18000, 'Lo esencial para empezar', array[
  'Descuentos en red veterinaria','Carnet digital de salud','Recordatorios de vacunas',
  'Comunidad y contenido','Reintegro 30% consultas y vacunas','Tope mensual $5.400'], false),
('FAMILIA', 32000, 'El favorito de los socios', array[
  'Todo lo de AMIGO','Consulta veterinaria online ilimitada','Asesor por WhatsApp',
  'Reintegro 50% consultas · 40% estudios y cirugías','Tope mensual $12.500','Tope anual $180.000'], true),
('VIP', 55000, 'Cobertura máxima', array[
  'Todo lo de FAMILIA','Consulta online ilimitada prioritaria','WhatsApp prioritario',
  'Reintegro 60% en todo','Tope mensual $15.000','Tope anual $495.000'], false)
on conflict (name) do nothing;

-- FAQs
insert into faqs (question, answer, "order") values
('¿Qué es Kumo?', 'Kumo es la primera app que reúne todo lo que necesitás para el cuidado de tu mascota en un solo lugar. Encontrá servicios de confianza, accedé a beneficios exclusivos con nuestras membresías, recibí asesoramiento veterinario y formá parte de una comunidad.', 1),
('¿Cuál es la diferencia entre los planes?', 'Cada plan ofrece diferentes descuentos y porcentajes de reintegro. Amigo es básico, Familia incluye más beneficios y reintegros, VIP es premium con máximos beneficios.', 2),
('¿Puedo cambiar de plan cuando quiera?', 'Sí, podés cambiar tu plan cuando lo necesites. Los cambios se aplican al próximo ciclo de facturación.', 3),
('¿Cómo funciona el carnet digital de salud?', 'En la app registrás vacunas, tratamientos y estudios de tu mascota. El carnet se actualiza automáticamente y podés compartirlo con veterinarios.', 4),
('¿Cuándo recibo los reintegros?', 'Presentás la factura en la app, la revisamos en 2-5 días hábiles y el reintegro se acredita en 48 horas.', 5);

-- Beneficios
insert into benefits (name, category, discount, plan_requirement, status, description, valid_until, zone, days, hours) values
('Veterinaria Norte','Consultas y estudios','-25%','Amigo, Familia, VIP','activo','Descuento en consultas clínicas, guardias y estudios de rutina.','2026-12-31','CABA · Núñez / Belgrano', array['L','M','X','J','V'],'9 a 19 h'),
('PetShop Central','Alimentos y accesorios','-20%','Todos los planes','activo','Descuento en alimentos balanceados, accesorios y juguetes.',null,'Todo CABA', array['L','M','X','J','V','S','D'],'Todo el día'),
('Clínica San Roque','Cirugías y guardias','-15%','Familia, VIP','activo','Descuento en cirugías programadas, internación y guardias 24hs.','2027-06-30','CABA · Caballito', array['L','M','X','J','V'],'8 a 20 h'),
('Groomers Bowie','Baño y estética','-30%','VIP','activo','Descuento en baño, corte y spa canino/felino.','2026-12-31','CABA y GBA Norte', array['M','J','S'],'10 a 17 h'),
('PetShop Sur','Alimentos premium','-10%','Todos los planes','pausado','Descuento en línea premium de alimentos importados.','2026-04-30','Zona Sur GBA', array['S','D'],'11 a 20 h');

-- Prestadores (verificados)
insert into providers (name, category, zone, address, phone, instagram, website, about, rating, reviews, price, price_unit, status, photo_url, lat, lng) values
('Lucas M.','Paseador','Palermo','Av. Santa Fe 3200, Palermo','+54 11 5678-1234','@paseospalermo','paseospalermo.com.ar','Paseos grupales e individuales por Palermo. 5 años de experiencia.',4.9,128,4500,'/paseo','verificado','prestador-walker.webp',-34.5795,-58.4198),
('Refugio Feliz','Guardería','Caballito','Av. Rivadavia 5100, Caballito','+54 11 4901-7788','@refugiofeliz.guarderia','refugiofeliz.com','Guardería con patio propio de 200m², cámaras y reporte diario.',4.8,73,12000,'/noche','verificado','guarderia-refugio.webp',-34.6187,-58.4438),
('SplashPet','Baño y estética','Belgrano','Cabildo 2450, Belgrano','+54 11 4788-2200','@splashpet.grooming',null,'Baño, corte y estética canina y felina. Productos hipoalergénicos.',4.7,54,8000,'/sesión','verificado','prestador-bath.webp',-34.5623,-58.4560),
('Sofía R.','Adiestrador','Villa Urquiza','Triunvirato 4800, Villa Urquiza','+54 11 6123-9090','@sofia.adiestramiento',null,'Adiestramiento en positivo a domicilio.',5.0,41,9500,'/clase','verificado','prestador-trainer.webp',-34.5720,-58.4880),
('Martín D.','Cuidador','Núñez','Av. Cabildo 3900, Núñez','+54 11 5544-3322','@martin.petsitter',null,'Cuido tu mascota en tu casa mientras viajás.',4.9,96,6000,'/día','verificado','prestador-caregiver.webp',-34.5460,-58.4560);

-- Ajustes del club
insert into club_settings (id, whatsapp, email) values (1, '+54 9 11 2516-8802', 'hola@kumoclub.com.ar')
on conflict (id) do nothing;

-- Notificaciones push de ejemplo
insert into push_notifications (title, body, audience, sent_at) values
('¡Nuevo beneficio!','Groomers Bowie ahora con 30% off para socios VIP.','plan_vip', now() - interval '2 days'),
('Recordatorio de vacunas','Revisá el carnet de tu mascota, hay vacunas próximas a vencer.','todos', now() - interval '5 days');
