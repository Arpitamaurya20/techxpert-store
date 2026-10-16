import type { Brand } from '@/types/catalog';

/**
 * DEMO DATA — brand names supplied by the store owner for layout, not yet
 * confirmed against live inventory. Used only while EXPO_PUBLIC_API_BASE_URL
 * is not set; the real list (with licensed logos) must come from
 * `GET /catalog/brands`. No logos are bundled because they are trademarks.
 */
export const DEMO_BRANDS: Brand[] = [
  { id: 'hettich', name: 'Hettich' },
  { id: 'action-tesa', name: 'Action TESA' },
  { id: 'araldite', name: 'Araldite' },
  { id: 'bosch', name: 'Bosch' },
  { id: 'centuryply', name: 'CenturyPly' },
  { id: 'fevicol', name: 'Fevicol' },
  { id: 'fevikwik', name: 'Fevikwik' },
  { id: 'freemans', name: 'Freemans' },
  { id: 'philips', name: 'Philips' },
  { id: 'polycab', name: 'Polycab' },
  { id: 'roff', name: 'Roff' },
  { id: 'schneider', name: 'Schneider' },
  { id: 'ultratech', name: 'UltraTech' },
  { id: 'dr-fixit', name: 'Dr. Fixit' },
  { id: 'myk-laticrete', name: 'MYK Laticrete' },
  { id: 'jaquar', name: 'Jaquar' },
  { id: 'berger', name: 'Berger' },
  { id: 'anchor-panasonic', name: 'Anchor By Panasonic' },
  { id: 'jk-lakshmi-cement', name: 'JK Lakshmi Cement' },
  { id: 'sakarni', name: 'Sakarni' },
  { id: 'dorset', name: 'Dorset' },
  { id: 'crompton', name: 'Crompton' },
  { id: 'pidilite', name: 'Pidilite' },
  { id: 'asian-paints', name: 'Asian Paints' },
  { id: 'birla-opus', name: 'Birla Opus' },
  { id: 'ecolink', name: 'EcoLink' },
  { id: 'astral-adhesives', name: 'Astral Adhesives' },
  { id: 'havells', name: 'Havells' },
  { id: 'wacker-chemie', name: 'Wacker Chemie AG' },
  { id: 'nippon-paint', name: 'Nippon Paint' },
];
