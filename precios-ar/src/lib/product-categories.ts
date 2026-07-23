export interface CategoryRule {
  category: string;
  keywords: string[];
  priority: number;
}

export const CATEGORY_RULES: CategoryRule[] = [
  { category: 'electrodomesticos', keywords: ['lavarropa', 'lavarropas', 'heladera', 'freezer', 'microondas', 'licuadora', 'batidora', 'cocina', 'horno', 'anafe', 'pava electrica', 'tostadora', 'plancha', 'aspiradora', 'ventilador', 'aire acondicionado', 'estufa', 'termotanque', 'calefon'], priority: 10 },
  { category: 'electronica', keywords: ['celular', 'smartphone', 'tablet', 'notebook', 'laptop', 'monitor', 'teclado', 'mouse', 'auricular', 'parlante', 'cargador', 'cable', 'memoria', 'disco rigido', 'ssd', 'pendrive', 'router', 'webcam', 'gabinete', 'fuente', 'placa'], priority: 10 },
  { category: 'supermercados', keywords: ['leche', 'arroz', 'fideos', 'aceite', 'harina', 'azucar', 'sal', 'pure', 'galletita', 'factura', 'pan', 'yogur', 'queso', 'manteca', 'crema', 'huevo', 'atun', 'lenteja', 'poroto', 'garbanzo', 'pure de tomate', 'salsa', 'mayonesa', 'mostaza', 'ketchup', 'vinagre', 'cafe', 'te', 'mate', 'yerba', 'cacao', 'chocolate', 'dulce', 'mermelada', 'cereal', 'granola', 'avena', 'sopa', 'caldo', 'condimento', 'especia', 'ella', 'knorr', 'arcor', 'terrabusi', 'serenisima', 'sancor', 'la serenisima', 'coca', 'pepsi', 'agua mineral', 'gaseosa', 'jugo en polvo'], priority: 1 },
  { category: 'bebidas', keywords: ['cerveza', 'vino', 'fernet', 'vodka', 'ron', 'ginebra', 'whisky', 'espumante', 'sidra', 'aperitivo', 'campari', 'granadina'], priority: 5 },
  { category: 'frigorifico', keywords: ['carne', 'carne molida', 'carne picada', 'bife', 'lomo', 'nalga', 'cuadril', 'peceto', 'asado', 'costilla', 'vacio', 'matambre', 'pollo', 'pechuga', 'pierna', 'muslo', 'ala', 'cerdo', 'carre', 'bondiola', 'costeleta', 'chorizo', 'morcilla', 'salchicha', 'milanesa', 'hamburguesa', 'nugget'], priority: 10 },
  { category: 'pintureria', keywords: ['pintura', 'latex', 'esmalte', 'enduido', 'masilla', 'sikaflex', 'thinner', 'aguarras', 'solvente', 'laca', 'barniz', 'colorante', 'rodillo', 'pincel', 'brocha', 'cinta de pintor', 'lijas'], priority: 10 },
  { category: 'ferreteria', keywords: ['taladro', 'amoladora', 'lijadora', 'sierra', 'destornillador', 'llave inglesa', 'llave francesa', 'martillo', 'pinza', 'tenaza', 'cutter', 'metro', 'cinta metrica', 'nivel', 'tornillo', 'clavo', 'tarugo', 'arandela', 'tuerca', 'candado', 'cerradura', 'bomba de agua'], priority: 10 },
  { category: 'construccion', keywords: ['cemento', 'cal', 'arena', 'piedra', 'ladrillo', 'bloque', 'vigueta', 'bovedilla', 'hierro', 'malla', 'alambre', 'chapas', 'pizarreño', 'membrana', 'impermeable', 'pegamento', 'adhesivo'], priority: 10 },
  { category: 'ceramicas', keywords: ['ceramica', 'porcelanato', 'azulejo', 'piso', 'piso flotante', 'mosaico', 'gres', 'baldosa', 'cenefa', 'zocalo', 'borde', 'junta', 'pastina', 'pegamento ceramica'], priority: 10 },
  { category: 'farmacia', keywords: ['ibuprofeno', 'paracetamol', 'aspirina', 'amoxicilina', 'antibiotico', 'antigripal', 'antihistaminico', 'analgesico', 'antiinflamatorio', 'vitamina', 'suplemento', 'protector solar', 'shampoo', 'acondicionador', 'jabon', 'pasta dental', 'cepillo dental', 'desodorante', 'perfume', 'colonia', 'alcohol', 'gasas', 'curita', 'venda'], priority: 10 },
  { category: 'cosmeticos', keywords: ['labial', 'pintalabios', 'base', 'polvo', 'rubor', 'sombra', 'delineador', 'rimel', 'máscara de pestañas', 'esmalte de uñas', 'crema facial', 'crema corporal', 'serum', 'tonico'], priority: 10 },
  { category: 'mascotas', keywords: ['alimento perro', 'alimento gato', 'balanceado', 'dog chow', 'cat chow', 'whiskas', 'pedigree', 'royal canin', 'arena gato', 'pipeta', 'antipulgas', 'cuchas', 'juguete mascota', 'comedero mascota'], priority: 10 },
  { category: 'deportes', keywords: ['pelota', 'zapatilla', 'pesa', 'mancuerna', 'bicicleta', 'casco', 'rodillera', 'canillera', 'protector', 'raqueta', 'paleta', 'guante', 'short', 'musculosa', 'buzo deportivo', 'camiseta deporte', 'botin', 'palo golf'], priority: 10 },
  { category: 'juguetes', keywords: ['muñeca', 'auto', 'camion', 'bloques', 'rompecabezas', 'puzzle', 'juego de mesa', 'cartas', 'dominó', 'trompo', 'pelota juguete', 'peluche', 'juguete educativo'], priority: 10 },
  { category: 'libreria', keywords: ['cuaderno', 'lapicera', 'lapiz', 'goma', 'regla', 'cartulina', 'resma', 'hoja', 'carpeta', 'mochila', 'cartuchera', 'fibron', 'marcador', 'tiza', 'pizarron', 'agenda', 'libro'], priority: 10 },
  { category: 'bebes', keywords: ['pañal', 'chupete', 'mamadera', 'cuna', 'corral', 'cambiador', 'cochecito', 'silla de paseo', 'bebe', 'remera bebe', 'body', 'enterito', 'babero', 'toallon'], priority: 10 },
  { category: 'ropa', keywords: ['remera', 'pantalon', 'jean', 'short', 'campera', 'abrigo', 'saco', 'buzo', 'vestido', 'falda', 'pollera', 'camisa', 'zapatos', 'zapatilla', 'bota', 'sandalia', 'ojota', 'cinto', 'cinturon', 'corbata', 'medias', 'pijama', 'boxer', 'corpiño', 'bombacha'], priority: 10 },
  { category: 'muebles', keywords: ['silla', 'mesa', 'escritorio', 'ropero', 'placard', 'cama', 'colchon', 'sillon', 'sofa', 'estanteria', 'biblioteca', 'mesa ratona', 'mesa luz', 'comoda', 'cajonera', 'perchero'], priority: 10 },
  { category: 'herramientas', keywords: ['caja herramientas', 'juego herramientas', 'llave ajuste', 'llave combinada', 'juego destornillador', 'juego llave', 'organizador herramientas', 'cinturon herramientas'], priority: 10 },
];

export function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function autoDetectCategory(
  canonicalName: string,
  rawName?: string | null,
  brand?: string | null
): string | null {
  const text = normalize([canonicalName, rawName, brand].filter(Boolean).join(' '));

  let bestMatch: { category: string; priority: number } | null = null;

  for (const rule of CATEGORY_RULES) {
    for (const keyword of rule.keywords) {
      if (text.includes(normalize(keyword))) {
        if (!bestMatch || rule.priority > bestMatch.priority) {
          bestMatch = { category: rule.category, priority: rule.priority };
        }
        break;
      }
    }
  }

  return bestMatch?.category ?? null;
}
