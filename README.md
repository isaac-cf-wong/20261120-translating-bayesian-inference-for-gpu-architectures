# Translating Bayesian Inference for GPU Architectures

[![License: BSD-3-Clause](https://img.shields.io/badge/License-BSD--3--Clause-yellow.svg)](./LICENSE)
[![Reveal.js](https://img.shields.io/badge/reveal.js-6.x-orange.svg)](https://revealjs.com/)
[![CI](https://github.com/isaac-cf-wong/20261120-translating-bayesian-inference-for-gpu-architectures/actions/workflows/ci.yml/badge.svg)](https://github.com/isaac-cf-wong/20261120-translating-bayesian-inference-for-gpu-architectures/actions/workflows/ci.yml)
[![pre-commit](https://img.shields.io/badge/pre--commit-enabled-brightgreen?logo=pre-commit)](https://github.com/pre-commit/pre-commit)
[![typos](https://img.shields.io/badge/spell--check-typos-brightgreen)](https://github.com/crate-ci/typos)

Slides for a 30-minute journal club given on 20 November 2026 to an audience of
gravitational-wave researchers.

## Abstract

GPU computing has become popular in gravitational-wave inference, usually
explained by "it is massively parallel, so it is faster". That phrase does not
say when a GPU pays off, or what has to change so that it does. This talk
replaces it with the mechanisms behind GPU speed, using sampling algorithms as
the worked example:

1. **Two machines.** How a CPU makes one instruction stream fast, where data
   lives in a computer and how long it takes to fetch, and why the peak gap
   between a server CPU and a data-centre GPU is only a few times.
2. **Inside a GPU.** Warps and streaming multiprocessors; latency hiding across
   many resident warps (and Little's law); lockstep execution and branch
   divergence; memory coalescing; the roofline; and the costs of transfer,
   launch, compilation and precision.
3. **Samplers, reshaped.** Where a sampler's parallelism lives, many-chain MCMC,
   NUTS run in lockstep and the work it wastes, batched nested sampling, and
   population and flow-based methods.
4. **Reading the numbers.** How to decompose a reported speed-up, and when a
   sampler should move to a GPU.

Backup slides cover a JAX `vmap`/`jit` example, cache lines, Amdahl's law, and
precision and reproducibility.

## Viewing the slides

Requires Node.js 18 or later and npm.

```console
npm ci
npm start
```

Then open <http://localhost:8000>. Press `S` for the speaker view (the notes
carry the derivations and caveats behind each number), `Esc` for the overview,
and append `?print-pdf` to the URL to export a PDF. The backup slides sit below
the last main slide (press ↓).

Many slides have live figures: sliders and menus can be used during the talk,
and animations play only while their slide is shown. Click on the slide
background before navigating with the arrow keys, since a focused slider or menu
also responds to them.

## Repository layout

```console
index.html          reveal.js entry point; lists the slide files
slides/             one Markdown file per part (90-backup.md: backup slides)
js/figures.js       the interactive figures, mounted into slides by data-fig
css/custom.css      theme and layout, including the figure styles
```

To build a self-contained copy in `dist/`, run `npm run build`; `npm test`
checks that the required files are present.

## Licence

BSD 3-Clause; see [LICENSE](LICENSE). Built from a
[reveal.js](https://revealjs.com/) presentation template.
