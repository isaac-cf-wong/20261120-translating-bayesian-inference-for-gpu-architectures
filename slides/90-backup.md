<p class="eyebrow">Backup</p>

## From one chain to a batch in JAX

```python
import jax, jax.numpy as jnp

def log_like(theta, data):          # written for ONE parameter vector
    model = theta[0] * jnp.sin(theta[1] * data.t)
    return -0.5 * jnp.sum((data.y - model) ** 2 / data.sigma ** 2)

batched = jax.vmap(log_like, in_axes=(0, None))   # now takes a (B, D) batch
fast = jax.jit(batched)                           # compiled into fused kernels
```

- `vmap` adds a batch axis to every array operation: many chains become one wide
  workload.
- `jit` compiles for the shapes it first sees; new shapes compile again.
- Random numbers use explicit keys on a counter-based generator: each lane gets
  an independent stream without shared state.

Notes: This is how "width" is created in practice. The whole sampler loop should
sit inside jit too (lax.scan, lax.while_loop), otherwise every iteration returns
to Python on the host.

---

## Cache lines: neighbours come for free

<div data-fig="gf-line" class="fig-wide"></div>

<p class="caption">CPU memory moves in 64-byte lines; the GPU analogue is the 32-byte sector of the coalescing slide.</p>

---

## Amdahl and Gustafson: the serial part sets the ceiling

<div data-fig="gf-amd" class="fig-wide"></div>

<p class="caption">For samplers, the serial part is the sequence of dependent steps: burn-in, the order of nested-sampling deletions, adaptation.</p>

---

## Precision and reproducibility

- **FP32** is fast everywhere, but a log-likelihood summed over 10⁵–10⁶ terms
  loses digits, and Metropolis acceptance uses log-density _differences_.
- Documented failure: FP32 weight sums biasing SMC resampling
  <span class="cite">[Murray+ 2016]</span>.
- Run a short **FP64 reference** and compare posterior summaries before adopting
  FP32; prefer full-rate FP64 hardware for ill-conditioned targets.
- **Bitwise reproducibility** is lost: parallel reductions change summation
  order, and a chain amplifies last-bit differences. State agreement
  statistically: same posterior within Monte Carlo error.

Notes: Porting check list: (1) a target with a known posterior at the real
dimension on both devices; (2) the production likelihood at the same points on
CPU and GPU, difference against an error budget not zero; (3) diagnostics for
short chains such as nested R-hat; (4) compilation, warm-up and sampling timed
separately.
