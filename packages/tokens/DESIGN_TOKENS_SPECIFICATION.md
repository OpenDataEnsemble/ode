# ODE Design Tokens - Complete Specification

This document provides the complete specification for all design tokens in the ODE Design System. For quick reference and usage examples, see the [README.md](./README.md#quick-start).

## Table of Contents

1. [Color Tokens](#1-color-tokens)
2. [Typography Tokens](#2-typography-tokens)
3. [Spacing Tokens](#3-spacing-tokens)
4. [Border Tokens](#4-border-tokens)
5. [Shadow Tokens](#5-shadow-tokens)
6. [Motion Tokens](#6-motion-tokens)
7. [Layout Tokens](#7-layout-tokens)
8. [Icon & Asset Tokens](#8-icon--asset-tokens)
9. [Z-Index Tokens](#9-z-index-tokens)
10. [Accessibility Tokens](#10-accessibility-tokens)
11. [Opacity Tokens](#11-opacity-tokens)

---

## 1. Color Tokens

### 1.1 Brand Colors

Based on the ODE logo colors.

#### Primary (Green) Scale

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-brand-primary-50` | `#F0F7EF` | Lightest background |
| 100 | `color-brand-primary-100` | `#D9E9D8` | Subtle backgrounds |
| 200 | `color-brand-primary-200` | `#B9D5B8` | Dividers, borders |
| 300 | `color-brand-primary-300` | `#90BD8F` | Disabled states |
| 400 | `color-brand-primary-400` | `#6FA46E` | Hover states |
| 500 | `color-brand-primary-500` | `#4F7F4E` | **PRIMARY BRAND** |
| 600 | `color-brand-primary-600` | `#3F6A3E` | Pressed states |
| 700 | `color-brand-primary-700` | `#30552F` | Dark mode text |
| 800 | `color-brand-primary-800` | `#224021` | Dark mode backgrounds |
| 900 | `color-brand-primary-900` | `#173016` | Darkest elements |

#### Secondary (Gold) Scale

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-brand-secondary-50` | `#FEF9EE` | Light backgrounds |
| 100 | `color-brand-secondary-100` | `#FCEFD2` | Subtle accents |
| 200 | `color-brand-secondary-200` | `#F9E0A8` | Light borders |
| 300 | `color-brand-secondary-300` | `#F5CC75` | Medium accents |
| 400 | `color-brand-secondary-400` | `#F0B84D` | Hover states |
| 500 | `color-brand-secondary-500` | `#E9B85B` | **SECONDARY BRAND** |
| 600 | `color-brand-secondary-600` | `#D9A230` | Active states |
| 700 | `color-brand-secondary-700` | `#B8861C` | Important accents |
| 800 | `color-brand-secondary-800` | `#976D1A` | Dark borders |
| 900 | `color-brand-secondary-900` | `#7C5818` | Darkest accents |

### 1.2 Neutral Colors

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| White | `color-neutral-white` | `#FFFFFF` | Pure white |
| 50 | `color-neutral-50` | `#FAFAFA` | Backgrounds |
| 100 | `color-neutral-100` | `#F5F5F5` | Subtle backgrounds |
| 200 | `color-neutral-200` | `#EEEEEE` | Dividers, borders |
| 300 | `color-neutral-300` | `#E0E0E0` | Disabled elements |
| 400 | `color-neutral-400` | `#BDBDBD` | Placeholder text |
| 500 | `color-neutral-500` | `#9E9E9E` | Secondary text |
| 600 | `color-neutral-600` | `#757575` | Body text |
| 700 | `color-neutral-700` | `#616161` | Primary text |
| 800 | `color-neutral-800` | `#424242` | Headings |
| 900 | `color-neutral-900` | `#212121` | Main headings |
| Black | `color-neutral-black` | `#000000` | Pure black |

### 1.3 Semantic Colors

#### Success

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-semantic-success-50` | `#F0F9F0` | Success backgrounds |
| 500 | `color-semantic-success-500` | `#34C759` | Success messages |
| 600 | `color-semantic-success-600` | `#2E7D32` | Success borders |

#### Error

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-semantic-error-50` | `#FEF2F2` | Error backgrounds |
| 500 | `color-semantic-error-500` | `#F44336` | Error messages |
| 600 | `color-semantic-error-600` | `#DC2626` | Critical errors |

#### Warning

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-semantic-warning-50` | `#FFFBEB` | Warning backgrounds |
| 500 | `color-semantic-warning-500` | `#FF9500` | Warning messages |
| 600 | `color-semantic-warning-600` | `#D97706` | Important warnings |

#### Info

| Shade | Token | Hex Value | Usage |
|-------|-------|-----------|-------|
| 50 | `color-semantic-info-50` | `#EFF6FF` | Info backgrounds |
| 500 | `color-semantic-info-500` | `#2196F3` | Info messages |
| 600 | `color-semantic-info-600` | `#2563EB` | Important info |

---

## 2. Typography Tokens

### 2.1 Font Families

| Token | Value | Usage |
|-------|-------|-------|
| `font-family-sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif` | Primary UI text |
| `font-family-mono` | `'Courier New', Consolas, monospace` | Code, technical text |
| `font-family-display` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` | Headings, titles |

### 2.2 Font Sizes

| Size | Token | Pixels | REM | Usage Example |
|------|-------|--------|-----|---------------|
| Extra Small | `font-size-xs` | 12px | 0.75rem | Labels, captions |
| Small | `font-size-sm` | 14px | 0.875rem | Small body text |
| Base | `font-size-base` | 16px | 1rem | **Body text** |
| Large | `font-size-lg` | 18px | 1.125rem | Lead paragraphs |
| Extra Large | `font-size-xl` | 20px | 1.25rem | Subheadings |
| 2X Large | `font-size-2xl` | 24px | 1.5rem | H4 headings |
| 3X Large | `font-size-3xl` | 32px | 2rem | H3 headings |
| 4X Large | `font-size-4xl` | 40px | 2.5rem | H2 headings |
| 5X Large | `font-size-5xl` | 48px | 3rem | H1 headings |
| 6X Large | `font-size-6xl` | 60px | 3.75rem | Hero headings |

### 2.3 Font Weights

| Token | Value | Usage |
|-------|-------|-------|
| `font-weight-light` | 300 | Light headings |
| `font-weight-regular` | 400 | **Body text** |
| `font-weight-medium` | 500 | Buttons, labels |
| `font-weight-semibold` | 600 | Subheadings |
| `font-weight-bold` | 700 | Main headings |

### 2.4 Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `line-height-none` | 1 | Tight (titles) |
| `line-height-tight` | 1.25 | Headings |
| `line-height-normal` | 1.5 | **Body text** |
| `line-height-relaxed` | 1.75 | Long paragraphs |
| `line-height-loose` | 2 | Poetry, quotes |

### 2.5 Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `letter-spacing-tighter` | -0.05em | Very tight (headings) |
| `letter-spacing-tight` | -0.025em | Tight (large text) |
| `letter-spacing-normal` | 0 | **Default spacing** |
| `letter-spacing-wide` | 0.025em | Slightly wider |
| `letter-spacing-wider` | 0.05em | Wider (uppercase text) |
| `letter-spacing-widest` | 0.1em | Very wide (labels) |

---

## 3. Spacing Tokens

### 3.1 Base Unit System

- **Base Unit**: 4px (0.25rem)
- **Scale**: Multiples of 4px

### 3.2 Spacing Scale

| Size | Token | Pixels | REM | Common Use |
|------|-------|--------|-----|------------|
| 0 | `spacing-0` | 0px | 0rem | No space |
| 1 | `spacing-1` | 4px | 0.25rem | Tight padding |
| 2 | `spacing-2` | 8px | 0.5rem | Small padding |
| 3 | `spacing-3` | 12px | 0.75rem | Button padding |
| 4 | `spacing-4` | 16px | 1rem | **Default spacing** |
| 6 | `spacing-6` | 24px | 1.5rem | Section padding |
| 8 | `spacing-8` | 32px | 2rem | Container padding |
| 10 | `spacing-10` | 40px | 2.5rem | Large padding |
| 12 | `spacing-12` | 48px | 3rem | Page margins |
| 16 | `spacing-16` | 64px | 4rem | Section margins |
| 20 | `spacing-20` | 80px | 5rem | Large margins |
| 24 | `spacing-24` | 96px | 6rem | Hero margins |

---

## 4. Border Tokens

### 4.1 Border Radius

| Size | Token | Value | Usage |
|------|-------|-------|-------|
| None | `border-radius-none` | 0px | Square elements |
| Small | `border-radius-sm` | 4px | Inputs, small buttons |
| Medium | `border-radius-md` | 8px | **Buttons, cards** |
| Large | `border-radius-lg` | 12px | Modals, large cards |
| Extra Large | `border-radius-xl` | 16px | Hero sections |
| Full | `border-radius-full` | 9999px | Pills, circles |

### 4.2 Border Width

| Token | Value | Usage |
|-------|-------|-------|
| `border-width-none` | 0px | No border |
| `border-width-hairline` | 0.5px | Subtle dividers |
| `border-width-thin` | 1px | **Default borders** |
| `border-width-medium` | 2px | Focus states |
| `border-width-thick` | 3px | Important elements |

---

## 5. Shadow Tokens

### 5.1 Shadow Scale (Web)

| Level | Token | CSS Value | Usage |
|-------|-------|-----------|-------|
| None | `shadow-none` | `none` | No shadow |
| X-Small | `shadow-xs` | `0 1px 2px 0 rgba(0,0,0,0.05)` | Subtle elevation |
| Small | `shadow-sm` | `0 1px 3px 0 rgba(0,0,0,0.1)` | Cards, inputs |
| Medium | `shadow-md` | `0 4px 6px -1px rgba(0,0,0,0.1)` | **Dropdowns** |
| Large | `shadow-lg` | `0 10px 15px -3px rgba(0,0,0,0.1)` | Modals |
| X-Large | `shadow-xl` | `0 20px 25px -5px rgba(0,0,0,0.1)` | Popovers |
| 2X-Large | `shadow-2xl` | `0 25px 50px -12px rgba(0,0,0,0.25)` | Dialogs |

### 5.2 React Native Shadows

React Native uses a different shadow format with separate properties:

- `shadowColor`: Color of the shadow
- `shadowOffset`: { width, height } offset
- `shadowOpacity`: Opacity (0-1)
- `shadowRadius`: Blur radius
- `elevation`: Android elevation

See `src/tokens/base/shadows-react-native.json` for React Native shadow definitions.

---

## 6. Motion Tokens

### 6.1 Duration Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `duration-instant` | 0ms | Immediate changes |
| `duration-fast` | 150ms | Hover states |
| `duration-normal` | 250ms | **Default transitions** |
| `duration-slow` | 350ms | Modal animations |
| `duration-slower` | 500ms | Page transitions |

### 6.2 Easing Functions

| Token | Value | Usage |
|-------|-------|-------|
| `easing-linear` | `linear` | Progress bars |
| `easing-easeIn` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting elements |
| `easing-easeOut` | `cubic-bezier(0, 0, 0.2, 1)` | **Entering elements** |
| `easing-easeInOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default transitions |

---

## 7. Layout Tokens

### 7.1 Breakpoints

| Name | Token | Value | Device Type |
|------|-------|-------|-------------|
| Mobile | `breakpoint-sm` | 640px | Small phones |
| Tablet | `breakpoint-md` | 768px | Large phones, small tablets |
| Desktop | `breakpoint-lg` | 1024px | Tablets, small laptops |
| Large Desktop | `breakpoint-xl` | 1280px | **Laptops** |
| Extra Large | `breakpoint-2xl` | 1536px | Large monitors |

### 7.2 Container Max Widths

| Size | Token | Value | Usage |
|------|-------|-------|-------|
| Small | `container-sm` | 640px | Mobile content |
| Medium | `container-md` | 768px | Tablet content |
| Large | `container-lg` | 1024px | Desktop content |
| Extra Large | `container-xl` | 1280px | **Default container** |
| 2X Large | `container-2xl` | 1536px | Wide screens |

### 7.3 Grid System

| Token | Value | Usage |
|-------|-------|-------|
| `grid-columns` | 12 | **Total columns in grid** |
| `grid-gutter` | `{spacing.4}` | Space between columns (16px) |
| `grid-gutterSm` | `{spacing.2}` | Small gutter (8px) |
| `grid-gutterLg` | `{spacing.6}` | Large gutter (24px) |

---

## 8. Icon & Asset Tokens

### 8.1 Icon Sizes

| Size | Token | Pixels | Usage |
|------|-------|--------|-------|
| Extra Small | `icon-size-xs` | 12px | Inline with small text |
| Small | `icon-size-sm` | 16px | Buttons, labels |
| Medium | `icon-size-md` | 20px | **Default icon size** |
| Large | `icon-size-lg` | 24px | Navigation, headers |
| Extra Large | `icon-size-xl` | 32px | Feature icons |
| 2X Large | `icon-size-2xl` | 40px | Hero sections |
| 3X Large | `icon-size-3xl` | 48px | Large feature icons |

### 8.2 Icon Stroke Width

| Token | Value | Usage |
|-------|-------|-------|
| `icon-stroke-thin` | 1px | Small icons (12-16px) |
| `icon-stroke-normal` | 1.5px | **Default (20-24px)** |
| `icon-stroke-medium` | 2px | Large icons (32px+) |
| `icon-stroke-thick` | 2.5px | Very large icons (48px+) |

### 8.3 Avatar Sizes

| Size | Token | Pixels | Usage |
|------|-------|--------|-------|
| Small | `avatar-sm` | 24px | Comments, lists |
| Medium | `avatar-md` | 32px | **Default avatar** |
| Large | `avatar-lg` | 48px | Profile pages |
| Extra Large | `avatar-xl` | 64px | Hero sections |
| 2X Large | `avatar-2xl` | 96px | Large profiles |

### 8.4 Logo Sizes

| Size | Token | Pixels | Usage |
|------|-------|--------|-------|
| Small | `logo-sm` | 80px | Mobile header |
| Medium | `logo-md` | 120px | **Default logo** |
| Large | `logo-lg` | 160px | Desktop header |
| Extra Large | `logo-xl` | 200px | Landing pages |

---

## 9. Z-Index Tokens

### 9.1 Layering System

| Layer | Token | Value | Usage |
|-------|-------|-------|-------|
| Hide | `z-index-hide` | -1 | Hidden elements |
| Base | `z-index-base` | 0 | Default layer |
| Docked | `z-index-docked` | 10 | Fixed headers |
| Dropdown | `z-index-dropdown` | 1000 | Dropdown menus |
| Sticky | `z-index-sticky` | 1100 | Sticky elements |
| Overlay | `z-index-overlay` | 1300 | Backdrops |
| Modal | `z-index-modal` | 1400 | Modal dialogs |
| Popover | `z-index-popover` | 1500 | Tooltips, popovers |
| Toast | `z-index-toast` | 1700 | Notifications |
| Tooltip | `z-index-tooltip` | 1800 | Tooltips (above all) |

---

## 10. Accessibility Tokens

### 10.1 Color Contrast Ratios

| WCAG Level | Token | Ratio | Usage |
|------------|-------|-------|-------|
| AA Large Text | `contrast-aaLarge` | 3:1 | Headings 18px+ or bold 14px+ |
| AA Normal Text | `contrast-aaNormal` | 4.5:1 | **Body text (minimum)** |
| AAA Large Text | `contrast-aaaLarge` | 4.5:1 | Headings (enhanced) |
| AAA Normal Text | `contrast-aaaNormal` | 7:1 | Body text (enhanced) |

### 10.2 Focus States

| Token | Value | Usage |
|-------|-------|-------|
| `focus-ringWidth` | 2px | **Focus ring thickness** |
| `focus-ringOffset` | 2px | Space between element and ring |
| `focus-ringColor` | `{color.brand.primary.500}` | Focus ring color |
| `focus-ringOpacity` | `{opacity.100}` | Focus ring opacity |

### 10.3 Touch Target Sizes

| Token | Value | Usage |
|-------|-------|-------|
| `touchTarget-min` | 44px | **Minimum size (iOS/Android)** |
| `touchTarget-comfortable` | 48px | Comfortable size |
| `touchTarget-large` | 56px | Large buttons |

---

## 11. Opacity Tokens

### 11.1 Opacity Scale

| Token | Value | Usage |
|-------|-------|-------|
| `opacity-0` | 0 | Completely transparent |
| `opacity-10` | 0.1 | Very subtle overlay |
| `opacity-20` | 0.2 | Light overlay |
| `opacity-30` | 0.3 | Medium overlay |
| `opacity-40` | 0.4 | Noticeable overlay |
| `opacity-50` | 0.5 | **Half transparent** |
| `opacity-60` | 0.6 | More visible |
| `opacity-70` | 0.7 | Mostly opaque |
| `opacity-80` | 0.8 | Very visible |
| `opacity-90` | 0.9 | Almost solid |
| `opacity-100` | 1 | Completely solid |

---

## Token Naming Convention

All tokens follow this pattern:

```
{category}-{property}-{variant}-{scale}
```

**Examples:**
- `color-brand-primary-500` (category: color, property: brand, variant: primary, scale: 500)
- `spacing-4` (category: spacing, scale: 4)
- `font-size-base` (category: font, property: size, variant: base)
- `border-radius-md` (category: border, property: radius, variant: md)

---

**Document Version**: 1.0.0  
**Last Updated**: 2024  
**Maintained By**: ODE Design System Team

