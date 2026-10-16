import type { ImageSourcePropType } from 'react-native';

/**
 * Generic, unbranded photos for the sample catalogue in `demoProducts.ts`.
 * Real products use the backend `imageUrl` instead.
 */
const DEMO_PRODUCT_ART: Record<string, ImageSourcePropType> = {
  'demo-cement-opc53': require('../../assets/images/subcategories/opc-cement.jpg'),
  'demo-cement-ppc': require('../../assets/images/subcategories/ppc-cement.jpg'),
  'demo-gypsum-plaster': require('../../assets/images/subcategories/gypsum-plaster.jpg'),
  'demo-white-cement': require('../../assets/images/subcategories/white-cement.jpg'),
  'demo-tile-grout': require('../../assets/images/subcategories/tile-grout.jpg'),
  'demo-wall-tile': require('../../assets/images/subcategories/wall-tiles.jpg'),
  'demo-tile-spacers': require('../../assets/images/subcategories/tile-spacers.jpg'),
  'demo-exterior-emulsion': require('../../assets/images/subcategories/exterior-emulsion.jpg'),
  'demo-mdf-board': require('../../assets/images/subcategories/mdf-board.jpg'),
  'demo-wash-basin': require('../../assets/images/subcategories/wash-basins.jpg'),
  'demo-drawer-channel': require('../../assets/images/subcategories/drawer-channels.jpg'),
  'demo-door-handle': require('../../assets/images/subcategories/door-handles.jpg'),
  'demo-measuring-tape': require('../../assets/images/subcategories/measuring-tapes.jpg'),
  'demo-crack-filler': require('../../assets/images/subcategories/crack-filler.jpg'),
  'demo-wall-putty': require('../../assets/images/subcategories/wall-putty.jpg'),
  'demo-floor-tile': require('../../assets/images/subcategories/floor-tiles.jpg'),
  'demo-pvc-pipe': require('../../assets/images/subcategories/pvc-pipes.jpg'),
  'demo-led-bulb': require('../../assets/images/subcategories/led-bulbs.jpg'),
  'demo-mortise-lock': require('../../assets/images/subcategories/mortise-locks.jpg'),
  'demo-tile-adhesive': require('../../assets/images/subcategories/tile-adhesive.jpg'),
  'demo-safety-helmet': require('../../assets/images/subcategories/safety-helmets.jpg'),
  'demo-waterproof-coat': require('../../assets/images/subcategories/waterproof-coating.jpg'),
  'demo-claw-hammer': require('../../assets/images/subcategories/hammers.jpg'),
  'demo-cabinet-hinge': require('../../assets/images/subcategories/cabinet-hinges.jpg'),
  'demo-bwp-plywood': require('../../assets/images/subcategories/plywood.jpg'),
  'demo-wall-mixer': require('../../assets/images/subcategories/taps-mixers.jpg'),
  'demo-silicone-sealant': require('../../assets/images/subcategories/silicone-sealant.jpg'),
  'demo-modular-switch': require('../../assets/images/subcategories/switches.jpg'),
  'demo-copper-wire': require('../../assets/images/subcategories/wires-cables.jpg'),
  'demo-led-batten': require('../../assets/images/subcategories/led-battens.jpg'),
  'demo-ball-valve': require('../../assets/images/subcategories/ball-valves.jpg'),
  'demo-cpvc-elbow': require('../../assets/images/subcategories/cpvc-fittings.jpg'),
  'demo-solvent-cement': require('../../assets/images/subcategories/solvent-cement.jpg'),
  'demo-interior-emulsion': require('../../assets/images/subcategories/interior-emulsion.jpg'),
  'demo-wall-primer': require('../../assets/images/subcategories/primer.jpg'),
};

export function getDemoProductArt(productId: string): ImageSourcePropType | undefined {
  return DEMO_PRODUCT_ART[productId];
}
