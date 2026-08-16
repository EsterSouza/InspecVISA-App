# Índice do React Bits

Gerado por `scripts/biblioteca/coletar-reactbits.mjs` a partir de `github.com/DavidHDev/react-bits`.
**Não editar à mão** — rodar o script de novo.

**166 componentes** em 4 categorias.
Cada pasta tem o `.jsx` e, quando existe, o `.css`. O caminho é
`.claude/skills/reactbits/componentes/<Categoria>/<Nome>/`.

## Só React e CSS — sem dependência externa (39)

Os únicos que entram sem somar biblioteca ao bundle.

`BorderGlow` · `ClickSpark` · `CursorGrid` · `CurvedInput` · `CurvedLoop` · `DepthText` · `DotField` · `DriftWall` · `EchoText` · `ElectricBorder` · `Folder` · `FuzzyText` · `GlareHover` · `GlassIcons` · `GlassSurface` · `GlitchText` · `GooeyNav` · `GradualBlur` · `LetterGlitch` · `Lightning` · `LineSidebar` · `LogoLoop` · `Magnet` · `MagnetLines` · `MetallicPaint` · `Noise` · `OptionWheel` · `ParticleText` · `PixelCard` · `PixelSwap` · `ProfileCard` · `ScrollExpand` · `ShapeGrid` · `SplashCursor` · `SplitFlapText` · `SpotlightCard` · `StarBorder` · `TextPressure` · `Waves`

## Dependências, e quantos componentes puxam cada uma

| Pacote | Componentes |
|---|---|
| `ogl` | 45 |
| `gsap` | 35 |
| `three` | 23 |
| `motion` | 20 |
| `@react-three/fiber` | 8 |
| `@react-three/drei` | 5 |
| `postprocessing` | 4 |
| `react-icons` | 3 |
| `@gsap/react` | 2 |
| `@react-three/postprocessing` | 1 |
| `face-api.js` | 1 |
| `@use-gesture/react` | 1 |
| `@chakra-ui/react` | 1 |
| `maath` | 1 |
| `gl-matrix` | 1 |
| `@react-three/rapier` | 1 |
| `meshline` | 1 |
| `react-router-dom` | 1 |
| `lucide-react` | 1 |
| `lenis` | 1 |
| `matter-js` | 1 |

O app **não tem nenhuma delas** hoje. Somar uma biblioteca de animação a um app
que a consultora abre em campo, no 4G, é decisão — não detalhe de implementação.

## Animacoes (37)

| Componente | Arquivos | Tamanho | Precisa de |
|---|---|---|---|
| **AnimatedContent** | jsx | 2 KB | `gsap` |
| **Antigravity** | jsx | 5 KB | `@react-three/fiber`, `three` |
| **BlobCursor** | css, jsx | 4 KB | `gsap` |
| **ClickSpark** | jsx | 4 KB | — |
| **Crosshair** | jsx | 6 KB | `gsap` |
| **Cubes** | css, jsx | 10 KB | `gsap` |
| **CursorGrid** | css, jsx | 9 KB | — |
| **ElasticMesh** | css, jsx | 17 KB | `ogl` |
| **ElectricBorder** | css, jsx | 10 KB | — |
| **FadeContent** | jsx | 2 KB | `gsap` |
| **GhostCursor** | css, jsx | 16 KB | `three` |
| **GlareHover** | css, jsx | 2 KB | — |
| **GradualBlur** | css, jsx | 9 KB | — |
| **HalftoneReveal** | css, jsx | 11 KB | `ogl` |
| **ImageTrail** | css, jsx | 37 KB | `gsap` |
| **LaserFlow** | css, jsx | 20 KB | `three` |
| **LogoLoop** | css, jsx | 14 KB | — |
| **MagicRings** | css, jsx | 9 KB | `three` |
| **Magnet** | jsx | 2 KB | — |
| **MagnetLines** | css, jsx | 2 KB | — |
| **MetaBalls** | css, jsx | 8 KB | `ogl` |
| **MetallicPaint** | css, jsx | 15 KB | — |
| **Noise** | css, jsx | 2 KB | — |
| **OrbitImages** | css, jsx | 9 KB | `motion` |
| **PixelSwap** | css, jsx | 13 KB | — |
| **PixelTrail** | css, jsx | 4 KB | `@react-three/drei`, `@react-three/fiber`, `three` |
| **PixelTransition** | css, jsx | 4 KB | `gsap` |
| **Ribbons** | css, jsx | 7 KB | `ogl` |
| **RippleDistortion** | css, jsx | 13 KB | `ogl` |
| **ScrollExpand** | css, jsx | 8 KB | — |
| **ShapeBlur** | jsx | 8 KB | `three` |
| **SplashCursor** | jsx | 34 KB | — |
| **StarBorder** | css, jsx | 2 KB | — |
| **StickerPeel** | css, jsx | 11 KB | `gsap` |
| **Strands** | css, jsx | 10 KB | `ogl` |
| **SwarmCursor** | css, jsx | 18 KB | `ogl` |
| **TargetCursor** | css, jsx | 14 KB | `gsap` |

## Componentes (44)

| Componente | Arquivos | Tamanho | Precisa de |
|---|---|---|---|
| **AccordionGallery** | css, jsx | 10 KB | `gsap` |
| **AnimatedList** | css, jsx | 6 KB | `motion` |
| **BorderGlow** | css, jsx | 11 KB | — |
| **BounceCards** | css, jsx | 4 KB | `gsap` |
| **BubbleMenu** | css, jsx | 11 KB | `gsap` |
| **CardNav** | css, jsx | 9 KB | `gsap`, `react-icons` |
| **CardSwap** | css, jsx | 5 KB | `gsap` |
| **Carousel** | css, jsx | 10 KB | `motion`, `react-icons` |
| **ChromaGrid** | css, jsx | 8 KB | `gsap` |
| **CircularGallery** | css, jsx | 21 KB | `ogl` |
| **Counter** | css, jsx | 4 KB | `motion` |
| **CurvedInput** | css, jsx | 17 KB | — |
| **DecayCard** | css, jsx | 5 KB | `gsap` |
| **DepthCarousel** | css, jsx | 15 KB | `gsap` |
| **Dock** | css, jsx | 5 KB | `motion` |
| **DomeGallery** | css, jsx | 28 KB | `@use-gesture/react` |
| **DriftWall** | css, jsx | 12 KB | — |
| **ElasticSlider** | css, jsx | 6 KB | `@chakra-ui/react`, `motion`, `react-icons` |
| **FlowingMenu** | css, jsx | 7 KB | `gsap` |
| **FluidGlass** | jsx | 8 KB | `@react-three/drei`, `@react-three/fiber`, `maath`, `three` |
| **FlyingPosters** | css, jsx | 13 KB | `ogl` |
| **Folder** | css, jsx | 6 KB | — |
| **GlassIcons** | css, jsx | 3 KB | — |
| **GlassSurface** | css, jsx | 10 KB | — |
| **GooeyNav** | css, jsx | 9 KB | — |
| **InfiniteMenu** | css, jsx | 29 KB | `gl-matrix` |
| **Lanyard** | css, jsx, glb, png | 2418 KB | `@react-three/drei`, `@react-three/fiber`, `@react-three/rapier`, `meshline`, `three` |
| **LineSidebar** | css, jsx | 8 KB | — |
| **MagicBento** | css, jsx | 23 KB | `gsap` |
| **Masonry** | css, jsx | 7 KB | `gsap` |
| **ModelViewer** | jsx | 14 KB | `@react-three/drei`, `@react-three/fiber`, `three` |
| **MorphSlider** | css, jsx | 22 KB | `gsap`, `ogl` |
| **OptionWheel** | css, jsx | 11 KB | — |
| **PillNav** | css, jsx | 14 KB | `gsap`, `react-router-dom` |
| **PixelCard** | css, jsx | 7 KB | — |
| **ProfileCard** | css, jsx | 23 KB | — |
| **ReflectiveCard** | css, jsx | 8 KB | `lucide-react` |
| **ScrollStack** | css, jsx | 10 KB | `lenis` |
| **SpecularButton** | css, jsx | 10 KB | `ogl` |
| **SpotlightCard** | css, jsx | 1 KB | — |
| **Stack** | css, jsx | 6 KB | `motion` |
| **StaggeredMenu** | css, jsx | 20 KB | `gsap` |
| **Stepper** | css, jsx | 10 KB | `motion` |
| **TiltedCard** | css, jsx | 4 KB | `motion` |

## Fundos (53)

| Componente | Arquivos | Tamanho | Precisa de |
|---|---|---|---|
| **AcidSquares** | css, jsx | 14 KB | `ogl` |
| **Aurora** | css, jsx | 6 KB | `ogl` |
| **Balatro** | css, jsx | 6 KB | `ogl` |
| **Ballpit** | jsx | 21 KB | `three` |
| **Beams** | css, jsx | 10 KB | `@react-three/drei`, `@react-three/fiber`, `three` |
| **ColorBends** | css, jsx | 10 KB | `three` |
| **DarkVeil** | css, jsx | 12 KB | `ogl` |
| **Dither** | css, jsx | 9 KB | `@react-three/fiber`, `@react-three/postprocessing`, `postprocessing`, `three` |
| **DotField** | css, jsx | 8 KB | — |
| **DotGrid** | css, jsx | 8 KB | `gsap` |
| **EvilEye** | css, jsx | 8 KB | `ogl` |
| **FaultyTerminal** | css, jsx | 11 KB | `ogl` |
| **Ferrofluid** | css, jsx | 10 KB | `ogl` |
| **FloatingLines** | css, jsx | 13 KB | `three` |
| **Galaxy** | css, jsx | 10 KB | `ogl` |
| **GradientBlinds** | css, jsx | 10 KB | `ogl` |
| **GradientWaves** | css, jsx | 10 KB | `ogl` |
| **Grainient** | css, jsx | 9 KB | `ogl` |
| **GridDistortion** | css, jsx | 7 KB | `three` |
| **GridMotion** | css, jsx | 4 KB | `gsap` |
| **GridScan** | css, jsx | 29 KB | `face-api.js`, `postprocessing`, `three` |
| **Hyperspeed** | js, css, jsx | 45 KB | `postprocessing`, `three` |
| **Iridescence** | css, jsx | 3 KB | `ogl` |
| **LetterGlitch** | jsx | 7 KB | — |
| **Lightfall** | css, jsx | 10 KB | `ogl` |
| **Lightning** | css, jsx | 6 KB | — |
| **LightPillar** | css, jsx | 13 KB | `three` |
| **LightRays** | css, jsx | 12 KB | `ogl` |
| **LightTunnel** | css, jsx | 12 KB | `ogl` |
| **LineWaves** | css, jsx | 8 KB | `ogl` |
| **LiquidChrome** | css, jsx | 5 KB | `ogl` |
| **LiquidEther** | css, jsx | 37 KB | `three` |
| **MoltenMetal** | css, jsx | 9 KB | `ogl` |
| **Orb** | css, jsx | 10 KB | `ogl` |
| **Particles** | css, jsx | 7 KB | `ogl` |
| **PixelBlast** | css, jsx | 19 KB | `postprocessing`, `three` |
| **PixelSnow** | css, jsx | 11 KB | `three` |
| **Plasma** | css, jsx | 10 KB | `ogl` |
| **PlasmaWave** | css, jsx | 6 KB | `ogl` |
| **Prism** | css, jsx | 12 KB | `ogl` |
| **PrismaticBurst** | css, jsx | 14 KB | `ogl` |
| **Radar** | css, jsx | 6 KB | `ogl` |
| **RippleGrid** | css, jsx | 9 KB | `ogl` |
| **Scanner** | css, jsx | 11 KB | `ogl` |
| **ShapeGrid** | css, jsx | 14 KB | — |
| **SideRays** | css, jsx | 8 KB | `ogl` |
| **Silk** | jsx | 3 KB | `@react-three/fiber`, `three` |
| **SlicedWaves** | css, jsx | 10 KB | `ogl` |
| **SoftAurora** | css, jsx | 8 KB | `ogl` |
| **Threads** | css, jsx | 8 KB | `ogl` |
| **Topography** | css, jsx | 11 KB | `ogl` |
| **Waves** | css, jsx | 10 KB | — |
| **WebThreads** | css, jsx | 10 KB | `ogl` |

## Texto-animado (32)

| Componente | Arquivos | Tamanho | Precisa de |
|---|---|---|---|
| **ASCIIText** | jsx | 15 KB | `three` |
| **BlurText** | jsx | 3 KB | `motion` |
| **CircularText** | css, jsx | 3 KB | `motion` |
| **CountUp** | jsx | 2 KB | `motion` |
| **CurvedLoop** | css, jsx | 5 KB | — |
| **DecryptedText** | jsx | 11 KB | `motion` |
| **DepthText** | css, jsx | 7 KB | — |
| **EchoText** | css, jsx | 9 KB | — |
| **FallingText** | css, jsx | 6 KB | `matter-js` |
| **FoldText** | css, jsx | 8 KB | `gsap` |
| **FuzzyText** | jsx | 11 KB | — |
| **GlitchText** | css, jsx | 3 KB | — |
| **GradientText** | css, jsx | 4 KB | `motion` |
| **MaskedHeading** | css, jsx | 10 KB | `gsap` |
| **ParticleText** | css, jsx | 14 KB | — |
| **RotatingText** | css, jsx | 6 KB | `motion` |
| **ScrambledText** | css, jsx | 2 KB | `gsap` |
| **ScrollFloat** | css, jsx | 2 KB | `gsap` |
| **ScrollReveal** | css, jsx | 3 KB | `gsap` |
| **ScrollVelocity** | css, jsx | 4 KB | `motion` |
| **ShinyText** | css, jsx | 4 KB | `motion` |
| **Shuffle** | css, jsx | 13 KB | `@gsap/react`, `gsap` |
| **SplitFlapText** | css, jsx | 13 KB | — |
| **SplitText** | jsx | 4 KB | `@gsap/react`, `gsap` |
| **StrokeText** | css, jsx | 7 KB | `gsap` |
| **TextCursor** | css, jsx | 4 KB | `motion` |
| **TextLoop** | css, jsx | 7 KB | `gsap` |
| **TextPressure** | jsx | 7 KB | — |
| **TextType** | css, jsx | 5 KB | `gsap` |
| **TrueFocus** | css, jsx | 5 KB | `motion` |
| **VariableProximity** | css, jsx | 6 KB | `motion` |
| **WarpText** | css, jsx | 16 KB | `ogl` |

