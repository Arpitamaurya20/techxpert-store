import type { Subcategory } from '@/types/catalog';

/**
 * DEMO DATA — proposed product types only, not confirmed live inventory.
 * Used only while EXPO_PUBLIC_API_BASE_URL is not set. The real list must
 * come from the backend (`GET /catalog/subcategories`).
 */
export const DEMO_SUBCATEGORIES: Subcategory[] = [
  { id: 'opc-cement', categoryId: 'cement-plaster', name: 'OPC Cement', searchTerm: 'opc' },
  { id: 'ppc-cement', categoryId: 'cement-plaster', name: 'PPC Cement', searchTerm: 'ppc' },
  { id: 'white-cement', categoryId: 'cement-plaster', name: 'White Cement' },
  { id: 'gypsum-plaster', categoryId: 'cement-plaster', name: 'Gypsum Plaster', searchTerm: 'gypsum' },

  { id: 'tile-grout', categoryId: 'tiling-grouts', name: 'Tile Grout', searchTerm: 'grout' },
  { id: 'wall-tiles', categoryId: 'tiling-grouts', name: 'Wall Tiles', searchTerm: 'wall tile' },
  { id: 'floor-tiles', categoryId: 'tiling-grouts', name: 'Floor Tiles', searchTerm: 'floor tile' },
  { id: 'tile-spacers', categoryId: 'tiling-grouts', name: 'Tile Spacers', searchTerm: 'spacers' },

  { id: 'wall-putty', categoryId: 'paints-putty', name: 'Wall Putty', searchTerm: 'putty' },
  { id: 'interior-emulsion', categoryId: 'paints-putty', name: 'Interior Emulsion', searchTerm: 'interior' },
  { id: 'exterior-emulsion', categoryId: 'paints-putty', name: 'Exterior Emulsion', searchTerm: 'exterior' },
  { id: 'primer', categoryId: 'paints-putty', name: 'Primer' },

  { id: 'plywood', categoryId: 'plywood-mdf', name: 'Plywood' },
  { id: 'mdf-board', categoryId: 'plywood-mdf', name: 'MDF Board', searchTerm: 'mdf' },
  { id: 'laminates', categoryId: 'plywood-mdf', name: 'Laminates', searchTerm: 'laminate' },
  { id: 'block-board', categoryId: 'plywood-mdf', name: 'Block Board' },

  { id: 'tile-adhesive', categoryId: 'adhesives-sealants', name: 'Tile Adhesive' },
  { id: 'silicone-sealant', categoryId: 'adhesives-sealants', name: 'Silicone Sealant', searchTerm: 'silicone' },
  { id: 'wood-adhesive', categoryId: 'adhesives-sealants', name: 'Wood Adhesive' },
  { id: 'epoxy-putty', categoryId: 'adhesives-sealants', name: 'Epoxy Putty' },

  { id: 'led-bulbs', categoryId: 'electricals-lighting', name: 'LED Bulbs', searchTerm: 'bulb' },
  { id: 'led-battens', categoryId: 'electricals-lighting', name: 'LED Battens', searchTerm: 'batten' },
  { id: 'switches', categoryId: 'electricals-lighting', name: 'Switches', searchTerm: 'switch' },
  { id: 'wires-cables', categoryId: 'electricals-lighting', name: 'Wires & Cables', searchTerm: 'wire' },

  { id: 'wash-basins', categoryId: 'bath-sanitary', name: 'Wash Basins', searchTerm: 'basin' },
  { id: 'taps-mixers', categoryId: 'bath-sanitary', name: 'Taps & Mixers', searchTerm: 'mixer' },
  { id: 'showers', categoryId: 'bath-sanitary', name: 'Showers', searchTerm: 'shower' },
  { id: 'bath-accessories', categoryId: 'bath-sanitary', name: 'Bath Accessories', searchTerm: 'accessories' },

  { id: 'cabinet-hinges', categoryId: 'furniture-fittings', name: 'Cabinet Hinges', searchTerm: 'hinge' },
  { id: 'drawer-channels', categoryId: 'furniture-fittings', name: 'Drawer Channels', searchTerm: 'drawer channel' },
  { id: 'cabinet-handles', categoryId: 'furniture-fittings', name: 'Cabinet Handles', searchTerm: 'cabinet handle' },
  { id: 'tower-bolts', categoryId: 'furniture-fittings', name: 'Tower Bolts', searchTerm: 'tower bolt' },

  { id: 'mortise-locks', categoryId: 'locks-handles', name: 'Mortise Locks', searchTerm: 'mortise' },
  { id: 'door-handles', categoryId: 'locks-handles', name: 'Door Handles', searchTerm: 'handle' },
  { id: 'padlocks', categoryId: 'locks-handles', name: 'Padlocks', searchTerm: 'padlock' },
  { id: 'door-stoppers', categoryId: 'locks-handles', name: 'Door Stoppers', searchTerm: 'stopper' },

  { id: 'pvc-pipes', categoryId: 'plumbing-supplies', name: 'PVC Pipes', searchTerm: 'pvc pipe' },
  { id: 'cpvc-fittings', categoryId: 'plumbing-supplies', name: 'CPVC Fittings', searchTerm: 'cpvc' },
  { id: 'ball-valves', categoryId: 'plumbing-supplies', name: 'Ball Valves', searchTerm: 'valve' },
  { id: 'solvent-cement', categoryId: 'plumbing-supplies', name: 'Solvent Cement', searchTerm: 'solvent' },

  { id: 'waterproof-coating', categoryId: 'waterproofing', name: 'Waterproof Coating', searchTerm: 'coating' },
  { id: 'crack-filler', categoryId: 'waterproofing', name: 'Crack Filler', searchTerm: 'crack' },
  { id: 'membranes', categoryId: 'waterproofing', name: 'Membranes', searchTerm: 'membrane' },
  { id: 'admixtures', categoryId: 'waterproofing', name: 'Admixtures', searchTerm: 'admixture' },

  { id: 'measuring-tapes', categoryId: 'tools-accessories', name: 'Measuring Tapes', searchTerm: 'measuring tape' },
  { id: 'hammers', categoryId: 'tools-accessories', name: 'Hammers', searchTerm: 'hammer' },
  { id: 'power-drills', categoryId: 'tools-accessories', name: 'Power Drills', searchTerm: 'drill' },
  { id: 'screwdrivers', categoryId: 'tools-accessories', name: 'Screwdrivers', searchTerm: 'screwdriver' },

  { id: 'safety-helmets', categoryId: 'safety-equipment', name: 'Safety Helmets', searchTerm: 'helmet' },
  { id: 'safety-gloves', categoryId: 'safety-equipment', name: 'Safety Gloves', searchTerm: 'gloves' },
  { id: 'safety-shoes', categoryId: 'safety-equipment', name: 'Safety Shoes', searchTerm: 'shoes' },
  { id: 'safety-goggles', categoryId: 'safety-equipment', name: 'Safety Goggles', searchTerm: 'goggles' },
];
