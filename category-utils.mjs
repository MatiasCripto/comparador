// category-utils.mjs — Auto-detecci�n de categor�as para scrapers
// Uso: import { autoDetectCategory } from './category-utils.mjs';

const CATEGORY_RULES = [
  { category: 'electrodomesticos', keywords: ['lavarropa', 'heladera', 'freezer', 'cocina', 'horno', 'microondas', 'lavavajilla', 'secarropa', 'aire acondicionado', 'ventilador', 'aspiradora', 'plancha', 'pava electrica', 'licuadora', 'batidora', 'tostadora', 'cafetera', 'exprimidor', 'procesadora', 'mixer'], priority: 10 },
  { category: 'electronica', keywords: ['celular', 'smartphone', 'tablet', 'notebook', 'computadora', 'teclado', 'mouse', 'monitor', 'auricular', 'parlante', 'cargador', 'cable', 'disco rigido', 'ssd', 'pendrive', 'memoria ram', 'placa', 'gabinete', 'router', 'modem', 'smartwatch', 'camara', 'webcam', 'microfono'], priority: 10 },
  { category: 'supermercados', keywords: ['leche', 'arroz', 'fideos', 'harina', 'azucar', 'aceite', 'sal', 'galleta', 'pan', 'pan rallado', 'cereal', 'avena', 'pure de tomate', 'lata de tomate', 'lenteja', 'poroto', 'garbanzo', 'atun', 'sardina', 'dulce de leche', 'mermelada', 'manteca', 'crema de leche', 'yogur', 'queso', 'huevos', 'margarina', 'mayonesa', 'mostaza', 'ketchup', 'vinagre', 'salsa', 'caldo', 'sopa', 'pure instantaneo', 'polenta', 'te', 'yerba', 'cafe', 'chocolate', 'alfajor', 'golosina', 'caramelo', 'chicle', 'snack', 'papas fritas', 'mani', 'palito salado', 'agua', 'gaseosa', 'jugo', 'soda', 'galletita', 'budin', 'flan', 'gelatina', 'postre', 'harina leudante', 'levadura', 'esencia de vainilla', 'colorante', 'copos de maiz', 'granola', 'edulcorante', 'miel'], priority: 1 },
  { category: 'bebidas', keywords: ['cerveza', 'vino', 'fernet', 'gin', 'vodka', 'ron', 'whisky', 'campari', 'aperitivo', 'espumante', 'champagne', 'sidra', 'energizante', 'isotonic'], priority: 5 },
  { category: 'frigorifico', keywords: ['carne', 'pollo', 'cerdo', 'vacio', 'bife', 'asado', 'milanesa', 'nalga', 'paleta', 'lomo', 'cuadril', 'peceto', 'bondiola', 'matambre', 'chorizo', 'salchicha', 'hamburguesa', 'medallon', 'nugget', 'pescado', 'merluza', 'camaron', 'salmon', 'lata de pescado', 'embutido', 'jamon', 'salame', 'fiambre', 'queso crema', 'ricota', 'dulce de batata'], priority: 10 },
  { category: 'pintureria', keywords: ['pintura', 'latex', 'esmalte', 'laca', 'barniz', 'satinado', 'fondo', 'masilla', 'endudo', 'pincel', 'rodillo', 'thinner', 'aguarras', 'solvente', 'sikaflex', 'pisotex', 'blancoque'], priority: 10 },
  { category: 'ferreteria', keywords: ['taladro', 'amoladora', 'lijadora', 'sierra', 'cepillo', 'destornillador', 'martillo', 'pinza', 'llave', 'wincha', 'nivel', 'cinta metrica', 'soldador', 'multimetro', 'linterna', 'cadena', 'candado', 'bujia', 'filtro', 'cuchilla', 'disco de corte', 'mecha', 'broca', 'cuna', 'grampa', 'clavo', 'tornillo', 'arandela', 'remache', 'abrazadera', 'manguera', 'pala', 'pico', 'azada', 'rastrillo', 'cortadora de pasto', 'bordeadora'], priority: 10 },
  { category: 'construccion', keywords: ['cemento', 'cal', 'arena', 'piedra', 'ladrillo', 'bloque', 'vigueta', 'bolsa de cal', 'pegamento', 'adhesivo', 'cinta de agua', 'cinta aislante', 'piso flotante', 'mosaico', 'membrana', 'perfil', 'canaleta', 'cano', 'tubo', 'curva', 'llave paso', 'grifo', 'valvula', 'tanque', 'termotanque', 'calefon', 'radiador', 'sifon', 'desague'], priority: 10 },
  { category: 'ceramicas', keywords: ['ceramica', 'porcelanato', 'baldosa', 'cenefa', 'listel', 'zocalo', 'borde', 'pastina', 'piso ceramico', 'revestimiento'], priority: 10 },
  { category: 'farmacia', keywords: ['ibuprofeno', 'paracetamol', 'aspirina', 'amoxicilina', 'antibiotico', 'antihistaminico', 'analgesico', 'antiinflamatorio', 'antigripal', 'jarabe', 'gotas', 'crema', 'pomada', 'alcohol', 'agua oxigenada', 'barbijo', 'curita', 'venda', 'gasas', 'termometro', 'protector solar', 'anticonceptivo', 'vitamina', 'suplemento'], priority: 10 },
  { category: 'cosmeticos', keywords: ['labial', 'base', 'polvo', 'rubor', 'delineador', 'sombras', 'rimmel', 'esmalte de unias', 'perfume', 'colonia', 'shampoo', 'acondicionador', 'jabon', 'crema', 'serum', 'tonico', 'desmaquillante', 'protector solar facial', 'hidratante', 'exfoliante', 'mascara', 'cepillo dental', 'pasta dental', 'enjuague bucal', 'hilo dental', 'desodorante', 'talco', 'balsamo', 'cera'], priority: 10 },
  { category: 'mascotas', keywords: ['alimento perro', 'alimento gato', 'comida para perro', 'comida para gato', 'balanceado', 'collar', 'correa', 'juguete perro', 'shampoo perro', 'antipulgas', 'pipeta', 'cuchas', 'cama perro', 'comedero', 'bebedero', 'arena gato'], priority: 10 },
  { category: 'deportes', keywords: ['pelota', 'zapatilla', 'buzo', 'camiseta', 'short', 'calza', 'musculosa', 'pesa', 'mancuerna', 'barra', 'disco', 'liga', 'soga', 'colchoneta', 'mat', 'bicicleta', 'casco', 'rodillera', 'canillera', 'guante', 'paleta', 'raqueta', 'pelota de futbol', 'pelota de basket', 'pelota de tenis', 'protector', 'palo de golf', 'tabla surf'], priority: 10 },
  { category: 'juguetes', keywords: ['muneca', 'muneco', 'auto', 'camion', 'tren', 'bloques', 'rompecabezas', 'puzzle', 'juego de mesa', 'cartas', 'dados', 'figura', 'peluche', 'bebe', 'sonajero', 'chupete', 'mordillo', 'cuna', 'corralito', 'cochecito', 'sillita', 'hamaca', 'triciclo', 'patineta', 'monopatin'], priority: 10 },
  { category: 'libreria', keywords: ['cuaderno', 'lapicera', 'lapiz', 'fibron', 'resaltador', 'carpeta', 'hoja', 'cartulina', 'papel', 'tijera', 'regla', 'compas', 'transportador', 'escuadra', 'goma', 'sacapunta', 'correctivo', 'mochila', 'cartuchera', 'pizarra', 'afiche', 'tempera', 'acuarela', 'pincel escolar', 'plastilina', 'arcilla'], priority: 10 },
  { category: 'bebes', keywords: ['panial', 'panal', 'chupete', 'mamadera', 'biberon', 'sonajero', 'andador', 'cuna', 'corralito', 'cambiador', 'moises', 'cochecito', 'silla de comer', 'hamaquita', 'mordillo', 'crema panial', 'talco bebe', 'shampoo bebe', 'toallita humeda', 'babero'], priority: 10 },
  { category: 'ropa', keywords: ['remera', 'pantalon', 'jean', 'camisa', 'campera', 'saco', 'buzo', 'vestido', 'pollera', 'short', 'bermuda', 'musculosa', 'blusa', 'corbata', 'panuelo', 'cinturon', 'medias', 'calzoncillo', 'bombacha', 'corpino', 'portaslip', 'boxer', 'pijama', 'camison', 'salida de bano', 'toallon', 'toalla', 'sabanas', 'funda', 'acolchado', 'almohada'], priority: 10 },
  { category: 'muebles', keywords: ['silla', 'mesa', 'escritorio', 'sillon', 'sofa', 'cama', 'colchon', 'ropero', 'placard', 'cajonera', 'comoda', 'estante', 'biblioteca', 'mesa ratona', 'mesa luz', 'perchero', 'banco', 'banqueta', 'taburete', 'mueble tv', 'vinoteca', 'estanteria', 'escritorio computadora'], priority: 10 },
  { category: 'herramientas', keywords: ['caja herramientas', 'juego herramientas', 'set herramientas', 'organizador herramientas', 'banco trabajo', 'caballete', 'carretilla', 'escalera', 'andamio', 'trapeador', 'balde', 'secador de piso', 'hidrolavadora', 'compresor', 'generador electrico', 'grupo electrogeno'], priority: 10 },
];

function normalize(text) {
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function autoDetectCategory(canonicalName, rawName, brand) {
  const text = normalize([canonicalName, rawName, brand].filter(Boolean).join(' '));
  let bestMatch = null;

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

  return bestMatch ? bestMatch.category : null;
}
