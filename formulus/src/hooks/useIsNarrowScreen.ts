import { useWindowDimensions } from 'react-native';
import tokens from '@ode/tokens/dist/react-native/tokens-resolved';

type Tokens = {
  breakpoint?: {
    sm?: string;
  };
};

const t = tokens as Tokens;

const narrowBreakpoint = parseInt(
  String(t.breakpoint?.sm ?? '').replace('px', ''),
  10,
);
export function useIsNarrowScreen() {
  const { width } = useWindowDimensions();
  return width < narrowBreakpoint;
}
