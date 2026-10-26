# Divyajeet Panda — Portfolio

Personal site for my work as a software engineer on backend and data systems.

**Live:** [divyajeet.netlify.app](https://divyajeet.netlify.app)

![Version](https://img.shields.io/badge/Version-2.0.0-blue)
[![Netlify Status](https://api.netlify.com/api/v1/badges/e1fcaf21-9354-40c6-8ec1-857f83a385c5/deploy-status)](https://app.netlify.com/sites/divyajeet/deploys)

## What's on the site

- **Hero** with an interactive 3D character (Three.js + a `.glb` model) that idles, follows the cursor and waves when you start scrolling
- **About** and **What I do**: backend & data, graph & AI
- **Experience** timeline
- **Selected work**: Olist Query Studio, Bug2JSON, Sort-Downloads and others, with live screenshots
- **Certifications**: Microsoft Applied Skills, Neo4j, HackerRank and Udemy, with links to verify each one
- **Resume** preview and PDF download
- **Education & awards**, including the gold medal card that shows convocation photos on hover
- **Contact** form (Netlify Forms) with an animated name heading, plus a back-to-top button

The site uses a dark plum/lavender theme, Geist and Geist Mono fonts, and GSAP ScrollTrigger reveals. If the browser asks for reduced motion, the animations are turned off.

## Stack

Plain HTML, CSS and JavaScript. Nothing gets built at deploy time.

| Area | Used |
|------|------|
| Markup & styles | `index.html`, `css/site.css` |
| Scripts | `js/site.js` (page behaviour), `js/avatar.js` (3D avatar) |
| Libraries (self-hosted) | GSAP 3.12.5 + ScrollTrigger, Three.js + GLTFLoader |
| Hosting | Netlify (auto-deploys from `main`), cache rules in `_headers` |

## Running locally

```bash
git clone https://github.com/Divyajeet7978/Portfolio_Redesigned.git
cd Portfolio_Redesigned
npx serve .   # or any static server
```

Use a local server, not `file://`. The browser blocks the avatar model from loading over `file://`.

## Project structure

```
├── index.html
├── css/site.css          # Design tokens, layout, animations
├── js/site.js            # Reveals, nav, contact form, effects
├── js/avatar.js          # Three.js avatar
├── img/                  # Project images, photos, avatar.glb
├── fonts/                # Self-hosted font subsets
├── vendor/               # GSAP and Three.js
├── Divyajeet_Panda_Resume.pdf
└── _headers              # Netlify cache headers
```

## Milestones

### v1: glassmorphism build (up to September 2026)

The previous version used an indigo/purple glassmorphism design and a light/dark theme switcher, with a particle canvas behind it.

<div align="center">
  <img src="img/screenshot-light.webp" width="45%" alt="Previous build, light theme">
  <img src="img/screenshot-dark.webp" width="45%" alt="Previous build, dark theme">
</div>

### v2: current redesign (October 2026)

Rebuilt with a dark plum/lavender look, a 3D avatar in the hero, edge-glow cards and rewritten copy. See it [live](https://divyajeet.netlify.app).

## Credits

3D character: [Hoodie Character](https://poly.pizza/m/gKLBoRsyKe) by Quaternius (public domain, CC0).

## Contact

divyajeetpanda@outlook.com
