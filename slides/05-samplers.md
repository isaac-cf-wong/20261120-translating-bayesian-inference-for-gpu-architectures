<p class="eyebrow">Part 3 · Samplers, reshaped</p>

## Where the parallelism lives in a sampler

<table class="compact">
<thead><tr><th>Level</th><th>What runs in parallel</th><th>GW example</th><th>Typical width</th></tr></thead>
<tbody>
<tr><td><strong>Within one evaluation</strong></td><td>terms of the likelihood</td><td>frequency bins of ⟨d|h⟩</td><td>~10⁵ (BNS, full grid) → ~10² (relative binning)</td></tr>
<tr><td><strong>Across chains</strong></td><td>independent or weakly coupled chains</td><td>many-chain HMC; ensemble walkers</td><td>10¹–10⁵</td></tr>
<tr><td><strong>Within one step</strong></td><td>several proposals or replacements</td><td>batched nested-sampling replacements</td><td>10¹–10³</td></tr>
<tr><td><strong>Across a population</strong></td><td>particles, replicas, rungs</td><td>SMC particles; tempering replicas</td><td>10²–10⁶</td></tr>
</tbody>
</table>

<div class="takeaway">A GPU pays when (evaluation width) × (simultaneous evaluations the algorithm can <em>use</em>) fills the device.</div>

<p class="caption">Relative binning: Zackay, Dai &amp; Venumadhav 2018 (about four orders of magnitude fewer bins for GW170817).</p>

Notes: CPU practice used level 1 through vectorised libraries and level 2
through processes. The GPU wants them combined into one wide array operation.
Note the twist for GW: our best CPU trick, relative binning or heterodyning,
makes one evaluation narrow, so the width has to come from the algorithm.

---

## Width × batch: when does the GPU overtake?

<div class="fig-text">
<div data-fig="gf-throughput"></div>
<div>
<ul>
<li>Toy devices: GPU 16 384 lanes + 10 µs launch; CPU 128 lanes, no overhead.</li>
<li>Crossover at a fixed total width, <em>B·w</em> ≈ 5.6×10³ terms.</li>
<li>Full-grid likelihood (<em>w</em> ~ 10⁵): one chain already fills the GPU.</li>
<li>Relative-binned (<em>w</em> ~ 10²): needs <strong>~60+</strong> chains before the GPU wins.</li>
</ul>
<p class="caption">Illustrative parameters, 32× peak ratio; not a benchmark.</p>
</div>
</div>

Notes: Drag the slider to change w. The point is the shape, not the numbers:
below a total width the launch overhead and idle lanes dominate. The crossover
is the number of terms the CPU evaluates in the time the GPU takes for one
batched call.

---

## Many chains: free parallelism, but burn-in does not shrink

<div class="fig-text">
<div data-fig="gf-mh"></div>
<div>
<ul>
<li>Random-walk Metropolis as a batch: propose for all <em>B</em> chains, one density call, accept <strong>by mask</strong>.</li>
<li>No branches, fixed shapes: ideal GPU code.</li>
<li>But each chain must still forget its start: the wide direction takes ~150 iterations <strong>whatever <em>B</em> is</strong>.</li>
<li>More chains buy more samples after warm-up, not a shorter warm-up. Diagnose many short chains with nested R̂.</li>
</ul>
<p class="caption">Nested R̂: Margossian+ 2025.</p>
</div>
</div>

Notes: The narrow direction settles in about 50 iterations, the wide one in
about 150, independent of B. Classic R-hat needs long chains; nested R-hat
groups chains into superchains so short chains can still be assessed.

---

## NUTS: grow the trajectory until it turns back

<div class="fig-text">
<div data-fig="gf-nuts"></div>
<div>
<ul>
<li>Each leapfrog step follows the Hamiltonian flow and costs <strong>one gradient</strong>.</li>
<li>NUTS doubles the trajectory (1, 2, 4, 8, … steps, in a random direction) until its two ends start moving back towards each other: the <strong>U-turn</strong>.</li>
<li>The next state is drawn from the trajectory's points.</li>
<li>The length depends on the momentum draw, so it <strong>differs from chain to chain</strong>. Run in lockstep, finished chains wait (grey) for the longest.</li>
</ul>
<p class="caption">Hoffman &amp; Gelman 2014. Multinomial variant with sub-tree U-turn checks; depth capped at 5.</p>
</div>
</div>

Notes: White circle: current state; filled circle: the state drawn for the next
iteration; small grey dots: earlier samples. A dashed grey half was discarded
because it contained a U-turn of its own; its gradients were still paid for.
Switch to one chain to see NUTS on its own, then three to see the waiting. The
sampler is real: checked offline over 2e5 iterations, its samples have standard
deviations 0.997 and 0.201 against the target's 1 and 0.2.

---

## NUTS in lockstep: everyone waits for the longest trajectory

<div class="fig-text">
<div data-fig="gf-lock"></div>
<div>
<ul>
<li>NUTS doubles its trajectory until a U-turn; in this model, 1, 3, 7, …, 127 gradients.</li>
<li>Under <code>vmap</code>, the batch runs as one warp-like unit: each iteration lasts as long as its <strong>longest</strong> member.</li>
<li>Fixed trajectory length removes the idle time; "no waiting" lets each chain start its next transition at once.</li>
</ul>
<p class="caption">NUTS: Hoffman &amp; Gelman 2014. Automatic batching: Radul+ 2020.</p>
</div>
</div>

Notes: This is mechanism 2, divergence, at the level of whole algorithms. Switch
the menu through the three modes. Grey is idle device time.

---

## How much is wasted?

<div class="fig-text">
<div data-fig="gf-eta"></div>
<div>
<div class="math-block">$$\eta(B) = \frac{\mathbb{E}[L]}{\mathbb{E}\big[\max_{b\le B} L_b\big]}$$</div>
<ul>
<li>NUTS-like lengths: <em>η</em> falls to <strong>≈ 0.11</strong> (14.1 / 127). Adding chains makes it worse.</li>
<li><strong>Fix the length</strong>, tuned across chains: ChEES, SNAPER, MEADS.</li>
<li><strong>Stop waiting</strong>: rewrite NUTS as a finite-state machine; up to ~10× over naive vectorisation on the same accelerator.</li>
</ul>
<p class="caption">Hoffman+ 2021; Sountsov &amp; Hoffman 2021; Hoffman &amp; Sountsov 2022; Dance+ 2025.</p>
</div>
</div>

Notes: Model in the figure: tree depth 1 + Binomial(6, 0.4), L = 2^d - 1, mean
14.1. With exponential lengths eta is 1/H_B, about 0.13 at B = 1000. The fixes
illustrate the main lesson of the talk: you translate the algorithm, not just
the code. Cross-chain adaptation exists because many chains are now cheap.

---

## Nested sampling: from one point at a time to batches

<div class="fig-text">
<div data-fig="gf-ns"></div>
<div>
<ul>
<li>Classic: delete the worst live point, replace it. One evaluation stream: inherently sequential.</li>
<li>Batched: delete the <strong><em>k</em></strong> worst at once; log-volume shrinks by Σ<sub>j&lt;k</sub> 1/(<em>n</em>−<em>j</em>) per iteration.</li>
<li>Replacement must be <strong>fixed work</strong>: rejection sampling has a random number of tries (divergence); slice sampling with a fixed number of steps does not.</li>
</ul>
<p class="caption">Skilling 2006; JAXNS (Albert 2020); nested slice sampling (Yallup+ 2025, 2026).</p>
</div>
</div>

Notes: With k = 10 the same compression takes a tenth of the iterations, and the
ten replacements run in parallel. The constrained-prior step is where dynesty's
design choices (bounding ellipsoids, rejection, adaptive walks) clash with
lockstep execution, which is why GPU nested samplers moved to slice sampling
with fixed work per replacement.

---

## Populations and flows are GPU-native

<div class="three-col">
<div>

### SMC / tempering

- Particles or replicas are the batch axis.
- Synchronisation only at resampling or swaps.
- FP32 sums over many weights can bias resampling.

<p class="caption">Murray+ 2016; Syed+ 2022 (NRPT).</p>
</div>
<div>

### Flow-enhanced MCMC

- Many local chains (MALA/HMC) + a normalising flow proposing global jumps.
- Flow training is dense matrix algebra: high intensity.
- Jim: flowMC + ripple + heterodyning.

<p class="caption">Wong+ 2023 (flowMC, Jim).</p>
</div>
<div class="card gold">

### Amortised inference

- Train once on simulations; inference is a network evaluation.
- Leaves the sampler behind, at a training cost.
- DINGO for compact binaries.

<p class="caption">Dax+ 2021.</p>
</div>
</div>

Notes: These families were either designed around a population or around neural
networks, both of which are already wide, uniform array workloads.
