---
name: Technical Precision
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ddb7ff'
  on-tertiary: '#490080'
  tertiary-container: '#b76dff'
  on-tertiary-container: '#400071'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#f0dbff'
  tertiary-fixed-dim: '#ddb7ff'
  on-tertiary-fixed: '#2c0051'
  on-tertiary-fixed-variant: '#6900b3'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  ui-header:
    fontFamily: Geist
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.02em
  ui-body:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  ui-label:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  code-block:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 22px
  code-bold:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 22px
  console-text:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  unit-1: 0.25rem
  unit-2: 0.5rem
  unit-4: 1rem
  sidebar-width: 260px
  panel-height-min: 180px
  gutter: 1px
---

## Brand & Style
The design system is engineered for high-focus technical environments. It targets developers and engineers who require a workspace that minimizes cognitive load while maximizing information density and clarity. 

The aesthetic is rooted in **Minimalism** with a **Corporate/Modern** technical edge. It prioritizes functionality over decoration, using subtle borders and intentional negative space to define structure. The UI evokes a sense of reliability and high performance, mirroring the precision of the code it houses. Interactive elements are distinct but understated, ensuring that the user's primary focus remains on the content.

## Colors
This design system utilizes a sophisticated dark palette designed for long-duration usage. The core foundation is built on deep charcoals and slates to reduce eye strain.

- **Primary (Electric Blue):** Used for primary actions, active states, and selection highlights.
- **Secondary (Emerald Green):** Reserved for "Run" actions, success states, and specific syntax keywords.
- **Tertiary (Soft Purple):** Used for auxiliary functions, decorators, and constants in code.
- **Neutral (Deep Slate):** Defines the environment. `#0F172A` serves as the primary canvas, while `#1E293B` provides contrast for elevated surfaces like sidebars and modals.
- **Syntax Amber:** Specifically for warnings, string literals, or specific logic operators to ensure immediate recognition.

## Typography
The typography strategy employs a dual-font approach to distinguish between the "Interface" and the "Work."

1. **Geist (UI):** A modern sans-serif optimized for legibility at small sizes. It handles all navigation, menus, and descriptive text. The tighter letter-spacing on headers maintains a sleek, technical look.
2. **JetBrains Mono (Code):** The engine of the system. It is used for all code cells, console outputs, and data-heavy tables. Its increased x-height and distinct characters prevent ambiguity in logic.

Line heights are intentionally generous in code blocks (approx. 1.6x) to facilitate scanning, while UI elements use a more compact 1.4x scale to maximize vertical density in sidebars.

## Layout & Spacing
The layout follows a **Fixed-Hybrid** model characteristic of professional IDEs. The screen is divided into functional regions:

- **Primary Sidebar:** Fixed width (260px) on the left, containing file explorers and navigation.
- **Editor Canvas:** Fluid width, expanding to fill all remaining horizontal space.
- **Utility Panels:** Dockable bottom or side areas for consoles and terminal output.

Spacing is governed by a strict 4px grid. A 1px "internal gutter" is used for dividers, often using a subtle slate border rather than whitespace to maximize the usable coding area. Horizontal padding in code cells is set to 16px to give logic room to breathe, while vertical padding in lists is kept to 8px for efficiency.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layers** and **Low-Contrast Outlines** rather than traditional drop shadows.

- **Level 0 (Background):** The darkest shade (#0F172A), used for the main editor background.
- **Level 1 (Surface):** A slightly lighter slate (#1E293B) for sidebars and top navigation bars, creating a clear container for the work area.
- **Level 2 (Active/Hover):** Interactive components use 1px solid borders (#334155) and subtle background shifts to indicate state.
- **Overlays:** Modals or dropdowns use a very soft, high-diffusion shadow (0px 10px 30px rgba(0,0,0,0.5)) and a 1px border to pop against the dark canvas. Backdrop blurs (8px) are applied to modals to maintain context without visual noise.

## Shapes
The shape language is **Soft (0.25rem)**. This subtle rounding provides a modern touch without sacrificing the "industrial" feel of a technical tool.

- **Standard Elements:** Buttons, input fields, and tags use a 4px (0.25rem) radius.
- **Containers:** Large surfaces like the editor cells or side panels maintain sharp corners or very minimal 4px clips to emphasize the grid-based structure.
- **Status Indicators:** Small circular dots are used for activity status or unsaved changes, providing a geometric contrast to the rectangular UI.

## Components
Consistent component behavior is vital for the developer experience:

- **Sidebar Navigation:** Items use a full-width background highlight on hover. Active files are indicated with a 2px vertical blue line on the left edge.
- **Code Editor Cells:** Each cell is wrapped in a subtle 1px border. The active cell receives a primary blue border.
- **'Run' Button:** A high-contrast component using the Secondary Emerald color with white or high-contrast dark text. It should include a 'play' icon for instant recognition.
- **Console Output:** Uses a slightly darker background than the editor to distinguish "Output" from "Source." Text is monospaced and smaller (12px).
- **Dropdowns:** Use the Level 2 elevation style with 4px padding between items and a clear primary-color focus state for keyboard navigation.
- **Checkboxes/Radios:** Minimalist square/circle outlines that fill with the primary blue when selected. No heavy gradients.
- **Inputs:** Dark backgrounds with a 1px border that glows (subtle outer shadow) when focused.