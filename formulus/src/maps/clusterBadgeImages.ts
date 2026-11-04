import type { ImageEntry } from '@maplibre/maplibre-react-native';
import badge2 from '../assets/map/cluster-2.png';
import badge3 from '../assets/map/cluster-3.png';
import badge4 from '../assets/map/cluster-4.png';
import badge5 from '../assets/map/cluster-5.png';
import badge6 from '../assets/map/cluster-6.png';
import badge7 from '../assets/map/cluster-7.png';
import badge8 from '../assets/map/cluster-8.png';
import badge9 from '../assets/map/cluster-9.png';
import badge10Plus from '../assets/map/cluster-10p.png';
import badge20Plus from '../assets/map/cluster-20p.png';
import badge50Plus from '../assets/map/cluster-50p.png';
import badge100Plus from '../assets/map/cluster-100p.png';
import badge200Plus from '../assets/map/cluster-200p.png';
import badge500Plus from '../assets/map/cluster-500p.png';
import badge1kPlus from '../assets/map/cluster-1kp.png';
import badge2kPlus from '../assets/map/cluster-2kp.png';
import badge5kPlus from '../assets/map/cluster-5kp.png';
import badge10kPlus from '../assets/map/cluster-10kp.png';

export const CLUSTER_BADGE_IMAGES: Record<string, ImageEntry> = {
  'cluster-2': { source: badge2 },
  'cluster-3': { source: badge3 },
  'cluster-4': { source: badge4 },
  'cluster-5': { source: badge5 },
  'cluster-6': { source: badge6 },
  'cluster-7': { source: badge7 },
  'cluster-8': { source: badge8 },
  'cluster-9': { source: badge9 },
  'cluster-10p': { source: badge10Plus },
  'cluster-20p': { source: badge20Plus },
  'cluster-50p': { source: badge50Plus },
  'cluster-100p': { source: badge100Plus },
  'cluster-200p': { source: badge200Plus },
  'cluster-500p': { source: badge500Plus },
  'cluster-1kp': { source: badge1kPlus },
  'cluster-2kp': { source: badge2kPlus },
  'cluster-5kp': { source: badge5kPlus },
  'cluster-10kp': { source: badge10kPlus },
};
