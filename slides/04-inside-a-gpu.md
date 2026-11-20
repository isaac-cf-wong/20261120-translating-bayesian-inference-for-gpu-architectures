<p class="eyebrow">Part 2 · Inside a GPU</p>

## Streaming multiprocessors, warps and lanes

<div class="fig-text">
<div data-fig="gf-gpu-anatomy"></div>
<div>
<ul>
<li>A100: <strong>108</strong> streaming multiprocessors (SMs), each with 64 FP32 and 32 FP64 lanes.</li>
<li>Lanes are driven in groups of <strong>32 threads = one warp</strong>: one instruction, 32 data.</li>
<li>Up to <strong>2048 threads</strong> (64 warps) resident per SM, each with its own registers.</li>
<li>Small caches per lane; 40 MB L2; 1555 GB/s HBM.</li>
</ul>
<p class="caption">NVIDIA A100 architecture whitepaper (2020).</p>
</div>
</div>

Notes: The resident-thread count is the interesting number: 64 warps per SM, but
only four schedulers. Most warps are waiting at any moment. That is by design.

---

## How work is cut up: grid → blocks → warps → threads

<div class="fig-text">
<div data-fig="gf-thread-hierarchy"></div>
<div>
<ul>
<li>One <strong>kernel</strong> launch runs the same program on a grid of thread blocks.</li>
<li>A block lives on one SM; the hardware slices it into warps of 32.</li>
<li>In JAX you never write this: <code>jit</code> compiles the array program to kernels, <code>vmap</code> adds a batch axis, e.g. one per chain.</li>
</ul>
</div>
</div>

Notes: The hierarchy matters for two reasons: warps execute in lockstep, and
consecutive threads should touch consecutive memory. Both come up next.

---

## Mechanism 1: hide memory latency, don't avoid it

<div class="fig-text">
<div data-fig="gf-hide"></div>
<div>
<ul>
<li>Each warp: 4 instructions, then a load that takes 40 cycles.</li>
<li>One warp: scheduler idle 90% of the time. About <strong>11 warps</strong>: some warp is always ready.</li>
<li>Little's law: bytes in flight = bandwidth × latency ≈ 1.6 TB/s × 250 ns ≈ <strong>0.4 MB ≈ 5×10⁴ doubles</strong>.</li>
</ul>
<p class="takeaway">Massive parallelism is the <em>price of admission</em>: it is what keeps the memory system busy.</p>
</div>
</div>

Notes: Drag the slider from 1 to 16. The 4-and-40 workload is a teaching model.
Real global-memory latency is several hundred cycles (about 375 on a V100 by
microbenchmark, Jia et al. 2018), about 250 ns at a 1.5 GHz clock. Times A100
bandwidth gives the bytes that must be in flight. That is tens of thousands of
independent loads. So the GPU is not fast because each lane is fast; it is fast
because it can keep that many requests outstanding while the CPU hides latency
with caches and prediction. Order of magnitude only: V100 latency combined with
A100 bandwidth.

---

## Mechanism 2: lockstep, so branches cost both ways

<div class="fig-text">
<div data-fig="gf-div"></div>
<div>
<ul>
<li>A warp issues <strong>one</strong> instruction for all 32 threads.</li>
<li>If threads disagree on a branch, the warp runs <em>both</em> sides, masking lanes off.</li>
<li>Same for loops: the warp runs until its <strong>slowest</strong> thread finishes.</li>
</ul>
<p class="caption">Keep this picture for NUTS in Part 3.</p>
</div>
</div>

Notes: Move the slider: at 0 or 32 every lane agrees and the untaken branch is
skipped. Anywhere in between, both run. In array frameworks this appears as
jnp.where evaluating both branches, and as while-loops padded to the longest
member of the batch.

---

## Mechanism 3: memory moves in sectors, not numbers

<div class="fig-text">
<div data-fig="gf-coal"></div>
<div>
<ul>
<li>A warp's 32 loads are served in <strong>32-byte sectors</strong>.</li>
<li>Thread <em>i</em> reads element <em>i</em>: every byte fetched is used (100%).</li>
<li>Stride or scatter: up to 4× the traffic for the same data.</li>
<li>Arrays laid out with the batch axis contiguous ("structure of arrays") keep loads coalesced.</li>
</ul>
<p class="caption">CUDA Programming Guide.</p>
</div>
</div>

Notes: Bandwidth is the scarce resource for most likelihoods, so wasting 75% of
it matters. Compilers like XLA usually choose good layouts; hand-written gathers
(lookup tables, interpolation grids) are where it goes wrong.

---

## Roofline: which ceiling does your likelihood hit?

<div class="fig-text">
<div data-fig="gf-roof"></div>
<div>
<ul>
<li>Operational intensity <em>I</em> = FLOPs per byte moved.</li>
<li>Noise-weighted inner product ⟨d|h⟩: ~10 FLOPs per ~40 B, <em>I</em> ≈ 0.25 → <strong>memory-bound</strong>.</li>
<li>Memory-bound kernels gain only the bandwidth ratio, <strong>~3.4×</strong>.</li>
<li>Data shipped over PCIe each call: GPU loses to the CPU below ~160 FLOP/B.</li>
</ul>
<p class="caption">Roofline model: Williams, Waterman &amp; Patterson 2009.</p>
</div>
</div>

Notes: The inner-product intensity is a rough count: read the data and the PSD
and the template per frequency bin, a complex multiply and accumulate. A
waveform generated on the fly from parameters (ripple) does more arithmetic per
byte, which helps. Neural networks with dense layers are the compute-bound end.

---

## The taxes: transfer, launch, compilation, precision

<table class="compact">
<thead><tr><th>Cost</th><th>Order of magnitude</th><th>Consequence for a sampler</th></tr></thead>
<tbody>
<tr><td>Host ↔ device (PCIe 4.0 x16)</td><td>31.5 GB/s, ~50× below HBM</td><td>Keep the whole sampler loop on the device</td></tr>
<tr><td>Kernel launch</td><td>microseconds</td><td>Fuse many small operations (<code>jit</code>)</td></tr>
<tr><td>Compilation (XLA)</td><td>seconds to minutes</td><td>Amortise over a long run; report it separately</td></tr>
<tr><td>Shape-dependent compilation</td><td>recompile per new shape</td><td>Fixed shapes; pad variable-length loops</td></tr>
<tr><td>FP64 on consumer GPUs</td><td>1/64 of FP32</td><td>Use data-centre GPUs, or check FP32 is safe</td></tr>
</tbody>
</table>

<div class="takeaway">Five rules: <strong>width</strong> · <strong>uniformity</strong> · <strong>fixed shapes</strong> · <strong>residency</strong> · <strong>precision</strong></div>

Notes: The five rules are the summary of part 2. Width: enough independent work.
Uniformity: no divergence. Fixed shapes: compiled programs specialise on shapes.
Residency: state stays on the device. Precision: FP32 is fast everywhere, FP64
only on data-centre parts. A Python sampler loop calling a JAX likelihood
violates residency every iteration.
