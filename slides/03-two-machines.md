<p class="eyebrow">Part 1 · Two machines</p>

## Latency versus throughput

<div class="fig-text">
<div data-fig="gf-cpu-gpu-architecture"></div>
<div>
<ul>
<li><strong>CPU</strong>: finish <em>one</em> instruction stream as fast as possible. Area goes to control logic, branch prediction and cache.</li>
<li><strong>GPU</strong>: finish <em>many</em> streams per second. Area goes to arithmetic lanes, grouped into lockstep groups.</li>
<li>Both are fed by memory that is far slower than their arithmetic.</li>
</ul>
</div>
</div>

Notes: Same transistor budget, spent differently. Keep the phrase "one stream
fast" versus "many streams per second" in mind; everything else follows.

---

## A CPU makes one thread fast by being clever

<div class="fig-text">
<div data-fig="gf-pipe"></div>
<div>
<ul>
<li><strong>Pipelining</strong>: a new instruction every cycle, though each takes five.</li>
<li><strong>Branch prediction</strong>: guess the branch, keep the pipeline full; a wrong guess costs the refill.</li>
<li>Plus out-of-order execution and deep caches: irregular, branchy code still runs well.</li>
</ul>
<p class="caption">Switch the menu to "mispredicted branch". <span class="cite">[Hennessy &amp; Patterson]</span></p>
</div>
</div>

Notes: Most CPU silicon exists to keep a single sequential program from
stalling. That is why dynesty-style Python loops with if-statements are fine on
a CPU.

---

## Where the data lives

<div class="fig-text">
<div data-fig="gf-where"></div>
<div>
<ul>
<li>Arithmetic reads only <strong>registers</strong>; every other number must first be copied inwards.</li>
<li>Each step outwards is bigger and slower: L1 → L2 → shared L3, all on the chip.</li>
<li>Leaving the chip is the big jump: DRAM ~90 ns ≈ 270 cycles.</li>
<li>The GPU is <strong>another device</strong> with its own memory, behind PCI Express, as is the SSD.</li>
</ul>
</div>
</div>

Notes: Hover a part to see its access time on the human scale. Sizes are typical
of recent server cores (tens of KB of L1, about 1 MB of L2 per core, tens of MB
of shared L3); times are the same rounded values as on the next slide. Physical
distance is not itself the cost: light crosses 10 cm in about 0.3 ns. The time
goes into the DRAM access and the protocols on the way.

---

## Arithmetic is cheap; fetching data is not

<div class="fig-text">
<div data-fig="gf-lat"></div>
<div>
<ul>
<li>A fused multiply–add: ~1 cycle. A trip to main memory: <strong>hundreds</strong> of cycles.</li>
<li>Tick "one cycle = one second": DRAM is minutes away; PCIe is hours.</li>
<li>Memory arrives in <strong>lines</strong> (64 B on a CPU): reading neighbours is free, scattered reads waste bandwidth.</li>
</ul>
<p class="takeaway">Any fast processor is mostly a machine for <em>not waiting</em> on memory.</p>
</div>
</div>

Notes: Values are rounded orders of magnitude for a 3 GHz core, not a
measurement of one machine. The CPU answer to the memory wall is caches and
prediction; the GPU answer, next part, is different.

---

## Peak speed is a product of widths

$$
\text{peak FLOP/s} = \text{cores} \times \text{clock} \times \text{SIMD width} \times 2_{\,\text{FMA}} \times \text{units}
$$

<table class="compact">
<thead><tr><th></th><th>FP64 peak</th><th>FP32 peak</th><th>Memory bandwidth</th></tr></thead>
<tbody>
<tr><td>64-core server CPU (illustrative)</td><td>≈ 5.1 TFLOP/s</td><td>≈ 10 TFLOP/s</td><td>460.8 GB/s (12 × DDR5-4800)</td></tr>
<tr><td>NVIDIA A100 40 GB</td><td>9.7 TFLOP/s (19.5 tensor core)</td><td>19.5 TFLOP/s</td><td>1555 GB/s</td></tr>
<tr><td>Consumer Ampere / Ada GPU</td><td><strong>1/64</strong> of FP32</td><td>tens of TFLOP/s</td><td>~1 TB/s</td></tr>
</tbody>
</table>

<div class="two-col">
<div class="metric"><strong>~2×</strong><br>FP64 peak ratio, A100 : CPU</div>
<div class="metric"><strong>~3.4×</strong><br>bandwidth ratio, A100 : CPU</div>
</div>

<p class="caption">CPU: 64 × 2.5 GHz × 8 doubles × 2 × 2, illustrative; bandwidth from AMD EPYC 9004 datasheet. A100: NVIDIA whitepaper. Consumer FP64 rate: NVIDIA GA102 / Ada whitepapers.</p>

Notes: The honest peak ratio between a good server and a data-centre GPU is a
few, not hundreds. So a reported 100× must come mostly from somewhere else: the
baseline (one core, Python), the algorithm, or the likelihood model. Keep that
for part 4. Consumer cards: fine for FP32, poor for FP64.
