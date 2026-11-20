<p class="eyebrow">Part 4 · Reading the numbers</p>

## A speed-up is a product of factors

<div class="math-block">
$$
\frac{T_\text{old}}{T_\text{new}} =
\underbrace{\frac{\text{hardware}_\text{new}}{\text{hardware}_\text{old}}}_{\text{devices, precision}}
\times
\underbrace{\frac{\text{evals/ESS}_\text{old}}{\text{evals/ESS}_\text{new}}}_{\text{algorithm}}
\times
\underbrace{\frac{\text{cost/eval}_\text{old}}{\text{cost/eval}_\text{new}}}_{\text{model}}
\times
\underbrace{\text{overheads}}_{\text{compile, transfer}}
$$
</div>
<table class="compact">
<thead><tr><th>Study</th><th>Reported</th><th>Baseline</th><th>What else changed</th></tr></thead>
<tbody>
<tr><td>ripple (Edwards+ 2024)</td><td>&gt;10× per waveform call</td><td>serial CPU</td><td>nothing: a clean hardware factor</td></tr>
<tr><td>Jim (Wong+ 2023)</td><td>~40 s sampling, ~3 min wall, one A100</td><td>— (CPU nested sampling: hours–days)</td><td>flow MCMC, gradients, heterodyning</td></tr>
<tr><td>Piras+ 2024</td><td>2 days on 12 GPUs vs 8 months on 48 cores</td><td>CPU nested sampling</td><td>neural emulators, different sampler</td></tr>
<tr><td>Karamanis+ 2022</td><td>~25–50×</td><td>CPU nested sampling</td><td>algorithm only, CPU on both sides</td></tr>
<tr><td>Dance+ 2025</td><td>up to ~10×</td><td>naive vectorised MCMC, same device</td><td>execution model only</td></tr>
</tbody>
</table>

Notes: Worked decomposition for Piras et al.: 8 months × 48 cores is about 2.8e5
core-hours, 2 days × 12 GPUs is 576 GPU-hours. Wall-time ratio about 120,
resource ratio about 480 core-hours per GPU-hour; neither isolates the hardware.
Questions to ask: what was the baseline, same algorithm on both devices,
compilation reported separately? Recall that the peak hardware ratio is only a
few.

---

## Should my sampler move to a GPU?

<div class="two-col">
<div class="card">

### Move when

- the likelihood is a compiled array program that stays on the device;
- evaluations are wide, **or** the algorithm can use many at once;
- control flow is uniform across the batch, or a uniform variant exists;
- runs are long enough to amortise compilation;
- the precision you need runs at speed on that GPU.

</div>
<div class="card gold">

### Stay on CPUs when

- the likelihood calls a legacy C library on the host;
- evaluations are narrow and the algorithm is sequential;
- runs are short;
- you have a large CPU allocation and few GPUs.

A better algorithm on CPUs (preconditioning, heterodyning, emulation) can buy as
much as the hardware.

</div>
</div>

Notes: Porting check: run a target with a known posterior on both devices;
compare the production likelihood at the same points against an error budget
rather than zero; time compilation, warm-up and sampling separately.

---

## Take-home

<ol>
<li><strong>A GPU is fast because it keeps ~10⁴–10⁵ operations in flight</strong> to hide memory latency. Parallelism is the price of admission, not the speed itself.</li>
<li>It rewards <strong>wide, uniform, fixed-shape, device-resident</strong> work at a precision it runs fast; lockstep turns every branch and variable-length loop into waiting.</li>
<li>Translating a sampler means <strong>reshaping the algorithm</strong>: fixed-length or state-machine HMC, batched deletions with fixed-work replacements, populations and flows.</li>
<li>Read speed-ups as products: <strong>hardware × algorithm × model × overheads</strong>. The hardware factor alone is a few.</li>
</ol>

<p class="muted">Backup slides below (↓): JAX example, caches, Amdahl's law, precision and reproducibility.</p>

Notes: Close here and open discussion. Possible discussion prompts: which of our
pipelines are memory-bound; whether relative binning and GPUs pull in opposite
directions; how we validate a GPU port against the CPU reference.

---

## References

<ul class="refs">
<li>Albert 2020, JAXNS, arXiv:2012.15286</li>
<li>Dance, Glaser, Orbanz &amp; Adams 2025, Efficiently vectorized MCMC on modern accelerators, ICML, arXiv:2503.17405</li>
<li>Dax et al. 2021, PRL 127, 241103 (DINGO), arXiv:2106.12594</li>
<li>Edwards et al. 2024, PRD 110, 064028 (ripple), arXiv:2302.05329</li>
<li>Hennessy &amp; Patterson 2017, Computer Architecture: A Quantitative Approach, 6th ed.</li>
<li>Hoffman &amp; Gelman 2014, JMLR 15, 1593 (NUTS), arXiv:1111.4246</li>
<li>Hoffman, Radul &amp; Sountsov 2021, AISTATS (ChEES); Sountsov &amp; Hoffman 2021, arXiv:2110.11576 (SNAPER); Hoffman &amp; Sountsov 2022, AISTATS (MEADS)</li>
<li>Jia, Maggioni, Staiger &amp; Scarpazza 2018, Dissecting the NVIDIA Volta GPU, arXiv:1804.06826</li>
<li>Karamanis et al. 2022, MNRAS 516, 1644, arXiv:2207.05652</li>
<li>Margossian et al. 2025, Bayesian Analysis 20, 1587 (nested R̂), arXiv:2110.13017</li>
<li>Murray, Lee &amp; Jacob 2016, JCGS 25, 789, arXiv:1301.4019</li>
<li>NVIDIA 2020, A100 Tensor Core GPU Architecture; NVIDIA, Ampere GA102 GPU Architecture; NVIDIA, CUDA Programming Guide</li>
<li>AMD, EPYC 9004 Series Processors Datasheet</li>
<li>Piras et al. 2024, OJAp 7, arXiv:2405.12965</li>
<li>Radul et al. 2020, MLSys 2, 390, arXiv:1910.11141</li>
<li>Skilling 2006, Bayesian Analysis 1, 833</li>
<li>Syed, Bouchard-Côté, Deligiannidis &amp; Doucet 2022, JRSS B 84, 321, arXiv:1905.02939</li>
<li>Williams, Waterman &amp; Patterson 2009, CACM 52, 65 (Roofline)</li>
<li>Wong, Gabrié &amp; Foreman-Mackey 2023, JOSS 8, 5021 (flowMC), arXiv:2211.06397</li>
<li>Wong, Isi &amp; Edwards 2023, ApJ 958, 129 (Jim), arXiv:2302.05333</li>
<li>Yallup, Prathaban, Alvey &amp; Handley 2025, arXiv:2509.24949; Yallup, Kroupa &amp; Handley 2026, TMLR, arXiv:2601.23252</li>
<li>Zackay, Dai &amp; Venumadhav 2018, Relative binning, arXiv:1806.08792</li>
</ul>
