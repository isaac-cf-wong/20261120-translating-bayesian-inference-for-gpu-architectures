## GPUs have arrived in GW inference

<div class="two-col">
<div>

- **Jim**: BNS parameter estimation with flow-enhanced MCMC; ~40 s of sampling,
  ~3 min wall time including compilation, on one A100 <span class="cite">[Wong+
  2023]</span>
- **ripple**: differentiable waveforms in JAX; >10× per waveform call on GPU
  <span class="cite">[Edwards+ 2024]</span>
- **DINGO**: amortised neural posterior estimation <span class="cite">[Dax+
  2021]</span>
- **GPU nested sampling**: nested slice sampling for GW parameter estimation
  <span class="cite">[Yallup+ 2025]</span>

</div>
<div>

<p class="large-claim">"It's massively parallel, so it's faster."</p>

True, but it does not tell you _when_ a GPU pays, or what to change so it does.

</div>
</div>

Notes: These are the examples people have heard of. The common explanation is
"massive parallelism". Today: unpack that phrase into mechanisms that predict
when the speed-up appears and when it does not.

---

## What the vague explanation cannot answer

- A100 cores run at **1.4 GHz**; a server CPU core at 3+ GHz. Why do the slow
  cores win?
- Peak FP64: A100 ≈ 9.7 TFLOP/s vs ≈ 5 TFLOP/s for a 64-core server CPU,
  **~2×**. Where do reported 100–1000× speed-ups come from?
- Why does vectorised NUTS get _less_ efficient as you add chains?
- Why can't dynesty simply "run on the GPU"?
- Why does a gaming GPU run FP64 at **1/64** of its FP32 rate, and does PE care?

<div class="takeaway">Plan: (1) how a CPU and a GPU execute code · (2) the three mechanisms behind GPU speed · (3) how samplers are reshaped · (4) how to read a speed-up</div>

Notes: The CPU figure is an illustrative 64-core part: 64 cores × 2.5 GHz × 8
doubles per AVX-512 vector × 2 (FMA) × 2 FMA units ≈ 5.1 TFLOP/s. A100 FP64 is
9.7 TFLOP/s on the CUDA cores, 19.5 on tensor cores, per the NVIDIA whitepaper.
