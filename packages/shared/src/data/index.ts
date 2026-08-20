/**
 * Kumo · Datos de ejemplo (mock)
 * Copiados del prototipo. Sirven para (a) desarrollar la UI sin backend
 * y (b) generar el seed de Supabase (ver supabase/seed.sql).
 */
import type {
  Plan,
  Faq,
  Provider,
  Benefit,
  CommunityPost,
  ClubSettings,
  EmergencyContact,
} from '../types';

export const plans: Plan[] = [
  {
    id: 'plan-amigo',
    name: 'AMIGO',
    basePrice: 18000,
    tagline: 'Lo esencial para empezar',
    perks: [
      'Descuentos en red veterinaria',
      'Carnet digital de salud',
      'Recordatorios de vacunas',
      'Comunidad y contenido',
      'Reintegro 30% consultas y vacunas',
      'Tope mensual $5.400',
    ],
  },
  {
    id: 'plan-familia',
    name: 'FAMILIA',
    basePrice: 32000,
    tagline: 'El favorito de los socios',
    featured: true,
    perks: [
      'Todo lo de AMIGO',
      'Consulta veterinaria online ilimitada',
      'Asesor por WhatsApp',
      'Reintegro 50% consultas · 40% estudios y cirugías',
      'Tope mensual $12.500',
      'Tope anual $180.000',
    ],
  },
  {
    id: 'plan-vip',
    name: 'VIP',
    basePrice: 55000,
    tagline: 'Cobertura máxima',
    perks: [
      'Todo lo de FAMILIA',
      'Consulta online ilimitada prioritaria',
      'WhatsApp prioritario',
      'Reintegro 60% en todo',
      'Tope mensual $15.000',
      'Tope anual $495.000',
    ],
  },
];

export const faqs: Faq[] = [
  {
    id: 'faq-1',
    order: 1,
    question: '¿Qué es Kumo?',
    answer:
      'Kumo es la primera app que reúne todo lo que necesitás para el cuidado de tu mascota en un solo lugar. Encontrá servicios de confianza, accedé a beneficios exclusivos con nuestras membresías, recibí asesoramiento veterinario y formá parte de una comunidad donde conectar, compartir y ayudar a otros amantes de las mascotas.',
  },
  {
    id: 'faq-2',
    order: 2,
    question: '¿Cuál es la diferencia entre los planes?',
    answer:
      'Cada plan ofrece diferentes descuentos y porcentajes de reintegro. El plan Amigo es básico con descuentos en algunos servicios. Familia incluye más beneficios y reintegros. VIP es nuestro plan premium con máximos beneficios.',
  },
  {
    id: 'faq-3',
    order: 3,
    question: '¿Puedo cambiar de plan cuando quiera?',
    answer:
      'Sí, podés cambiar tu plan cuando lo necesites. Los cambios se aplican al próximo ciclo de facturación. Si querés cambiar antes, contactanos por WhatsApp.',
  },
  {
    id: 'faq-4',
    order: 4,
    question: '¿Cómo funciona el carnet digital de salud?',
    answer:
      'En la app podés registrar todas las vacunas, tratamientos y estudios de tu mascota. El carnet digital se actualiza automáticamente y podés compartirlo con veterinarios. También tenés un calendario para recordar cuándo vacunar.',
  },
  {
    id: 'faq-5',
    order: 5,
    question: '¿Cuándo recibo los reintegros?',
    answer:
      'Presentás la factura en la app y la revisa una persona del club. Si está todo bien, el reintegro se acredita en tu CBU/CVU dentro de los 30 días corridos.',
  },
];

export const providers: Provider[] = [
  {
    id: 'prov-1',
    name: 'Lucas M.',
    category: 'Paseador',
    zone: 'Palermo',
    address: 'Av. Santa Fe 3200, Palermo',
    phone: '+54 11 5678-1234',
    instagram: '@paseospalermo',
    website: 'paseospalermo.com.ar',
    about:
      'Paseos grupales e individuales por Palermo y Palermo Hollywood. 5 años de experiencia con perros de todo tamaño.',
    rating: 4.9,
    reviews: 128,
    price: 4500,
    priceUnit: '/paseo',
    status: 'verificado',
    photoUrl: 'prestador-walker.webp',
    lat: -34.5795,
    lng: -58.4198,
  },
  {
    id: 'prov-2',
    name: 'Refugio Feliz',
    category: 'Guardería',
    zone: 'Caballito',
    address: 'Av. Rivadavia 5100, Caballito',
    phone: '+54 11 4901-7788',
    instagram: '@refugiofeliz.guarderia',
    website: 'refugiofeliz.com',
    about:
      'Guardería con patio propio de 200m², cámaras y reporte diario con fotos. Cupos limitados por día.',
    rating: 4.8,
    reviews: 73,
    price: 12000,
    priceUnit: '/noche',
    status: 'verificado',
    photoUrl: 'guarderia-refugio.webp',
    lat: -34.6187,
    lng: -58.4438,
  },
  {
    id: 'prov-3',
    name: 'SplashPet',
    category: 'Baño y estética',
    zone: 'Belgrano',
    address: 'Cabildo 2450, Belgrano',
    phone: '+54 11 4788-2200',
    instagram: '@splashpet.grooming',
    website: null,
    about:
      'Baño, corte y estética canina y felina. Productos hipoalergénicos y secado sin jaula.',
    rating: 4.7,
    reviews: 54,
    price: 8000,
    priceUnit: '/sesión',
    status: 'verificado',
    photoUrl: 'prestador-bath.webp',
    lat: -34.5623,
    lng: -58.4560,
  },
  {
    id: 'prov-4',
    name: 'Sofía R.',
    category: 'Adiestrador',
    zone: 'Villa Urquiza',
    address: 'Triunvirato 4800, Villa Urquiza',
    phone: '+54 11 6123-9090',
    instagram: '@sofia.adiestramiento',
    website: null,
    about:
      'Adiestramiento en positivo a domicilio: obediencia básica, correa y problemas de conducta.',
    rating: 5.0,
    reviews: 41,
    price: 9500,
    priceUnit: '/clase',
    status: 'verificado',
    photoUrl: 'prestador-trainer.webp',
    lat: -34.5720,
    lng: -58.4880,
  },
  {
    id: 'prov-5',
    name: 'Martín D.',
    category: 'Cuidador',
    zone: 'Núñez',
    address: 'Av. Cabildo 3900, Núñez',
    phone: '+54 11 5544-3322',
    instagram: '@martin.petsitter',
    website: null,
    about:
      'Cuido tu mascota en tu casa mientras viajás. Visitas, paseos y compañía. Referencias comprobables.',
    rating: 4.9,
    reviews: 96,
    price: 6000,
    priceUnit: '/día',
    status: 'verificado',
    photoUrl: 'prestador-caregiver.webp',
    lat: -34.5460,
    lng: -58.4560,
  },
];

export const benefits: Benefit[] = [
  {
    id: 'ben-vetnorte',
    name: 'Veterinaria Norte',
    category: 'Consultas y estudios',
    discount: '-25%',
    planRequirement: 'Amigo, Familia, VIP',
    status: 'activo',
    description:
      'Descuento en consultas clínicas, guardias y estudios de rutina para socios del club.',
    validUntil: '2026-12-31',
    zone: 'CABA · Núñez / Belgrano',
    days: ['L', 'M', 'X', 'J', 'V'],
    hours: '9 a 19 h',
  },
  {
    id: 'ben-petcentral',
    name: 'PetShop Central',
    category: 'Alimentos y accesorios',
    discount: '-20%',
    planRequirement: 'Todos los planes',
    status: 'activo',
    description:
      'Descuento en alimentos balanceados, accesorios y juguetes en todas las sucursales.',
    validUntil: null,
    zone: 'Todo CABA',
    days: ['L', 'M', 'X', 'J', 'V', 'S', 'D'],
    hours: 'Todo el día',
  },
  {
    id: 'ben-sanroque',
    name: 'Clínica San Roque',
    category: 'Cirugías y guardias',
    discount: '-15%',
    planRequirement: 'Familia, VIP',
    status: 'activo',
    description:
      'Descuento en cirugías programadas, internación y guardias de urgencia 24hs.',
    validUntil: '2027-06-30',
    zone: 'CABA · Caballito',
    days: ['L', 'M', 'X', 'J', 'V'],
    hours: '8 a 20 h',
  },
  {
    id: 'ben-bowie',
    name: 'Groomers Bowie',
    category: 'Baño y estética',
    discount: '-30%',
    planRequirement: 'VIP',
    status: 'activo',
    description: 'Descuento en baño, corte y spa canino/felino a domicilio o en local.',
    validUntil: '2026-12-31',
    zone: 'CABA y GBA Norte',
    days: ['M', 'J', 'S'],
    hours: '10 a 17 h',
  },
  {
    id: 'ben-petsur',
    name: 'PetShop Sur',
    category: 'Alimentos premium',
    discount: '-10%',
    planRequirement: 'Todos los planes',
    status: 'pausado',
    description: 'Descuento en línea premium de alimentos importados.',
    validUntil: '2026-04-30',
    zone: 'Zona Sur GBA',
    days: ['S', 'D'],
    hours: '11 a 20 h',
  },
];

export const communityPosts: CommunityPost[] = [
  {
    id: 'post-1',
    category: 'Paseadores',
    author: 'Cami',
    zone: 'Palermo',
    createdMeta: 'Palermo · hace 2h',
    title: '¿Alguien probó a Lucas de Paseos Palermo?',
    body: 'Estoy por contratarlo para mi golden retriever y quería saber experiencias antes de reservar. ¿Es puntual? ¿Manda fotos del paseo? ¿Cómo maneja perros grandes con otros en la jauría?',
    replies: 14,
    likes: 23,
    answers: [
      {
        author: 'Jorge',
        when: 'hace 1h',
        text: 'Lo tengo hace 3 meses con mi labrador. Súper responsable, siempre puntual y manda fotos de cada paseo. Recomendadísimo.',
        likes: 12,
        best: true,
      },
      {
        author: 'Flor',
        when: 'hace 40 min',
        text: 'Coincido. Maneja bien los grupos, nunca junta más de 4 perros. A mi golden lo trae feliz.',
        likes: 5,
        best: false,
      },
    ],
  },
  {
    id: 'post-2',
    category: 'Salud',
    author: 'Nico',
    zone: null,
    createdMeta: 'General · hace 5h',
    title: 'Mi gato no quiere la pastilla antipulgas, ¿tips?',
    body: 'Ya probé de todo: escondida en el paté, en el atún, envuelta en jamón… y nada, siempre la escupe. ¿Alguna pipeta o alternativa que recomienden para gatos difíciles?',
    replies: 31,
    likes: 47,
    answers: [
      {
        author: 'Dra. Sofía',
        when: 'hace 4h',
        text: 'Para gatos que no toleran comprimidos, la pipeta mensual es la mejor opción. Aplicala en la nuca donde no llegue a lamerse.',
        likes: 28,
        best: true,
      },
    ],
  },
];

export const clubSettings: ClubSettings = {
  whatsapp: '+54 9 11 2516-8802',
  email: 'hola@kumo.pet',
};

export const emergencyContacts: EmergencyContact[] = [
  {
    id: 'emg-1',
    name: 'Veterinaria Central',
    phone: '+54 9 11 2345-6789',
    type: 'Veterinaria',
    address: 'Calle 123, CABA',
    hours: 'Lun-Dom 8am-10pm',
  },
  {
    id: 'emg-2',
    name: 'Dr. García',
    phone: '+54 9 11 3456-7890',
    type: 'Veterinario',
    address: 'Caballito, CABA',
    hours: 'Lun-Vie 9am-6pm',
  },
];

/** Rubros de prestadores para la landing y la app. */
export const providerCategories = [
  { key: 'paseadores', name: 'Paseadores', count: '86 activos', photo: 'prestador-walker.webp' },
  { key: 'guarderias', name: 'Guarderías', count: '31 espacios', photo: 'prestador-guarderia.webp' },
  { key: 'adiestradores', name: 'Adiestradores', count: '22 profesionales', photo: 'prestador-trainer.webp' },
  { key: 'bano', name: 'Baño y estética', count: '54 pet shops', photo: 'prestador-bath-duck.webp' },
  { key: 'cuidadores', name: 'Cuidadores', count: '70 disponibles', photo: 'prestador-caregiver.webp' },
  { key: 'otros', name: 'Otros servicios', count: 'Sumá el tuyo', photo: 'prestador-other.webp' },
];
