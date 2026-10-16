import type { ImageSourcePropType } from 'react-native';

/**
 * Local generic product photos for Categories tiles, keyed by sub-category
 * id. Plain, unbranded packaging only. When the API sends `imageUrl`, that
 * is used instead.
 */
const SUBCATEGORY_ART: Record<string, ImageSourcePropType> = {
  'opc-cement': require('../../assets/images/subcategories/opc-cement.jpg'),
  'ppc-cement': require('../../assets/images/subcategories/ppc-cement.jpg'),
  'white-cement': require('../../assets/images/subcategories/white-cement.jpg'),
  'gypsum-plaster': require('../../assets/images/subcategories/gypsum-plaster.jpg'),
  'tile-grout': require('../../assets/images/subcategories/tile-grout.jpg'),
  'wall-tiles': require('../../assets/images/subcategories/wall-tiles.jpg'),
  'floor-tiles': require('../../assets/images/subcategories/floor-tiles.jpg'),
  'tile-spacers': require('../../assets/images/subcategories/tile-spacers.jpg'),
  'wall-putty': require('../../assets/images/subcategories/wall-putty.jpg'),
  'interior-emulsion': require('../../assets/images/subcategories/interior-emulsion.jpg'),
  'exterior-emulsion': require('../../assets/images/subcategories/exterior-emulsion.jpg'),
  primer: require('../../assets/images/subcategories/primer.jpg'),
  plywood: require('../../assets/images/subcategories/plywood.jpg'),
  'mdf-board': require('../../assets/images/subcategories/mdf-board.jpg'),
  laminates: require('../../assets/images/subcategories/laminates.jpg'),
  'block-board': require('../../assets/images/subcategories/block-board.jpg'),
  'tile-adhesive': require('../../assets/images/subcategories/tile-adhesive.jpg'),
  'silicone-sealant': require('../../assets/images/subcategories/silicone-sealant.jpg'),
  'wood-adhesive': require('../../assets/images/subcategories/wood-adhesive.jpg'),
  'epoxy-putty': require('../../assets/images/subcategories/epoxy-putty.jpg'),
  'led-bulbs': require('../../assets/images/subcategories/led-bulbs.jpg'),
  'led-battens': require('../../assets/images/subcategories/led-battens.jpg'),
  switches: require('../../assets/images/subcategories/switches.jpg'),
  'wires-cables': require('../../assets/images/subcategories/wires-cables.jpg'),
  'wash-basins': require('../../assets/images/subcategories/wash-basins.jpg'),
  'taps-mixers': require('../../assets/images/subcategories/taps-mixers.jpg'),
  showers: require('../../assets/images/subcategories/showers.jpg'),
  'bath-accessories': require('../../assets/images/subcategories/bath-accessories.jpg'),
  'cabinet-hinges': require('../../assets/images/subcategories/cabinet-hinges.jpg'),
  'drawer-channels': require('../../assets/images/subcategories/drawer-channels.jpg'),
  'cabinet-handles': require('../../assets/images/subcategories/cabinet-handles.jpg'),
  'tower-bolts': require('../../assets/images/subcategories/tower-bolts.jpg'),
  'mortise-locks': require('../../assets/images/subcategories/mortise-locks.jpg'),
  'door-handles': require('../../assets/images/subcategories/door-handles.jpg'),
  padlocks: require('../../assets/images/subcategories/padlocks.jpg'),
  'door-stoppers': require('../../assets/images/subcategories/door-stoppers.jpg'),
  'pvc-pipes': require('../../assets/images/subcategories/pvc-pipes.jpg'),
  'cpvc-fittings': require('../../assets/images/subcategories/cpvc-fittings.jpg'),
  'ball-valves': require('../../assets/images/subcategories/ball-valves.jpg'),
  'solvent-cement': require('../../assets/images/subcategories/solvent-cement.jpg'),
  'waterproof-coating': require('../../assets/images/subcategories/waterproof-coating.jpg'),
  'crack-filler': require('../../assets/images/subcategories/crack-filler.jpg'),
  membranes: require('../../assets/images/subcategories/membranes.jpg'),
  admixtures: require('../../assets/images/subcategories/admixtures.jpg'),
  'measuring-tapes': require('../../assets/images/subcategories/measuring-tapes.jpg'),
  hammers: require('../../assets/images/subcategories/hammers.jpg'),
  'power-drills': require('../../assets/images/subcategories/power-drills.jpg'),
  screwdrivers: require('../../assets/images/subcategories/screwdrivers.jpg'),
  'safety-helmets': require('../../assets/images/subcategories/safety-helmets.jpg'),
  'safety-gloves': require('../../assets/images/subcategories/safety-gloves.jpg'),
  'safety-shoes': require('../../assets/images/subcategories/safety-shoes.jpg'),
  'safety-goggles': require('../../assets/images/subcategories/safety-goggles.jpg'),
};

export function getSubcategoryArt(subcategoryId: string): ImageSourcePropType | undefined {
  return SUBCATEGORY_ART[subcategoryId];
}
