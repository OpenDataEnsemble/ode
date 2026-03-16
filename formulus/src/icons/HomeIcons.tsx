import * as React from 'react';
import Svg, { Path } from 'react-native-svg';

export type TabIconProps = {
  width?: number;
  height?: number;
  color?: string;
};

const DEFAULT_SIZE = 24;
const STROKE_WIDTH = 2;

// Home (house) icon – shared outline for both variants
const HOME_PATH =
  'M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5V14a1 1 0 0 0-1-1h-3a1 1 0 0 0-1 1v7H5a1 1 0 0 1-1-1v-8.5Z';

// Form (file) icon shape in 24x24 coordinates, matching thin style
const FORM_PATH =
  'M7 4.75C7 4.336 7.336 4 7.75 4h7.19c.199 0 .39.079.53.22l2.56 2.56c.14.14.22.331.22.53V19.25c0 .414-.336.75-.75.75H7.75A.75.75 0 0 1 7 19.25V4.75Zm8.25.5H8.5v13h9v-9.75H15.25a.75.75 0 0 1-.75-.75V5.25Zm1.06 0 1.44 1.44H16.5v-1.44Z';

export const HomeOutlineIcon: React.FC<TabIconProps> = ({
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
  color = 'currentColor',
  ...rest
}) => (
  <Svg
    viewBox="0 0 24 24"
    width={width}
    height={height}
    fill="none"
    {...rest}>
    <Path
      d={HOME_PATH}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FormOutlineIcon: React.FC<TabIconProps> = ({
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
  color = 'currentColor',
  ...rest
}) => (
  <Svg
    viewBox="0 0 24 24"
    width={width}
    height={height}
    fill="none"
    {...rest}>
    <Path
      d={FORM_PATH}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FormSolidIcon: React.FC<TabIconProps> = ({
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
  color = 'currentColor',
  ...rest
}) => (
  <Svg
    viewBox="0 0 24 24"
    width={width}
    height={height}
    fill="none"
    {...rest}>
    <Path
      d={FORM_PATH}
      fill={color}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const HomeSolidIcon: React.FC<TabIconProps> = ({
  width = DEFAULT_SIZE,
  height = DEFAULT_SIZE,
  color = 'currentColor',
  ...rest
}) => (
  <Svg
    viewBox="0 0 24 24"
    width={width}
    height={height}
    fill="none"
    {...rest}>
    <Path
      fillRule="evenodd"
      d={HOME_PATH}
      fill={color}
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);
