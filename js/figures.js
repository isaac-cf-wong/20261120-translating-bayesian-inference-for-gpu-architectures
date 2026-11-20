// Interactive figures for the slides.
//
// A slide asks for a figure with a placeholder `<div data-fig="gf-…"></div>`.
// Once reveal.js has loaded the Markdown slides, each placeholder is replaced
// by the figure's markup and the figure's script runs. Animated figures play
// while their slide is the current one and pause when the slide is left.
//
// The figures are adapted from the author's textbook unit on sampling with
// CPUs and GPUs; each GF.register(...) call below holds one figure's markup and
// script. index.html calls GF.start() once reveal.js is ready.

window.GF = (function () {
    'use strict'
    var NS = 'http://www.w3.org/2000/svg'
    function el(tag, a, p) {
        var e = document.createElementNS(NS, tag)
        if (a) for (var k in a) e.setAttribute(k, a[k])
        if (p) p.appendChild(e)
        return e
    }
    function txt(p, x, y, s, a) {
        var t = el(
            'text',
            Object.assign(
                { x: x, y: y, fill: 'currentColor', 'font-size': 12 },
                a || {}
            ),
            p
        )
        t.textContent = s
        return t
    }
    function sup(p, x, y, base, exp, a) {
        var t = txt(p, x, y, base, a)
        var s = el('tspan', { dy: -5, 'font-size': 9 }, t)
        s.textContent = exp
        return t
    }
    // Small seeded generator (mulberry32), so every run of a figure is the same.
    function rng(seed) {
        return function () {
            seed |= 0
            seed = (seed + 0x6d2b79f5) | 0
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
        }
    }
    function normal(r) {
        var u = 0
        while (u === 0) u = r()
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
    }
    function reduced() {
        return !!(
            window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
        )
    }
    function printing() {
        return /print-pdf/i.test(window.location.search)
    }

    // Play/pause control tied to the slide: plays while the figure's slide is
    // current (unless the presenter has used the button, reduced motion is
    // requested, or the deck is being printed) and pauses when it is left.
    var anims = []
    function animator(root, btn, tick, ms) {
        var timer = null
        var a = { root: root, user: false }
        a.set = function (on) {
            if (on && !timer) {
                timer = setInterval(tick, ms)
                btn.textContent = 'Pause'
            } else if (!on && timer) {
                clearInterval(timer)
                timer = null
                btn.textContent = 'Play'
            }
        }
        btn.addEventListener('click', function () {
            a.user = true
            a.set(!timer)
        })
        anims.push(a)
        return {
            set: a.set,
            running: function () {
                return !!timer
            },
        }
    }
    function syncAnimations() {
        var cur = window.Reveal && Reveal.getCurrentSlide()
        anims.forEach(function (a) {
            var here = !!cur && cur.contains(a.root)
            if (!here) a.set(false)
            else if (!a.user && !reduced() && !printing()) a.set(true)
        })
    }

    // Illustrative NUTS-like trajectory lengths: tree depth d = 1 + Binomial(6, 0.4),
    // L = 2^d - 1 gradient evaluations. Shared by the lockstep and efficiency figures.
    var depthPmf = (function () {
        var n = 6,
            p = 0.4,
            out = [],
            c = 1
        for (var k = 0; k <= n; k++) {
            if (k > 0) c = (c * (n - k + 1)) / k
            out.push({
                L: Math.pow(2, k + 1) - 1,
                p: c * Math.pow(p, k) * Math.pow(1 - p, n - k),
            })
        }
        return out
    })()
    var meanL = depthPmf.reduce(function (s, d) {
        return s + d.L * d.p
    }, 0)
    function drawL(r) {
        var u = r(),
            c = 0
        for (var i = 0; i < depthPmf.length; i++) {
            c += depthPmf[i].p
            if (u <= c) return depthPmf[i].L
        }
        return depthPmf[depthPmf.length - 1].L
    }

    var registry = {}
    function register(id, html, run) {
        registry[id] = { html: html, run: run }
    }
    function mountAll() {
        document.querySelectorAll('[data-fig]').forEach(function (ph) {
            var f = registry[ph.getAttribute('data-fig')]
            if (!f) {
                console.error('Unknown figure: ' + ph.getAttribute('data-fig'))
                return
            }
            var holder = document.createElement('div')
            holder.innerHTML = f.html
            var node = holder.firstElementChild
            if (ph.className) node.className += ' ' + ph.className
            ph.replaceWith(node)
            try {
                f.run()
            } catch (e) {
                console.error(
                    'Figure ' + ph.getAttribute('data-fig') + ' failed',
                    e
                )
            }
        })
    }

    function start() {
        mountAll()
        Reveal.on('slidechanged', syncAnimations)
        syncAnimations()
    }
    return {
        el: el,
        txt: txt,
        sup: sup,
        rng: rng,
        normal: normal,
        animator: animator,
        depthPmf: depthPmf,
        meanL: meanL,
        drawL: drawL,
        register: register,
        start: start,
    }
})()

GF.register(
    'gf-cpu-gpu-architecture',
    '<div class="gf" id="gf-cpu-gpu-architecture">\n<svg viewBox="0 0 640 310" role="img" aria-labelledby="arch-t arch-d" xmlns="http://www.w3.org/2000/svg">\n<title id="arch-t">Schematic of a CPU and a GPU</title>\n<desc id="arch-d">Left: a CPU with four large cores, each with its own control logic and a short vector unit, above a large shared cache and host memory. Right: a GPU with four multiprocessors, each holding many small lanes arranged in rows that execute in lockstep, above high-bandwidth device memory. An interconnect joins host memory to device memory and is the slowest link.</desc>\n<g fill="currentColor" font-size="15" font-weight="600" text-anchor="middle"><text x="160" y="22">CPU: few fast cores</text><text x="480" y="22">GPU: many lockstep lanes</text></g>\n<rect x="30" y="35" width="120" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="38" y="43" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".35"/>\n<text x="62" y="60" font-size="9" text-anchor="middle" fill="currentColor">control</text>\n<rect x="94" y="43" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".2"/>\n<text x="118" y="60" font-size="9" text-anchor="middle" fill="currentColor">L1/L2</text>\n<rect x="38.0" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="51.2" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="64.4" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="77.6" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="90.8" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="104.0" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="117.19999999999999" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="130.39999999999998" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<text x="90" y="101" font-size="9" text-anchor="middle" fill="currentColor">short SIMD unit</text>\n<rect x="170" y="35" width="120" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="178" y="43" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".35"/>\n<text x="202" y="60" font-size="9" text-anchor="middle" fill="currentColor">control</text>\n<rect x="234" y="43" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".2"/>\n<text x="258" y="60" font-size="9" text-anchor="middle" fill="currentColor">L1/L2</text>\n<rect x="178.0" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="191.2" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="204.4" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="217.6" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="230.8" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="244.0" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="257.2" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="270.4" y="77" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<text x="230" y="101" font-size="9" text-anchor="middle" fill="currentColor">short SIMD unit</text>\n<rect x="30" y="115" width="120" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="38" y="123" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".35"/>\n<text x="62" y="140" font-size="9" text-anchor="middle" fill="currentColor">control</text>\n<rect x="94" y="123" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".2"/>\n<text x="118" y="140" font-size="9" text-anchor="middle" fill="currentColor">L1/L2</text>\n<rect x="38.0" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="51.2" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="64.4" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="77.6" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="90.8" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="104.0" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="117.19999999999999" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="130.39999999999998" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<text x="90" y="181" font-size="9" text-anchor="middle" fill="currentColor">short SIMD unit</text>\n<rect x="170" y="115" width="120" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="178" y="123" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".35"/>\n<text x="202" y="140" font-size="9" text-anchor="middle" fill="currentColor">control</text>\n<rect x="234" y="123" width="48" height="26" rx="3" fill="var(--muted)" fill-opacity=".2"/>\n<text x="258" y="140" font-size="9" text-anchor="middle" fill="currentColor">L1/L2</text>\n<rect x="178.0" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="191.2" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="204.4" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="217.6" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="230.8" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="244.0" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="257.2" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<rect x="270.4" y="157" width="11" height="11" rx="1.5" fill="var(--s1)"/>\n<text x="230" y="181" font-size="9" text-anchor="middle" fill="currentColor">short SIMD unit</text>\n<rect x="30" y="195" width="260" height="24" rx="4" fill="var(--muted)" fill-opacity=".3"/><text x="160" y="211" font-size="11" text-anchor="middle" fill="currentColor">large shared cache</text>\n<rect x="30" y="232" width="260" height="24" rx="4" fill="none" stroke="currentColor" stroke-opacity=".6"/><text x="160" y="248" font-size="11" text-anchor="middle" fill="currentColor">host memory (DDR): lower bandwidth</text>\n<rect x="345" y="35" width="130" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="351.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351" y="80" width="118" height="10" rx="2" fill="var(--muted)" fill-opacity=".35"/>\n<text x="410" y="99" font-size="9" text-anchor="middle" fill="currentColor">small shared memory</text>\n<rect x="485" y="35" width="130" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="491.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="41" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="50" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="59" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="68" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491" y="80" width="118" height="10" rx="2" fill="var(--muted)" fill-opacity=".35"/>\n<text x="550" y="99" font-size="9" text-anchor="middle" fill="currentColor">small shared memory</text>\n<rect x="345" y="115" width="130" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="351.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="358.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="365.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="373.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="380.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="388.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="395.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="402.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="410.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="417.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="425.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="432.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="439.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="447.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="454.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="462.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="351" y="160" width="118" height="10" rx="2" fill="var(--muted)" fill-opacity=".35"/>\n<text x="410" y="179" font-size="9" text-anchor="middle" fill="currentColor">small shared memory</text>\n<rect x="485" y="115" width="130" height="70" rx="5" fill="var(--s1)" fill-opacity=".10" stroke="currentColor" stroke-opacity=".6"/>\n<rect x="491.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="121" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="130" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="139" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="498.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="505.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="513.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="520.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="528.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="535.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="542.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="550.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="557.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="572.4" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="579.8" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="587.2" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="594.6" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="602.0" y="148" width="6" height="7" rx="1" fill="var(--s1)"/>\n<rect x="491" y="160" width="118" height="10" rx="2" fill="var(--muted)" fill-opacity=".35"/>\n<text x="550" y="179" font-size="9" text-anchor="middle" fill="currentColor">small shared memory</text>\n<path d="M345,41 h-6 v7 h6" fill="none" stroke="var(--s2)" stroke-width="2"/>\n<text x="336" y="34" font-size="9" text-anchor="end" fill="currentColor">one row = one</text><text x="336" y="45" font-size="9" text-anchor="end" fill="currentColor">lockstep group</text>\n<rect x="345" y="195" width="270" height="24" rx="4" fill="var(--muted)" fill-opacity=".15"/><text x="480" y="211" font-size="11" text-anchor="middle" fill="currentColor">small caches; latency hidden by switching groups</text>\n<rect x="345" y="232" width="270" height="24" rx="4" fill="none" stroke="currentColor" stroke-opacity=".6" stroke-width="2"/><text x="480" y="248" font-size="11" text-anchor="middle" fill="currentColor">device memory (HBM): high bandwidth</text>\n<path d="M290,244 H345" stroke="var(--s2)" stroke-width="3" stroke-dasharray="5 3"/><path d="M297,238 l-7,6 l7,6 M338,238 l7,6 l-7,6" fill="none" stroke="var(--s2)" stroke-width="2"/>\n<text x="317" y="282" font-size="11" text-anchor="middle" fill="currentColor">interconnect between host and device: the slowest link</text>\n<text x="317" y="299" font-size="10" text-anchor="middle" fill="currentColor" opacity=".75">schematic, not to scale</text>\n</svg>\n</div>',
    function () {}
)

GF.register(
    'gf-pipe',
    '<div class="gf" id="gf-pipe">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button>\n<label>Design <select aria-label="Processor design"><option value="seq">not pipelined</option><option value="pipe" selected>pipelined</option><option value="miss">pipelined, mispredicted branch</option></select></label></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>stage in use</span><span><span class="key" style="background:var(--s2)"></span>branch instruction</span><span><span class="key" style="background:var(--muted);opacity:.5"></span>wrong-path work, thrown away</span></div>\n<svg viewBox="0 0 640 280" role="img" aria-label="A grid of instructions against clock cycles. Without pipelining each instruction occupies five cycles before the next starts. With pipelining a new instruction starts every cycle, so one finishes every cycle. With a mispredicted branch, the instructions started after the branch are discarded and the pipeline refills."></svg>\n<div class="ro"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-pipe'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                sel = root.querySelector('select'),
                ro = root.querySelector('.ro')
            var ST = ['F', 'D', 'E', 'M', 'W'],
                NC = 20,
                X0 = 120,
                Y0 = 34,
                CW = 25,
                RH = 24,
                NR = 9
            var rows, cyc
            function plan(mode) {
                var r = []
                if (mode === 'seq') {
                    for (var i = 0; i < 9; i++)
                        r.push({ name: 'instr ' + (i + 1), s: 5 * i })
                } else if (mode === 'pipe') {
                    for (var j = 0; j < 9; j++)
                        r.push({ name: 'instr ' + (j + 1), s: j })
                } else {
                    // instr 3 is a branch, resolved at the end of its execute stage (cycle 2 + 2);
                    // the two instructions fetched after it were on the wrong path.
                    r.push({ name: 'instr 1', s: 0 })
                    r.push({ name: 'instr 2', s: 1 })
                    r.push({ name: 'branch', s: 2, br: true })
                    r.push({ name: 'wrong path', s: 3, cut: 5 })
                    r.push({ name: 'wrong path', s: 4, cut: 5 })
                    for (var k = 0; k < 4; k++)
                        r.push({ name: 'instr ' + (4 + k), s: 5 + k })
                }
                return r
            }
            function draw() {
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                for (var c = 0; c < NC; c++)
                    G.txt(svg, X0 + c * CW + CW / 2, 22, String(c + 1), {
                        'text-anchor': 'middle',
                        'font-size': 10,
                        opacity: c < cyc ? 1 : 0.45,
                    })
                G.txt(svg, X0 - 10, 22, 'cycle', {
                    'text-anchor': 'end',
                    'font-size': 10,
                })
                var done = 0
                rows.forEach(function (r, i) {
                    var y = Y0 + i * RH
                    G.txt(svg, X0 - 10, y + 16, r.name, {
                        'text-anchor': 'end',
                        'font-size': 11,
                    })
                    G.el(
                        'line',
                        {
                            x1: X0,
                            x2: X0 + NC * CW,
                            y1: y + RH,
                            y2: y + RH,
                            stroke: 'var(--grid)',
                        },
                        svg
                    )
                    var last = r.cut ? r.cut : r.s + 5
                    for (var k = 0; k < 5; k++) {
                        var c2 = r.s + k
                        if (c2 >= last || c2 >= cyc || c2 >= NC) continue
                        var fill = r.cut
                            ? 'var(--muted)'
                            : r.br
                              ? 'var(--s2)'
                              : 'var(--s1)'
                        G.el(
                            'rect',
                            {
                                x: X0 + c2 * CW + 1,
                                y: y + 2,
                                width: CW - 2,
                                height: RH - 4,
                                rx: 3,
                                fill: fill,
                                'fill-opacity': r.cut ? 0.45 : 1,
                            },
                            svg
                        )
                        G.txt(svg, X0 + c2 * CW + CW / 2, y + 16, ST[k], {
                            'text-anchor': 'middle',
                            'font-size': 10,
                            fill: r.cut ? 'currentColor' : '#fff',
                        })
                    }
                    if (!r.cut && r.s + 5 <= cyc) done++
                })
                G.el(
                    'line',
                    {
                        x1: X0 + cyc * CW,
                        x2: X0 + cyc * CW,
                        y1: 10,
                        y2: Y0 + NR * RH,
                        stroke: 'currentColor',
                        'stroke-opacity': 0.5,
                    },
                    svg
                )
                ro.textContent =
                    'after ' +
                    cyc +
                    ' cycles: ' +
                    done +
                    ' instructions finished' +
                    (cyc ? ' (' + (done / cyc).toFixed(2) + ' per cycle)' : '')
            }
            function init() {
                rows = plan(sel.value)
                cyc = 0
                draw()
            }
            function tick() {
                cyc++
                if (cyc > NC) cyc = 0
                draw()
            }
            G.animator(root, play, tick, 550)
            reset.addEventListener('click', init)
            sel.addEventListener('change', init)
            init()
        })()
    }
)

GF.register(
    'gf-lat',
    '<div class="gf" id="gf-lat">\n<div class="ctl"><label><input type="checkbox" aria-label="Show on a human time scale"> show on a human time scale (one cycle = one second)</label></div>\n<svg viewBox="0 0 640 290" role="img" aria-label="Horizontal bars on a logarithmic time axis: a register access takes about one cycle, L1 cache a few cycles, L2 about ten, L3 tens, main memory hundreds, a transfer across PCI Express microseconds, and a read from a solid-state drive around a hundred microseconds."></svg>\n<div class="tip"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-lat'),
                svg = root.querySelector('svg'),
                chk = root.querySelector('input'),
                tip = root.querySelector('.tip')
            var CYC = 0.33 // ns per cycle at 3 GHz
            // Rounded, order-of-magnitude latencies (ns). Caches from the cycle counts typical of
            // recent cores; the rest are typical values, not measurements of one machine.
            var D = [
                { n: 'register', ns: 0.33, note: '1 cycle' },
                { n: 'L1 cache', ns: 1.3, note: '~4 cycles' },
                { n: 'L2 cache', ns: 4, note: '~12 cycles' },
                { n: 'L3 cache', ns: 15, note: '~45 cycles' },
                { n: 'main memory (DRAM)', ns: 90, note: '~270 cycles' },
                {
                    n: 'small transfer to a GPU (PCIe)',
                    ns: 5000,
                    note: 'a few µs',
                },
                { n: 'SSD read', ns: 100000, note: '~100 µs' },
            ]
            var X0 = 190,
                X1 = 600,
                Y0 = 15,
                RH = 34,
                lo = -1,
                hi = 6 // log10 ns
            function sx(ns) {
                return X0 + ((X1 - X0) * (Math.log10(ns) - lo)) / (hi - lo)
            }
            function human(ns) {
                var s = ns / CYC
                if (s < 60)
                    return (
                        s.toFixed(0) +
                        (s.toFixed(0) === '1' ? ' second' : ' seconds')
                    )
                if (s < 3600) return (s / 60).toFixed(0) + ' minutes'
                if (s < 86400) return (s / 3600).toFixed(1) + ' hours'
                return (s / 86400).toFixed(1) + ' days'
            }
            function fmt(ns) {
                return ns < 1000 ? ns + ' ns' : ns / 1000 + ' µs'
            }
            function draw() {
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                for (var e = lo; e <= hi; e++) {
                    G.el(
                        'line',
                        {
                            x1: sx(Math.pow(10, e)),
                            x2: sx(Math.pow(10, e)),
                            y1: Y0 - 5,
                            y2: Y0 + D.length * RH,
                            stroke: 'var(--grid)',
                        },
                        svg
                    )
                    G.txt(
                        svg,
                        sx(Math.pow(10, e)),
                        Y0 + D.length * RH + 16,
                        [
                            '0.1 ns',
                            '1 ns',
                            '10 ns',
                            '100 ns',
                            '1 µs',
                            '10 µs',
                            '100 µs',
                            '1 ms',
                        ][e - lo],
                        { 'text-anchor': 'middle', 'font-size': 10 }
                    )
                }
                G.txt(
                    svg,
                    (X0 + X1) / 2,
                    285,
                    'time for one access (logarithmic scale)',
                    { 'text-anchor': 'middle', 'font-size': 11 }
                )
                D.forEach(function (d, i) {
                    var y = Y0 + i * RH
                    G.txt(svg, X0 - 8, y + 18, d.n, {
                        'text-anchor': 'end',
                        'font-size': 11,
                    })
                    var w = sx(d.ns) - X0
                    var bar = G.el(
                        'rect',
                        {
                            x: X0,
                            y: y + 5,
                            width: Math.max(w, 2),
                            height: RH - 12,
                            rx: 3,
                            fill: i < 4 ? 'var(--s1)' : 'var(--s2)',
                        },
                        svg
                    )
                    var label = chk.checked
                        ? human(d.ns)
                        : fmt(d.ns) + ' · ' + d.note
                    G.txt(svg, X0 + Math.max(w, 2) + 6, y + 18, label, {
                        'font-size': 10,
                    })
                    var hit = G.el(
                        'rect',
                        {
                            x: 0,
                            y: y,
                            width: 640,
                            height: RH,
                            fill: 'transparent',
                        },
                        svg
                    )
                    hit.addEventListener('pointermove', function (ev) {
                        var r = svg.getBoundingClientRect()
                        tip.style.display = 'block'
                        tip.style.left =
                            Math.min(ev.clientX - r.left + 12, r.width - 230) +
                            'px'
                        tip.style.top = ev.clientY - r.top + 14 + 'px'
                        tip.innerHTML =
                            '<b>' +
                            d.n +
                            '</b><br>' +
                            fmt(d.ns) +
                            ' (' +
                            d.note +
                            ')<br>on a 1 cycle = 1 s scale: ' +
                            human(d.ns)
                    })
                    hit.addEventListener('pointerleave', function () {
                        tip.style.display = 'none'
                    })
                })
            }
            chk.addEventListener('change', draw)
            draw()
        })()
    }
)

GF.register(
    'gf-line',
    '<div class="gf" id="gf-line">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button>\n<label>Stride (elements) <select aria-label="Access stride"><option>1</option><option>2</option><option>4</option><option selected>8</option></select></label></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>element the program uses</span><span><span class="key" style="background:var(--s2);opacity:.35"></span>fetched with its cache line but unused</span></div>\n<svg viewBox="0 0 640 200" role="img" aria-label="An array of 64 numbers grouped into cache lines of eight. With stride one, each fetched line is fully used; with stride eight, one number per line is used and seven are wasted."></svg>\n<div class="ro"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-line'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                sel = root.querySelector('select'),
                ro = root.querySelector('.ro')
            var N = 64,
                PER = 8,
                NEED = 16,
                X0 = 20,
                CW = 9.4,
                Y = 60,
                H = 46,
                stride,
                k,
                used,
                lines
            function draw() {
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                G.txt(
                    svg,
                    X0,
                    30,
                    'memory (64 doubles = 8 cache lines of 64 bytes)',
                    { 'font-size': 11 }
                )
                for (var i = 0; i < N; i++) {
                    var x = X0 + i * CW + Math.floor(i / PER) * 3,
                        line = Math.floor(i / PER)
                    var fill = used[i]
                            ? 'var(--s1)'
                            : lines[line]
                              ? 'var(--s2)'
                              : 'none',
                        op = used[i] ? 1 : 0.35
                    G.el(
                        'rect',
                        {
                            x: x,
                            y: Y,
                            width: CW - 1.5,
                            height: H,
                            rx: 1.5,
                            fill: fill,
                            'fill-opacity': op,
                            stroke: 'currentColor',
                            'stroke-opacity': 0.35,
                        },
                        svg
                    )
                }
                for (var l = 0; l < N / PER; l++) {
                    var xl = X0 + l * PER * CW + l * 3
                    G.txt(
                        svg,
                        xl + (PER * CW) / 2,
                        Y + H + 18,
                        'line ' + (l + 1),
                        {
                            'text-anchor': 'middle',
                            'font-size': 10,
                            opacity: lines[l] ? 1 : 0.5,
                        }
                    )
                }
                if (k > 0 && k <= NEED) {
                    var last = (k - 1) * stride
                    if (last < N) {
                        var xa =
                            X0 + last * CW + Math.floor(last / PER) * 3 + CW / 2
                        G.el(
                            'path',
                            {
                                d: 'M' + xa + ',' + (Y - 14) + ' l-5,-9 h10 z',
                                fill: 'currentColor',
                            },
                            svg
                        )
                    }
                }
                var nl = lines.filter(Boolean).length,
                    nu = used.filter(Boolean).length
                G.txt(
                    svg,
                    X0,
                    170,
                    'bytes used: ' +
                        8 * nu +
                        ' · bytes moved from memory: ' +
                        64 * nl,
                    { 'font-size': 12 }
                )
                ro.textContent =
                    'stride ' +
                    stride +
                    ': ' +
                    (nl ? ((100 * nu) / (8 * nl)).toFixed(0) : '–') +
                    ' % of the memory traffic is useful'
            }
            function init() {
                stride = +sel.value
                k = 0
                used = new Array(N).fill(false)
                lines = new Array(N / PER).fill(false)
                draw()
            }
            function tick() {
                if (k >= NEED || k * stride >= N) {
                    init()
                    return
                }
                var i = k * stride
                used[i] = true
                lines[Math.floor(i / PER)] = true
                k++
                draw()
            }
            G.animator(root, play, tick, 450)
            reset.addEventListener('click', init)
            sel.addEventListener('change', init)
            init()
        })()
    }
)

GF.register(
    'gf-gpu-anatomy',
    '<div class="gf" id="gf-gpu-anatomy">\n<svg viewBox="0 0 640 330" role="img" aria-labelledby="ga-t ga-d" xmlns="http://www.w3.org/2000/svg">\n<title id="ga-t">Anatomy of a GPU</title>\n<desc id="ga-d">Left: a GPU chip with a grid of streaming multiprocessors sharing an L2 cache, connected to stacks of high-bandwidth memory and, through PCI Express, to the host CPU. Right: one streaming multiprocessor enlarged, showing four partitions, each with a warp scheduler, a register file, many FP32 lanes, fewer FP64 lanes and a tensor core, above a block of L1 cache and shared memory.</desc>\n<rect x="15" y="30" width="270" height="215" rx="8" fill="var(--s1)" fill-opacity=".06" stroke="currentColor" stroke-opacity=".6"/>\n<text x="150" y="22" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor">GPU chip (device)</text>\n<rect x="27" y="42" width="24" height="20" rx="2" fill="var(--s2)" fill-opacity="1"/>\n<rect x="55" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="42" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="27" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="55" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="66" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="27" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="55" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="90" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="27" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="55" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="114" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="27" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="55" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="138" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="27" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="55" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="83" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="111" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="139" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="167" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="195" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="223" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<rect x="251" y="162" width="24" height="20" rx="2" fill="var(--s1)" fill-opacity="0.55"/>\n<text x="150" y="200" font-size="10" text-anchor="middle" fill="currentColor">streaming multiprocessors (SMs): about a hundred</text>\n<rect x="27" y="208" width="246" height="26" rx="4" fill="var(--muted)" fill-opacity=".35"/><text x="150" y="225" font-size="11" text-anchor="middle" fill="currentColor">L2 cache, shared by all SMs</text>\n<rect x="25" y="258" width="50" height="30" rx="3" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="1.5"/><text x="50" y="277" font-size="9" text-anchor="middle" fill="currentColor">HBM</text>\n<rect x="95" y="258" width="50" height="30" rx="3" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="1.5"/><text x="120" y="277" font-size="9" text-anchor="middle" fill="currentColor">HBM</text>\n<rect x="165" y="258" width="50" height="30" rx="3" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="1.5"/><text x="190" y="277" font-size="9" text-anchor="middle" fill="currentColor">HBM</text>\n<rect x="235" y="258" width="50" height="30" rx="3" fill="none" stroke="currentColor" stroke-opacity=".7" stroke-width="1.5"/><text x="260" y="277" font-size="9" text-anchor="middle" fill="currentColor">HBM</text>\n<text x="150" y="304" font-size="10" text-anchor="middle" fill="currentColor">device memory: stacked high-bandwidth memory (HBM)</text>\n<path d="M150,245 V258" stroke="currentColor" stroke-width="2"/>\n<text x="150" y="322" font-size="10" text-anchor="middle" fill="var(--s2)">\u21c5 PCI Express or NVLink to the host CPU and its memory</text>\n<path d="M51,42 L330,30 M51,62 L330,300" stroke="var(--s2)" stroke-opacity=".6" stroke-dasharray="3 3"/>\n<rect x="330" y="30" width="295" height="270" rx="8" fill="none" stroke="var(--s2)" stroke-width="1.5"/>\n<text x="477" y="22" font-size="13" font-weight="600" text-anchor="middle" fill="currentColor">one SM</text>\n<rect x="340" y="40" width="133" height="98" rx="4" fill="var(--s1)" fill-opacity=".06" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="345" y="45" width="123" height="13" rx="2" fill="var(--s2)" fill-opacity=".85"/><text x="406" y="55" font-size="8.5" text-anchor="middle" fill="#fff">warp scheduler + dispatch</text>\n<rect x="345" y="61" width="123" height="12" rx="2" fill="var(--muted)" fill-opacity=".35"/><text x="406" y="70" font-size="8" text-anchor="middle" fill="currentColor">register file</text>\n<rect x="345.0" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="352.7" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="360.4" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="368.1" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="375.8" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="383.5" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="391.2" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="398.9" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="406.6" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="414.3" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="422.0" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="429.7" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="437.4" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="445.1" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="452.8" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="460.5" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="345.0" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="352.7" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="360.4" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="368.1" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="375.8" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="383.5" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="391.2" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="398.9" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="406.6" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="414.3" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="422.0" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="429.7" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="437.4" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="445.1" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="452.8" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="460.5" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<text x="406" y="102" font-size="8" text-anchor="middle" fill="currentColor">FP32 lanes</text>\n<rect x="345.0" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="352.7" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="360.4" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="368.1" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="375.8" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="383.5" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="391.2" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="398.9" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<text x="410" y="112" font-size="8" fill="currentColor">FP64 lanes</text>\n<rect x="345" y="118" width="123" height="14" rx="2" fill="var(--s3)" fill-opacity=".25" stroke="currentColor" stroke-opacity=".4"/><text x="406" y="128" font-size="8" text-anchor="middle" fill="currentColor">tensor core (matrix units)</text>\n<rect x="483" y="40" width="133" height="98" rx="4" fill="var(--s1)" fill-opacity=".06" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="488" y="45" width="123" height="13" rx="2" fill="var(--s2)" fill-opacity=".85"/><text x="549" y="55" font-size="8.5" text-anchor="middle" fill="#fff">warp scheduler + dispatch</text>\n<rect x="488" y="61" width="123" height="12" rx="2" fill="var(--muted)" fill-opacity=".35"/><text x="549" y="70" font-size="8" text-anchor="middle" fill="currentColor">register file</text>\n<rect x="488.0" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="495.7" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="503.4" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="511.1" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="518.8" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="526.5" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="534.2" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="541.9" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="549.6" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="557.3" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="572.7" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="580.4" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="588.1" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="595.8" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="603.5" y="77" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="488.0" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="495.7" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="503.4" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="511.1" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="518.8" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="526.5" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="534.2" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="541.9" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="549.6" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="557.3" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="572.7" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="580.4" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="588.1" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="595.8" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="603.5" y="85" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<text x="549" y="102" font-size="8" text-anchor="middle" fill="currentColor">FP32 lanes</text>\n<rect x="488.0" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="495.7" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="503.4" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="511.1" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="518.8" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="526.5" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="534.2" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="541.9" y="106" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<text x="553" y="112" font-size="8" fill="currentColor">FP64 lanes</text>\n<rect x="488" y="118" width="123" height="14" rx="2" fill="var(--s3)" fill-opacity=".25" stroke="currentColor" stroke-opacity=".4"/><text x="549" y="128" font-size="8" text-anchor="middle" fill="currentColor">tensor core (matrix units)</text>\n<rect x="340" y="145" width="133" height="98" rx="4" fill="var(--s1)" fill-opacity=".06" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="345" y="150" width="123" height="13" rx="2" fill="var(--s2)" fill-opacity=".85"/><text x="406" y="160" font-size="8.5" text-anchor="middle" fill="#fff">warp scheduler + dispatch</text>\n<rect x="345" y="166" width="123" height="12" rx="2" fill="var(--muted)" fill-opacity=".35"/><text x="406" y="175" font-size="8" text-anchor="middle" fill="currentColor">register file</text>\n<rect x="345.0" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="352.7" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="360.4" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="368.1" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="375.8" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="383.5" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="391.2" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="398.9" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="406.6" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="414.3" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="422.0" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="429.7" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="437.4" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="445.1" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="452.8" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="460.5" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="345.0" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="352.7" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="360.4" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="368.1" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="375.8" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="383.5" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="391.2" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="398.9" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="406.6" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="414.3" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="422.0" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="429.7" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="437.4" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="445.1" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="452.8" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="460.5" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<text x="406" y="207" font-size="8" text-anchor="middle" fill="currentColor">FP32 lanes</text>\n<rect x="345.0" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="352.7" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="360.4" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="368.1" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="375.8" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="383.5" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="391.2" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="398.9" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<text x="410" y="217" font-size="8" fill="currentColor">FP64 lanes</text>\n<rect x="345" y="223" width="123" height="14" rx="2" fill="var(--s3)" fill-opacity=".25" stroke="currentColor" stroke-opacity=".4"/><text x="406" y="233" font-size="8" text-anchor="middle" fill="currentColor">tensor core (matrix units)</text>\n<rect x="483" y="145" width="133" height="98" rx="4" fill="var(--s1)" fill-opacity=".06" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="488" y="150" width="123" height="13" rx="2" fill="var(--s2)" fill-opacity=".85"/><text x="549" y="160" font-size="8.5" text-anchor="middle" fill="#fff">warp scheduler + dispatch</text>\n<rect x="488" y="166" width="123" height="12" rx="2" fill="var(--muted)" fill-opacity=".35"/><text x="549" y="175" font-size="8" text-anchor="middle" fill="currentColor">register file</text>\n<rect x="488.0" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="495.7" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="503.4" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="511.1" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="518.8" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="526.5" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="534.2" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="541.9" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="549.6" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="557.3" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="572.7" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="580.4" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="588.1" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="595.8" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="603.5" y="182" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="488.0" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="495.7" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="503.4" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="511.1" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="518.8" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="526.5" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="534.2" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="541.9" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="549.6" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="557.3" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="565.0" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="572.7" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="580.4" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="588.1" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="595.8" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<rect x="603.5" y="190" width="6.5" height="6.5" rx="1" fill="var(--s1)"/>\n<text x="549" y="207" font-size="8" text-anchor="middle" fill="currentColor">FP32 lanes</text>\n<rect x="488.0" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="495.7" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="503.4" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="511.1" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="518.8" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="526.5" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="534.2" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<rect x="541.9" y="211" width="6.5" height="6.5" rx="1" fill="var(--s3)"/>\n<text x="553" y="217" font-size="8" fill="currentColor">FP64 lanes</text>\n<rect x="488" y="223" width="123" height="14" rx="2" fill="var(--s3)" fill-opacity=".25" stroke="currentColor" stroke-opacity=".4"/><text x="549" y="233" font-size="8" text-anchor="middle" fill="currentColor">tensor core (matrix units)</text>\n<rect x="340" y="250" width="276" height="40" rx="4" fill="var(--muted)" fill-opacity=".3"/><text x="478" y="268" font-size="10" text-anchor="middle" fill="currentColor">L1 cache / shared memory</text><text x="478" y="282" font-size="9" text-anchor="middle" fill="currentColor">(a few hundred kB, split by the program)</text>\n</svg>\n</div>',
    function () {}
)

GF.register(
    'gf-thread-hierarchy',
    '<div class="gf" id="gf-thread-hierarchy">\n<svg viewBox="0 0 640 230" role="img" aria-labelledby="th-t th-d" xmlns="http://www.w3.org/2000/svg">\n<title id="th-t">The CUDA thread hierarchy</title>\n<desc id="th-d">A kernel launch creates a grid of thread blocks. Each block runs on one SM and is split into warps of 32 threads. The 32 threads of a warp execute the same instruction together.</desc>\n<text x="110" y="20" font-size="12" font-weight="600" text-anchor="middle" fill="currentColor">grid (one kernel launch)</text>\n<rect x="20" y="32" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="57" y="32" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="94" y="32" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="131" y="32" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="168" y="32" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="20" y="69" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="57" y="69" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="94" y="69" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="131" y="69" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.9" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="168" y="69" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="20" y="106" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="57" y="106" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="94" y="106" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="131" y="106" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="168" y="106" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="20" y="143" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="57" y="143" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="94" y="143" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="131" y="143" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<rect x="168" y="143" width="32" height="32" rx="3" fill="var(--s1)" fill-opacity="0.3" stroke="currentColor" stroke-opacity=".4"/>\n<text x="110" y="200" font-size="10" text-anchor="middle" fill="currentColor">blocks are independent; the hardware</text><text x="110" y="213" font-size="10" text-anchor="middle" fill="currentColor">schedules them on SMs in any order</text>\n<path d="M163,69 L250,32 M163,101 L250,190" stroke="var(--s1)" stroke-opacity=".6" stroke-dasharray="3 3"/>\n<text x="390" y="20" font-size="12" font-weight="600" text-anchor="middle" fill="currentColor">one block (runs on one SM)</text>\n<rect x="250" y="32" width="280" height="158" rx="5" fill="var(--s1)" fill-opacity=".08" stroke="currentColor" stroke-opacity=".5"/>\n<text x="258" y="58" font-size="10" fill="currentColor">warp 1</text>\n<rect x="305.0" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="311.9" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="318.8" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="325.7" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="332.6" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="339.5" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="346.4" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="353.3" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="360.2" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="367.1" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="374.0" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="380.9" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="387.8" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="394.7" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="401.6" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="408.5" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="415.4" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="422.3" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="429.2" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="436.1" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="443.0" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="449.9" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="456.8" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="463.70000000000005" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="470.6" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="477.5" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="484.4" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="491.3" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="498.20000000000005" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="505.1" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="512.0" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<rect x="518.9" y="46" width="5.6" height="18" rx="1" fill="var(--s2)" fill-opacity="1"/>\n<text x="258" y="94" font-size="10" fill="currentColor">warp 2</text>\n<rect x="305.0" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="311.9" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="318.8" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="325.7" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="332.6" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="339.5" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="346.4" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="353.3" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="360.2" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="367.1" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="374.0" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="380.9" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="387.8" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="394.7" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="401.6" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="408.5" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="415.4" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="422.3" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="429.2" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="436.1" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="443.0" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="449.9" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="456.8" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="463.70000000000005" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="470.6" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="477.5" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="484.4" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="491.3" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="498.20000000000005" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="505.1" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="512.0" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="518.9" y="82" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<text x="258" y="130" font-size="10" fill="currentColor">warp 3</text>\n<rect x="305.0" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="311.9" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="318.8" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="325.7" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="332.6" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="339.5" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="346.4" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="353.3" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="360.2" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="367.1" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="374.0" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="380.9" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="387.8" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="394.7" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="401.6" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="408.5" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="415.4" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="422.3" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="429.2" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="436.1" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="443.0" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="449.9" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="456.8" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="463.70000000000005" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="470.6" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="477.5" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="484.4" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="491.3" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="498.20000000000005" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="505.1" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="512.0" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="518.9" y="118" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<text x="258" y="166" font-size="10" fill="currentColor">warp 4</text>\n<rect x="305.0" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="311.9" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="318.8" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="325.7" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="332.6" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="339.5" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="346.4" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="353.3" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="360.2" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="367.1" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="374.0" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="380.9" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="387.8" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="394.7" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="401.6" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="408.5" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="415.4" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="422.3" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="429.2" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="436.1" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="443.0" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="449.9" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="456.8" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="463.70000000000005" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="470.6" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="477.5" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="484.4" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="491.3" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="498.20000000000005" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="505.1" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="512.0" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<rect x="518.9" y="154" width="5.6" height="18" rx="1" fill="var(--s1)" fill-opacity="0.6"/>\n<text x="390" y="208" font-size="10" text-anchor="middle" fill="currentColor">a block of 128 threads = 4 warps of 32</text>\n<path d="M532,46 h8 v18 h-8" fill="none" stroke="var(--s2)" stroke-width="1.5"/>\n<text x="546" y="52" font-size="10" fill="currentColor">32 threads,</text><text x="546" y="64" font-size="10" fill="currentColor">one instruction</text><text x="546" y="76" font-size="10" fill="currentColor">at a time</text>\n</svg>\n</div>',
    function () {}
)

GF.register(
    'gf-hide',
    '<div class="gf" id="gf-hide">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button>\n<label>Resident warps <input type="range" min="1" max="16" step="1" value="4" aria-label="Number of resident warps"></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>instruction issued</span><span><span class="key" style="background:var(--s2);opacity:.4"></span>waiting for memory</span><span><span class="key" style="background:var(--muted);opacity:.5"></span>ready, but another warp was chosen</span></div>\n<svg viewBox="0 0 640 300" role="img" aria-label="Rows are warps sharing one scheduler; columns are clock cycles. Each warp issues four instructions, the last a memory load, then waits forty cycles. With few warps the scheduler is mostly idle; with about eleven or more it issues an instruction every cycle."></svg>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-hide'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                inp = root.querySelector('input'),
                ro = root.querySelector('.ro')
            var C = 4,
                L = 40,
                NC = 120,
                X0 = 70,
                X1 = 625,
                Y0 = 10,
                YB = 250,
                cw = (X1 - X0) / NC
            var W, cyc, ip, readyAt, last, busy, gCells, gBar
            function init() {
                W = +inp.value
                cyc = 0
                ip = new Int32Array(W)
                readyAt = new Int32Array(W)
                last = -1
                busy = 0
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                var rh = (YB - 20 - Y0) / 16
                for (var w = 0; w < W; w++) {
                    G.txt(
                        svg,
                        X0 - 8,
                        Y0 + w * rh + rh * 0.75,
                        'warp ' + (w + 1),
                        { 'text-anchor': 'end', 'font-size': 9.5 }
                    )
                    readyAt[w] = 0
                }
                G.txt(svg, X0 - 8, YB + 12, 'scheduler', {
                    'text-anchor': 'end',
                    'font-size': 10,
                })
                G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        y1: YB + 22,
                        y2: YB + 22,
                        stroke: 'currentColor',
                    },
                    svg
                )
                for (var t = 0; t <= NC; t += 20)
                    G.txt(svg, X0 + t * cw, YB + 36, String(t), {
                        'text-anchor': 'middle',
                        'font-size': 10,
                    })
                G.txt(svg, (X0 + X1) / 2, 298, 'clock cycle', {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
                gCells = G.el('g', {}, svg)
                gBar = G.el('g', {}, svg)
                svg._rh = rh
                report()
            }
            function cell(w, t, fill, op) {
                G.el(
                    'rect',
                    {
                        x: (X0 + t * cw).toFixed(2),
                        y: (Y0 + w * svg._rh + 1).toFixed(2),
                        width: Math.max(cw - 0.4, 0.5).toFixed(2),
                        height: (svg._rh - 2).toFixed(2),
                        fill: fill,
                        'fill-opacity': op,
                    },
                    gCells
                )
            }
            function step() {
                // round-robin from the warp after the last one issued
                var pick = -1
                for (var k = 1; k <= W; k++) {
                    var w = (last + k) % W
                    if (readyAt[w] <= cyc) {
                        pick = w
                        break
                    }
                }
                for (var w2 = 0; w2 < W; w2++) {
                    if (w2 === pick) cell(w2, cyc, 'var(--s1)', 1)
                    else if (
                        readyAt[w2] > cyc &&
                        ip[w2] === 0 &&
                        readyAt[w2] - cyc <= L
                    )
                        cell(w2, cyc, 'var(--s2)', 0.4)
                    else if (readyAt[w2] <= cyc)
                        cell(w2, cyc, 'var(--muted)', 0.5)
                }
                if (pick >= 0) {
                    busy++
                    last = pick
                    ip[pick]++
                    if (ip[pick] === C) {
                        ip[pick] = 0
                        readyAt[pick] = cyc + 1 + L
                    } else readyAt[pick] = cyc + 1
                    G.el(
                        'rect',
                        {
                            x: (X0 + cyc * cw).toFixed(2),
                            y: YB + 4,
                            width: Math.max(cw - 0.4, 0.5).toFixed(2),
                            height: 14,
                            fill: 'var(--s1)',
                        },
                        gBar
                    )
                }
                cyc++
            }
            function report() {
                var theory = Math.min(1, (W * C) / (C + L))
                ro.textContent =
                    W +
                    ' warp' +
                    (W > 1 ? 's' : '') +
                    ' · scheduler busy ' +
                    (cyc ? ((100 * busy) / cyc).toFixed(0) : '–') +
                    ' % of cycles so far (steady-state model: ' +
                    (100 * theory).toFixed(0) +
                    ' %) · about ' +
                    Math.ceil((C + L) / C) +
                    ' warps needed'
            }
            function tick() {
                if (cyc >= NC) {
                    init()
                    return
                }
                step()
                step()
                report()
            }
            G.animator(root, play, tick, 70)
            reset.addEventListener('click', init)
            inp.addEventListener('input', init)
            init()
        })()
    }
)

GF.register(
    'gf-div',
    '<div class="gf" id="gf-div">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button>\n<label>Threads with <i>x</i> &lt; 0 <input type="range" min="0" max="32" step="1" value="12" aria-label="Number of threads taking the first branch"></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>thread active</span><span><span class="key" style="background:var(--muted);opacity:.35"></span>thread masked off (idle)</span></div>\n<svg viewBox="0 0 640 260" role="img" aria-label="Thirty-two threads of a warp, as columns, step through an if-else statement, as rows. Threads with x below zero are active for the three instructions of the first branch and idle for the three of the second, and the other threads the reverse; when all threads agree the warp skips the untaken branch."></svg>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-div'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                inp = root.querySelector('input'),
                ro = root.querySelector('.ro')
            var X0 = 175,
                CW = 13.5,
                Y0 = 26,
                RH = 26
            var ROWS = [
                { n: 'if (x < 0)', side: 'all' },
                { n: '  a = f(x)', side: 'A' },
                { n: '  a = a * a', side: 'A' },
                { n: '  y = a + 1', side: 'A' },
                { n: 'else', side: 'none' },
                { n: '  y = g(x)', side: 'B' },
                { n: '  y = y / 2', side: 'B' },
                { n: 'z = y + c', side: 'all' },
            ]
            var order = (function () {
                var r = GF.rng(5),
                    a = []
                for (var i = 0; i < 32; i++) a.push(i)
                for (var j = 31; j > 0; j--) {
                    var k = Math.floor(r() * (j + 1))
                    var t = a[j]
                    a[j] = a[k]
                    a[k] = t
                }
                return a
            })()
            var neg, step, cycles, useful
            function init() {
                var k = +inp.value
                neg = new Array(32).fill(false)
                for (var i = 0; i < k; i++) neg[order[i]] = true
                step = 0
                cycles = 0
                useful = 0
                draw()
            }
            function active(row, t) {
                return (
                    row.side === 'all' ||
                    (row.side === 'A' && neg[t]) ||
                    (row.side === 'B' && !neg[t])
                )
            }
            function runs(row) {
                if (row.side === 'none') return false
                if (row.side === 'all') return true
                for (var t = 0; t < 32; t++) if (active(row, t)) return true
                return false
            }
            function draw() {
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                G.txt(svg, X0 + 16 * CW, 14, 'the 32 threads of one warp', {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
                ROWS.forEach(function (row, i) {
                    var y = Y0 + i * RH,
                        shown = i < step,
                        ran = runs(row)
                    var lab = G.txt(svg, 10, y + 17, row.n, {
                        'font-size': 11,
                        'font-family': 'monospace',
                        style: 'white-space:pre',
                    })
                    if (!ran && row.side !== 'none')
                        lab.setAttribute('opacity', 0.4)
                    if (!shown || row.side === 'none') return
                    if (!ran) {
                        G.txt(svg, X0, y + 17, 'skipped: no thread needs it', {
                            'font-size': 10,
                            opacity: 0.7,
                        })
                        return
                    }
                    for (var t = 0; t < 32; t++) {
                        var on = active(row, t)
                        G.el(
                            'rect',
                            {
                                x: X0 + t * CW,
                                y: y + 3,
                                width: CW - 2,
                                height: RH - 6,
                                rx: 2,
                                fill: on ? 'var(--s1)' : 'var(--muted)',
                                'fill-opacity': on ? 1 : 0.35,
                            },
                            svg
                        )
                    }
                })
                ro.textContent =
                    'cycles so far ' +
                    cycles +
                    ' · lanes doing useful work ' +
                    (cycles
                        ? ((100 * useful) / (32 * cycles)).toFixed(0)
                        : '–') +
                    ' %'
            }
            function tick() {
                if (step >= ROWS.length) {
                    init()
                    return
                }
                var row = ROWS[step]
                step++
                if (runs(row)) {
                    cycles++
                    for (var t = 0; t < 32; t++) if (active(row, t)) useful++
                }
                draw()
            }
            G.animator(root, play, tick, 600)
            reset.addEventListener('click', init)
            inp.addEventListener('input', init)
            init()
        })()
    }
)

GF.register(
    'gf-coal',
    '<div class="gf" id="gf-coal">\n<div class="ctl"><label>Access pattern <select aria-label="Memory access pattern"><option value="1" selected>thread i reads element i</option><option value="2">stride 2</option><option value="4">stride 4</option><option value="32">stride 32</option><option value="rand">scattered</option></select></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>thread of the warp</span><span><span class="key" style="background:var(--s2)"></span>32-byte sector the warp must fetch</span></div>\n<svg viewBox="0 0 640 220" role="img" aria-label="The 32 threads of a warp at the top, each joined by a line to the double-precision element it reads in device memory at the bottom. Consecutive access touches eight sectors; strided or scattered access touches up to thirty-two."></svg>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-coal'),
                svg = root.querySelector('svg'),
                sel = root.querySelector('select'),
                ro = root.querySelector('.ro')
            var X0 = 20,
                X1 = 620,
                YT = 30,
                YM = 150
            function draw() {
                while (svg.firstChild) svg.removeChild(svg.firstChild)
                var v = sel.value,
                    addr = [],
                    r = GF.rng(9)
                for (var t = 0; t < 32; t++)
                    addr.push(v === 'rand' ? Math.floor(r() * 1024) : t * +v)
                var maxA = v === 'rand' ? 1024 : Math.max(32, 32 * +v),
                    ew = (X1 - X0) / maxA // elements across the strip
                var sectors = {}
                addr.forEach(function (a) {
                    sectors[Math.floor(a / 4)] = true
                })
                var ns = Object.keys(sectors).length
                G.txt(
                    svg,
                    X0,
                    18,
                    'one warp: 32 threads, each loading one double (8 bytes)',
                    { 'font-size': 11 }
                )
                for (var t2 = 0; t2 < 32; t2++)
                    G.el(
                        'rect',
                        {
                            x: X0 + t2 * 18.75 + 2,
                            y: YT,
                            width: 14,
                            height: 14,
                            rx: 2,
                            fill: 'var(--s1)',
                        },
                        svg
                    )
                G.el(
                    'rect',
                    {
                        x: X0,
                        y: YM,
                        width: X1 - X0,
                        height: 24,
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-opacity': 0.4,
                    },
                    svg
                )
                Object.keys(sectors).forEach(function (s) {
                    G.el(
                        'rect',
                        {
                            x: X0 + +s * 4 * ew,
                            y: YM,
                            width: Math.max(4 * ew, 1.5),
                            height: 24,
                            fill: 'var(--s2)',
                            'fill-opacity': 0.8,
                        },
                        svg
                    )
                })
                addr.forEach(function (a, t3) {
                    G.el(
                        'line',
                        {
                            x1: X0 + t3 * 18.75 + 9,
                            y1: YT + 14,
                            x2: X0 + (a + 0.5) * ew,
                            y2: YM,
                            stroke: 'var(--s1)',
                            'stroke-opacity': 0.5,
                        },
                        svg
                    )
                })
                G.txt(
                    svg,
                    X0,
                    YM + 40,
                    'device memory: elements 0 … ' +
                        (maxA - 1) +
                        ' (' +
                        8 * maxA +
                        ' bytes shown)',
                    { 'font-size': 11 }
                )
                G.txt(
                    svg,
                    X0,
                    YM + 58,
                    'sectors fetched: ' +
                        ns +
                        ' × 32 B = ' +
                        32 * ns +
                        ' B for 256 B of useful data',
                    { 'font-size': 11 }
                )
                ro.textContent =
                    'efficiency ' +
                    ((100 * 256) / (32 * ns)).toFixed(0) +
                    ' % (' +
                    ns +
                    ' sector' +
                    (ns > 1 ? 's' : '') +
                    ')'
            }
            sel.addEventListener('change', draw)
            draw()
        })()
    }
)

GF.register(
    'gf-roof',
    '<div class="gf" id="gf-roof">\n<div class="ctl"><label>Kernel <select aria-label="Example kernel"><option value="0.0417">add two arrays (1 op / 24 B)</option><option value="0.125">dot product (2 ops / 16 B)</option><option value="0.25" selected>noise-weighted inner product (~10 ops / 40 B)</option><option value="4">small dense model, some reuse</option><option value="341">large matrix multiply (n = 4096)</option></select></label>\n<label><input type="checkbox" checked aria-label="Show data fed across PCI Express"> data copied over PCIe each time</label>\n<label><input type="checkbox" aria-label="Show FP32 roof"> GPU FP32 roof</label></div>\n<div class="legend"><span><span class="key" style="background:var(--s2)"></span>CPU (illustrative, FP64)</span><span><span class="key" style="background:var(--s1)"></span>A100 GPU, FP64</span><span><span class="key" style="background:var(--s3)"></span>A100 GPU, FP32</span><span><span class="key" style="border:1px dashed currentColor"></span>GPU fed over PCIe</span></div>\n<svg viewBox="0 0 640 320" role="img" aria-label="Roofline plot on logarithmic axes: attainable floating-point rate against operational intensity for a CPU and a GPU. Both rise with intensity until their peak; the GPU\'s sloped part is about three times higher, its flat roof about twice as high in FP64; a GPU fed over PCI Express sits below the CPU until high intensity."></svg>\n<div class="ro"></div>\n<div class="tip"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-roof'),
                svg = root.querySelector('svg'),
                sel = root.querySelector('select'),
                chk = root.querySelectorAll('input[type=checkbox]'),
                ro = root.querySelector('.ro'),
                tip = root.querySelector('.tip')
            var DEV = {
                cpu: { peak: 5.1e12, bw: 460e9, col: 'var(--s2)', name: 'CPU' },
                gpu: {
                    peak: 9.7e12,
                    bw: 1555e9,
                    col: 'var(--s1)',
                    name: 'GPU FP64',
                },
                g32: {
                    peak: 19.5e12,
                    bw: 1555e9,
                    col: 'var(--s3)',
                    name: 'GPU FP32',
                },
                pcie: {
                    peak: 9.7e12,
                    bw: 31.5e9,
                    col: 'currentColor',
                    name: 'GPU over PCIe',
                    dash: '5 4',
                },
            }
            var X0 = 70,
                X1 = 560,
                Y0 = 280,
                Y1 = 15,
                il = -2,
                ih = 3,
                yl = 8,
                yh = 14
            function sx(I) {
                return X0 + ((X1 - X0) * (Math.log10(I) - il)) / (ih - il)
            }
            function sy(F) {
                return (
                    Y0 -
                    ((Y0 - Y1) *
                        (Math.log10(Math.max(F, Math.pow(10, yl))) - yl)) /
                        (yh - yl)
                )
            }
            function att(d, I) {
                return Math.min(d.peak, I * d.bw)
            }
            for (var e = il; e <= ih; e++) {
                G.el(
                    'line',
                    {
                        x1: sx(Math.pow(10, e)),
                        x2: sx(Math.pow(10, e)),
                        y1: Y1,
                        y2: Y0,
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(
                    svg,
                    sx(Math.pow(10, e)),
                    Y0 + 16,
                    ['0.01', '0.1', '1', '10', '100', '1000'][e - il],
                    { 'text-anchor': 'middle', 'font-size': 11 }
                )
            }
            for (var f = yl; f <= yh; f++) {
                G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        y1: sy(Math.pow(10, f)),
                        y2: sy(Math.pow(10, f)),
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(
                    svg,
                    X0 - 8,
                    sy(Math.pow(10, f)) + 4,
                    ['100 M', '1 G', '10 G', '100 G', '1 T', '10 T', '100 T'][
                        f - yl
                    ],
                    { 'text-anchor': 'end', 'font-size': 11 }
                )
            }
            G.txt(
                svg,
                (X0 + X1) / 2,
                312,
                'operational intensity (floating-point operations per byte moved)',
                { 'text-anchor': 'middle', 'font-size': 12 }
            )
            G.txt(svg, 16, (Y0 + Y1) / 2, 'attainable FLOP/s', {
                'text-anchor': 'middle',
                'font-size': 12,
                transform: 'rotate(-90 16 ' + (Y0 + Y1) / 2 + ')',
            })
            var gDev = G.el('g', {}, svg),
                gK = G.el('g', {}, svg)
            function line(d) {
                var p = ''
                for (var i = 0; i <= 100; i++) {
                    var I = Math.pow(10, il + ((ih - il) * i) / 100)
                    p +=
                        (i ? 'L' : 'M') +
                        sx(I).toFixed(1) +
                        ',' +
                        sy(att(d, I)).toFixed(1)
                }
                G.el(
                    'path',
                    {
                        d: p,
                        fill: 'none',
                        stroke: d.col,
                        'stroke-width': 2,
                        'stroke-dasharray': d.dash || null,
                        opacity: d.dash ? 0.7 : 1,
                    },
                    gDev
                )
            }
            function shown() {
                var s = ['cpu', 'gpu']
                if (chk[0].checked) s.push('pcie')
                if (chk[1].checked) s.push('g32')
                return s
            }
            function draw() {
                while (gDev.firstChild) gDev.removeChild(gDev.firstChild)
                while (gK.firstChild) gK.removeChild(gK.firstChild)
                shown().forEach(function (k) {
                    line(DEV[k])
                })
                var I = +sel.value
                G.el(
                    'line',
                    {
                        x1: sx(I),
                        x2: sx(I),
                        y1: Y1,
                        y2: Y0,
                        stroke: 'currentColor',
                        'stroke-opacity': 0.5,
                        'stroke-dasharray': '2 3',
                    },
                    gK
                )
                shown().forEach(function (k) {
                    var d = DEV[k]
                    G.el(
                        'circle',
                        {
                            cx: sx(I),
                            cy: sy(att(d, I)),
                            r: 5,
                            fill:
                                d.col === 'currentColor'
                                    ? 'var(--muted)'
                                    : d.col,
                            stroke: 'var(--bs-body-bg, #fff)',
                            'stroke-width': 2,
                        },
                        gK
                    )
                })
                var c = att(DEV.cpu, I),
                    g = att(DEV.gpu, I),
                    p = att(DEV.pcie, I)
                function fm(v) {
                    return v >= 1e12
                        ? (v / 1e12).toFixed(2) + ' TFLOP/s'
                        : (v / 1e9).toFixed(0) + ' GFLOP/s'
                }
                ro.textContent =
                    'I = ' +
                    I +
                    ' ops/byte · CPU ' +
                    fm(c) +
                    ' · GPU ' +
                    fm(g) +
                    ' (' +
                    (g / c).toFixed(1) +
                    '× the CPU)' +
                    (chk[0].checked
                        ? ' · GPU fed over PCIe ' +
                          fm(p) +
                          ' (' +
                          (p / c).toFixed(2) +
                          '×)'
                        : '')
            }
            svg.addEventListener('pointermove', function (ev) {
                var r = svg.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * 640) / r.width
                if (x < X0 || x > X1) {
                    tip.style.display = 'none'
                    return
                }
                var I = Math.pow(10, il + ((x - X0) / (X1 - X0)) * (ih - il)),
                    s = 'I = ' + I.toPrecision(2) + ' ops/byte'
                shown().forEach(function (k) {
                    var v = att(DEV[k], I)
                    s +=
                        '<br>' +
                        DEV[k].name +
                        ': ' +
                        (v / 1e12).toPrecision(2) +
                        ' TFLOP/s'
                })
                tip.style.display = 'block'
                tip.style.left =
                    Math.min(ev.clientX - r.left + 12, r.width - 200) + 'px'
                tip.style.top = ev.clientY - r.top + 14 + 'px'
                tip.innerHTML = s
            })
            svg.addEventListener('pointerleave', function () {
                tip.style.display = 'none'
            })
            sel.addEventListener('change', draw)
            chk.forEach(function (c) {
                c.addEventListener('change', draw)
            })
            draw()
        })()
    }
)

GF.register(
    'gf-throughput',
    '<div class="gf" id="gf-throughput">\n<div class="ctl"><label>Terms in one likelihood evaluation, <i>w</i> <input type="range" min="1" max="6" step="0.5" value="3" aria-label="Base-10 logarithm of the number of terms in one likelihood evaluation"></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>GPU (16 384 lanes, launch overhead)</span><span><span class="key" style="background:var(--s2)"></span>CPU (128 lanes, no overhead)</span></div>\n<svg viewBox="0 0 640 320" role="img" aria-label="Likelihood evaluations per second against the number of chains evaluated together, for a model CPU and GPU; the GPU overtakes the CPU once the batch fills its lanes."></svg>\n<div class="tip"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-throughput'),
                svg = root.querySelector('svg'),
                inp = root.querySelector('input'),
                ro = root.querySelector('.ro'),
                tip = root.querySelector('.tip')
            // Illustrative device model (not a benchmark): per-lane op time, lane count, launch overhead.
            var P = 16384,
                Pc = 128,
                cg = 1e-6,
                cc = 0.25e-6,
                t0 = 10e-6
            function gpu(B, w) {
                return B / (t0 + cg * Math.max(1, (B * w) / P))
            }
            function cpu(B, w) {
                return B / (cc * Math.max(1, (B * w) / Pc))
            }
            var X0 = 70,
                X1 = 560,
                Y0 = 280,
                Y1 = 15,
                bmax = 5,
                ymin = 2,
                ymax = 10
            function sx(lb) {
                return X0 + ((X1 - X0) * lb) / bmax
            }
            function sy(ly) {
                return Y0 - ((Y0 - Y1) * (ly - ymin)) / (ymax - ymin)
            }
            var gAxes = G.el('g', {}, svg),
                gData = G.el('g', {}, svg),
                gHover = G.el('g', {}, svg)
            for (var e = ymin; e <= ymax; e++) {
                G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        y1: sy(e),
                        y2: sy(e),
                        stroke: 'var(--grid)',
                    },
                    gAxes
                )
                if (e % 2 === 0)
                    G.sup(gAxes, X0 - 8, sy(e) + 4, '10', String(e), {
                        'text-anchor': 'end',
                        'font-size': 11,
                    })
            }
            for (var b = 0; b <= bmax; b++) {
                G.el(
                    'line',
                    {
                        x1: sx(b),
                        x2: sx(b),
                        y1: Y0,
                        y2: Y0 + 5,
                        stroke: 'currentColor',
                    },
                    gAxes
                )
                G.sup(gAxes, sx(b), Y0 + 19, '10', String(b), {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
            }
            G.el(
                'line',
                { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: 'currentColor' },
                gAxes
            )
            G.txt(
                gAxes,
                (X0 + X1) / 2,
                314,
                'chains, walkers or particles evaluated together, B',
                { 'text-anchor': 'middle', 'font-size': 12 }
            )
            G.txt(gAxes, 16, (Y0 + Y1) / 2, 'evaluations per second', {
                'text-anchor': 'middle',
                'font-size': 12,
                transform: 'rotate(-90 16 ' + (Y0 + Y1) / 2 + ')',
            })
            var pg = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 },
                    gData
                ),
                pc = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s2)', 'stroke-width': 2 },
                    gData
                ),
                lg = G.txt(gData, 0, 0, 'GPU', { 'font-size': 12 }),
                lc = G.txt(gData, 0, 0, 'CPU', { 'font-size': 12 }),
                vx = G.el(
                    'line',
                    {
                        y1: Y1,
                        y2: Y0,
                        stroke: 'currentColor',
                        'stroke-dasharray': '4 3',
                        opacity: 0.6,
                    },
                    gData
                ),
                vt = G.txt(gData, 0, Y1 + 12, '', { 'font-size': 11 })
            var cross = G.el(
                    'line',
                    {
                        y1: Y1,
                        y2: Y0,
                        stroke: 'currentColor',
                        opacity: 0.4,
                        display: 'none',
                    },
                    gHover
                ),
                dg = G.el(
                    'circle',
                    { r: 4, fill: 'var(--s1)', display: 'none' },
                    gHover
                ),
                dc = G.el(
                    'circle',
                    { r: 4, fill: 'var(--s2)', display: 'none' },
                    gHover
                )
            function clampy(v) {
                return Math.max(ymin, Math.min(ymax, Math.log10(v)))
            }
            function fmt(v) {
                var e = Math.floor(Math.log10(v))
                return (v / Math.pow(10, e)).toFixed(1) + '×10^' + e
            }
            function draw() {
                var w = Math.pow(10, +inp.value),
                    dg_ = '',
                    dc_ = '',
                    xo = null
                for (var i = 0; i <= 200; i++) {
                    var lb = (bmax * i) / 200,
                        B = Math.pow(10, lb),
                        g = gpu(B, w),
                        c = cpu(B, w)
                    dg_ +=
                        (i ? 'L' : 'M') +
                        sx(lb).toFixed(1) +
                        ',' +
                        sy(clampy(g)).toFixed(1)
                    dc_ +=
                        (i ? 'L' : 'M') +
                        sx(lb).toFixed(1) +
                        ',' +
                        sy(clampy(c)).toFixed(1)
                    if (xo === null && g >= c) xo = B
                }
                pg.setAttribute('d', dg_)
                pc.setAttribute('d', dc_)
                var Bm = Math.pow(10, bmax)
                lg.setAttribute('x', X1 + 6)
                lg.setAttribute('y', sy(clampy(gpu(Bm, w))) + 4)
                lc.setAttribute('x', X1 + 6)
                lc.setAttribute('y', sy(clampy(cpu(Bm, w))) + 4)
                if (xo !== null && xo > 1.01) {
                    var x = sx(Math.log10(xo))
                    vx.setAttribute('x1', x)
                    vx.setAttribute('x2', x)
                    vx.setAttribute('display', '')
                    vt.setAttribute('x', x + 5)
                    vt.textContent = 'GPU ahead for B ≥ ' + Math.ceil(xo)
                    vt.setAttribute('display', '')
                } else {
                    vx.setAttribute('display', 'none')
                    vt.setAttribute('display', 'none')
                }
                ro.textContent =
                    'w = 10^' +
                    (+inp.value).toFixed(1) +
                    ' terms · ' +
                    (xo === null
                        ? 'CPU ahead at every batch size shown'
                        : xo <= 1.01
                          ? 'GPU ahead even for a single chain'
                          : 'GPU ahead once B·w ≳ ' +
                            fmt(Math.ceil(xo) * w) +
                            ' terms') +
                    ' · peak ratio ' +
                    Math.round((P / Pc) * (cc / cg)) +
                    '×'
            }
            inp.addEventListener('input', draw)
            svg.addEventListener('pointermove', function (ev) {
                var r = svg.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * 640) / r.width
                if (x < X0 || x > X1) {
                    svg.dispatchEvent(new Event('pointerleave'))
                    return
                }
                var lb = ((x - X0) / (X1 - X0)) * bmax,
                    B = Math.pow(10, lb),
                    w = Math.pow(10, +inp.value),
                    g = gpu(B, w),
                    c = cpu(B, w)
                cross.setAttribute('x1', x)
                cross.setAttribute('x2', x)
                cross.setAttribute('display', '')
                dg.setAttribute('cx', x)
                dg.setAttribute('cy', sy(clampy(g)))
                dg.setAttribute('display', '')
                dc.setAttribute('cx', x)
                dc.setAttribute('cy', sy(clampy(c)))
                dc.setAttribute('display', '')
                tip.style.display = 'block'
                tip.style.left =
                    Math.min(ev.clientX - r.left + 12, r.width - 190) + 'px'
                tip.style.top = ev.clientY - r.top + 40 + 'px'
                tip.innerHTML =
                    'B = ' +
                    Math.round(B) +
                    '<br>GPU ' +
                    fmt(g) +
                    ' /s<br>CPU ' +
                    fmt(c) +
                    ' /s<br>ratio ' +
                    (g / c).toFixed(2) +
                    '×'
            })
            svg.addEventListener('pointerleave', function () {
                cross.setAttribute('display', 'none')
                dg.setAttribute('display', 'none')
                dc.setAttribute('display', 'none')
                tip.style.display = 'none'
            })
            draw()
        })()
    }
)

GF.register(
    'gf-mh',
    '<div class="gf" id="gf-mh">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button><label>Chains, <i>B</i> <select aria-label="Number of chains"><option>16</option><option selected>256</option><option>2048</option></select></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>spread along the wide direction</span><span><span class="key" style="background:var(--s3)"></span>spread along the narrow direction</span><span><span class="key" style="border:1px dashed currentColor"></span>target value</span></div>\n<svg viewBox="0 0 640 330" role="img" aria-label="Left: many random-walk Metropolis chains, started spread over a wide box, moving together on a correlated Gaussian target. Right: the across-chain spread along the target\'s wide and narrow directions against iteration; the narrow direction settles quickly, the wide direction slowly, whatever the number of chains."></svg>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-mh'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                sel = root.querySelector('select'),
                ro = root.querySelector('.ro')
            var rho = 0.9,
                step = 0.4,
                NIT = 300,
                BOX = 6
            var su = Math.sqrt(1 + rho),
                sv = Math.sqrt(1 - rho) // target sd along (x+y)/√2 and (x−y)/√2
            function logp(x, y) {
                return (
                    -(x * x - 2 * rho * x * y + y * y) / (2 * (1 - rho * rho))
                )
            }
            // left panel: the target and the chains
            var L = { x: 15, y: 15, s: 290 }
            function px(x) {
                return L.x + ((x + BOX) / (2 * BOX)) * L.s
            }
            function py(y) {
                return L.y + ((BOX - y) / (2 * BOX)) * L.s
            }
            G.el(
                'rect',
                {
                    x: L.x,
                    y: L.y,
                    width: L.s,
                    height: L.s,
                    fill: 'none',
                    stroke: 'var(--grid)',
                },
                svg
            )
            ;[1, 2, 3].forEach(function (k) {
                G.el(
                    'ellipse',
                    {
                        cx: px(0),
                        cy: py(0),
                        rx: (k * su * L.s) / (2 * BOX),
                        ry: (k * sv * L.s) / (2 * BOX),
                        transform: 'rotate(-45 ' + px(0) + ' ' + py(0) + ')',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-opacity': 0.35,
                    },
                    svg
                )
            })
            G.txt(
                svg,
                L.x + L.s / 2,
                324,
                'chains on a correlated Gaussian target (ρ = 0.9)',
                { 'text-anchor': 'middle', 'font-size': 11 }
            )
            var gDots = G.el('g', {}, svg)
            // right panel: across-chain spread against iteration
            var R = { x0: 370, x1: 620, y0: 290, y1: 15, ymax: 4 }
            function rx(i) {
                return R.x0 + ((R.x1 - R.x0) * i) / NIT
            }
            function ry(v) {
                return R.y0 - ((R.y0 - R.y1) * Math.min(v, R.ymax)) / R.ymax
            }
            for (var t = 0; t <= R.ymax; t++) {
                G.el(
                    'line',
                    {
                        x1: R.x0,
                        x2: R.x1,
                        y1: ry(t),
                        y2: ry(t),
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(svg, R.x0 - 6, ry(t) + 4, String(t), {
                    'text-anchor': 'end',
                    'font-size': 11,
                })
            }
            for (var i = 0; i <= NIT; i += 100)
                G.txt(svg, rx(i), R.y0 + 16, String(i), {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
            G.el(
                'line',
                {
                    x1: R.x0,
                    x2: R.x1,
                    y1: R.y0,
                    y2: R.y0,
                    stroke: 'currentColor',
                },
                svg
            )
            G.txt(
                svg,
                (R.x0 + R.x1) / 2,
                324,
                'iteration (one batched step of all chains)',
                { 'text-anchor': 'middle', 'font-size': 11 }
            )
            G.txt(
                svg,
                345,
                (R.y0 + R.y1) / 2,
                'across-chain standard deviation',
                {
                    'text-anchor': 'middle',
                    'font-size': 11,
                    transform: 'rotate(-90 345 ' + (R.y0 + R.y1) / 2 + ')',
                }
            )
            ;[su, sv].forEach(function (v) {
                G.el(
                    'line',
                    {
                        x1: R.x0,
                        x2: R.x1,
                        y1: ry(v),
                        y2: ry(v),
                        stroke: 'currentColor',
                        'stroke-dasharray': '4 3',
                        opacity: 0.6,
                    },
                    svg
                )
            })
            var pU = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 },
                    svg
                ),
                pV = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s3)', 'stroke-width': 2 },
                    svg
                )
            var B, X, Y, dots, it, dU, dV, acc, r
            function stats() {
                var mu = 0,
                    mv = 0,
                    i,
                    u,
                    v
                for (i = 0; i < B; i++) {
                    mu += X[i] + Y[i]
                    mv += X[i] - Y[i]
                }
                mu /= B * Math.SQRT2
                mv /= B * Math.SQRT2
                var vu = 0,
                    vv = 0
                for (i = 0; i < B; i++) {
                    u = (X[i] + Y[i]) / Math.SQRT2 - mu
                    v = (X[i] - Y[i]) / Math.SQRT2 - mv
                    vu += u * u
                    vv += v * v
                }
                return [Math.sqrt(vu / (B - 1)), Math.sqrt(vv / (B - 1))]
            }
            function init() {
                B = +sel.value
                r = G.rng(7 + B)
                X = new Float64Array(B)
                Y = new Float64Array(B)
                while (gDots.firstChild) gDots.removeChild(gDots.firstChild)
                dots = []
                var rad = B > 1000 ? 1.4 : B > 100 ? 2.2 : 3.5
                for (var i = 0; i < B; i++) {
                    X[i] = (2 * r() - 1) * BOX
                    Y[i] = (2 * r() - 1) * BOX
                    dots.push(
                        G.el(
                            'circle',
                            { r: rad, fill: 'var(--s1)', 'fill-opacity': 0.75 },
                            gDots
                        )
                    )
                }
                it = 0
                acc = 0
                var s = stats()
                dU = 'M' + rx(0) + ',' + ry(s[0])
                dV = 'M' + rx(0) + ',' + ry(s[1])
                render()
            }
            function render() {
                for (var i = 0; i < B; i++) {
                    dots[i].setAttribute('cx', px(X[i]).toFixed(1))
                    dots[i].setAttribute('cy', py(Y[i]).toFixed(1))
                }
                pU.setAttribute('d', dU)
                pV.setAttribute('d', dV)
                ro.textContent =
                    'iteration ' +
                    it +
                    ' · ' +
                    B +
                    ' density evaluations per iteration · acceptance ' +
                    (it ? ((100 * acc) / (it * B)).toFixed(0) : '–') +
                    ' %'
            }
            function tick() {
                if (it >= NIT) {
                    anim.set(false)
                    return
                }
                // one lockstep iteration: propose for every chain, evaluate all, accept by mask
                for (var i = 0; i < B; i++) {
                    var xn = X[i] + step * G.normal(r),
                        yn = Y[i] + step * G.normal(r)
                    if (Math.log(r()) < logp(xn, yn) - logp(X[i], Y[i])) {
                        X[i] = xn
                        Y[i] = yn
                        acc++
                    }
                }
                it++
                var s = stats()
                dU += 'L' + rx(it).toFixed(1) + ',' + ry(s[0]).toFixed(1)
                dV += 'L' + rx(it).toFixed(1) + ',' + ry(s[1]).toFixed(1)
                render()
            }
            var anim = G.animator(root, play, tick, 60)
            reset.addEventListener('click', init)
            sel.addEventListener('change', init)
            init()
        })()
    }
)

GF.register(
    'gf-lock',
    '<div class="gf" id="gf-lock">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button>\n<label>Scheme <select data-mode aria-label="Execution scheme"><option value="var" selected>NUTS-like, lockstep</option><option value="fix">Fixed length, lockstep</option><option value="fsm">NUTS-like, no waiting</option></select></label>\n<label>Chains <select data-b aria-label="Number of chains"><option>8</option><option selected>16</option><option>32</option></select></label></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>gradient evaluations (one block per transition)</span><span><span class="key" style="background:var(--muted);opacity:.45"></span>idle: waiting for the slowest chain</span></div>\n<svg viewBox="0 0 640 300" role="img" aria-label="Rows are chains and the horizontal axis is time on the device. In lockstep, every iteration lasts as long as the longest trajectory in the batch and the other chains sit idle; with a fixed trajectory length nothing idles; without waiting, each chain starts its next transition as soon as it finishes."></svg>\n<div class="ro"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-lock'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                selM = root.querySelector('[data-mode]'),
                selB = root.querySelector('[data-b]'),
                ro = root.querySelector('.ro')
            var X0 = 70,
                X1 = 625,
                Y0 = 20,
                Y1 = 270,
                SPAN = 900 // gradient evaluations shown across the width
            var s = (X1 - X0) / SPAN,
                LFIX = Math.round(G.meanL)
            G.el(
                'line',
                {
                    x1: X0,
                    x2: X1,
                    y1: Y1 + 4,
                    y2: Y1 + 4,
                    stroke: 'currentColor',
                },
                svg
            )
            G.txt(
                svg,
                (X0 + X1) / 2,
                294,
                'time on the device, in gradient evaluations →',
                { 'text-anchor': 'middle', 'font-size': 11 }
            )
            G.txt(svg, 14, (Y0 + Y1) / 2, 'chains', {
                'text-anchor': 'middle',
                'font-size': 11,
                transform: 'rotate(-90 14 ' + (Y0 + Y1) / 2 + ')',
            })
            var g = G.el('g', {}, svg),
                gLab = G.el('g', {}, svg)
            var mode, B, r, h, t, cur, pend, useful, total, trans, iters
            function rowY(b) {
                return Y0 + b * h
            }
            function init() {
                mode = selM.value
                B = +selB.value
                r = G.rng(11 + B)
                h = (Y1 - Y0) / B
                while (g.firstChild) g.removeChild(g.firstChild)
                while (gLab.firstChild) gLab.removeChild(gLab.firstChild)
                for (var b = 0; b < B; b++)
                    if (B <= 16 || b % 4 === 0)
                        G.txt(
                            gLab,
                            X0 - 8,
                            rowY(b) + h / 2 + 4,
                            String(b + 1),
                            { 'text-anchor': 'end', 'font-size': 10 }
                        )
                t = 0
                cur = new Float64Array(B)
                pend = new Int32Array(B)
                trans = new Int32Array(B)
                useful = 0
                total = 0
                iters = 0
                report()
            }
            function rect(x, y, w, fill, op) {
                if (w > 0)
                    G.el(
                        'rect',
                        {
                            x: (X0 + x * s).toFixed(1),
                            y: (y + 0.6).toFixed(1),
                            width: Math.max(w * s - 1.5, 0.5).toFixed(1),
                            height: Math.max(h - 1.2, 1).toFixed(1),
                            rx: 1,
                            fill: fill,
                            'fill-opacity': op,
                        },
                        g
                    )
            }
            function report() {
                var lo = Infinity,
                    hi = 0
                for (var b = 0; b < B; b++) {
                    lo = Math.min(lo, trans[b])
                    hi = Math.max(hi, trans[b])
                }
                ro.textContent = total
                    ? 'useful work ' +
                      ((100 * useful) / total).toFixed(0) +
                      ' % · transitions per chain ' +
                      (lo === hi ? lo : lo + '–' + hi) +
                      (mode === 'fsm'
                          ? ' (chains drift apart; the run ends when the slowest reaches its quota)'
                          : '')
                    : 'mean trajectory length ' +
                      G.meanL.toFixed(1) +
                      ' gradients'
            }
            function tick() {
                if (mode === 'fsm') {
                    // each chain starts its next transition as soon as the last one ends
                    var tn = t + 60
                    if (tn > SPAN) {
                        anim.set(false)
                        return
                    }
                    for (var b = 0; b < B; b++) {
                        if (pend[b] && cur[b] <= tn) {
                            trans[b]++
                            pend[b] = 0
                        }
                        while (cur[b] < tn) {
                            var L = G.drawL(r),
                                w = Math.min(L, SPAN - cur[b])
                            rect(cur[b], rowY(b), w, 'var(--s1)', 1)
                            cur[b] += L
                            if (cur[b] <= tn) trans[b]++
                            else pend[b] = 1
                        }
                    }
                    t = tn
                    total = B * t
                    useful = total // no chain ever waits
                } else {
                    var Ls = [],
                        D = 0
                    for (var b2 = 0; b2 < B; b2++) {
                        var L2 = mode === 'fix' ? LFIX : G.drawL(r)
                        Ls.push(L2)
                        D = Math.max(D, L2)
                    }
                    if (t + D > SPAN) {
                        anim.set(false)
                        return
                    }
                    for (var b3 = 0; b3 < B; b3++) {
                        rect(t, rowY(b3), Ls[b3], 'var(--s1)', 1)
                        rect(
                            t + Ls[b3],
                            rowY(b3),
                            D - Ls[b3],
                            'var(--muted)',
                            0.35
                        )
                        useful += Ls[b3]
                        trans[b3]++
                    }
                    G.el(
                        'line',
                        {
                            x1: X0 + (t + D) * s,
                            x2: X0 + (t + D) * s,
                            y1: Y0 - 4,
                            y2: Y1 + 4,
                            stroke: 'currentColor',
                            'stroke-opacity': 0.35,
                        },
                        g
                    )
                    t += D
                    total += B * D
                    iters++
                }
                report()
            }
            var anim = G.animator(root, play, tick, 450)
            reset.addEventListener('click', init)
            selM.addEventListener('change', init)
            selB.addEventListener('change', init)
            init()
        })()
    }
)

GF.register(
    'gf-eta',
    '<div class="gf" id="gf-eta">\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>exponential lengths: \u03b7 = 1/H<sub>B</sub></span><span><span class="key" style="background:var(--s2)"></span>NUTS-like power-of-two lengths</span><span><span class="key" style="border:1px dashed currentColor"></span>fixed length</span></div>\n<svg viewBox="0 0 640 300" role="img" aria-label="Useful fraction of a lockstep batch against the number of chains, for exponential and power-of-two trajectory lengths; both fall as the batch grows, while a fixed length stays at one."></svg>\n<div class="tip"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-eta'),
                svg = root.querySelector('svg'),
                tip = root.querySelector('.tip')
            var X0 = 60,
                X1 = 560,
                Y0 = 260,
                Y1 = 15,
                KMAX = 12 // B = 2^0 … 2^12
            function sx(k) {
                return X0 + ((X1 - X0) * k) / KMAX
            }
            function sy(v) {
                return Y0 - (Y0 - Y1) * v
            }
            function etaExp(B) {
                var H = 0
                for (var i = 1; i <= B; i++) H += 1 / i
                return 1 / H
            }
            var pmf = G.depthPmf
            function etaNuts(B) {
                // exact: E[max of B draws] from the discrete pmf
                var F = 0,
                    prev = 0,
                    Em = 0
                pmf.forEach(function (d) {
                    F += d.p
                    var c = Math.pow(F, B)
                    Em += d.L * (c - prev)
                    prev = c
                })
                return G.meanL / Em
            }
            for (var v = 0; v <= 1.0001; v += 0.25) {
                G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        y1: sy(v),
                        y2: sy(v),
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(svg, X0 - 8, sy(v) + 4, v.toFixed(2), {
                    'text-anchor': 'end',
                    'font-size': 11,
                })
            }
            for (var k = 0; k <= KMAX; k += 2) {
                G.el(
                    'line',
                    {
                        x1: sx(k),
                        x2: sx(k),
                        y1: Y0,
                        y2: Y0 + 5,
                        stroke: 'currentColor',
                    },
                    svg
                )
                G.txt(svg, sx(k), Y0 + 19, String(Math.pow(2, k)), {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
            }
            G.el(
                'line',
                { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: 'currentColor' },
                svg
            )
            G.txt(svg, (X0 + X1) / 2, 294, 'chains in the lockstep batch, B', {
                'text-anchor': 'middle',
                'font-size': 12,
            })
            G.txt(svg, 16, (Y0 + Y1) / 2, 'useful fraction η', {
                'text-anchor': 'middle',
                'font-size': 12,
                transform: 'rotate(-90 16 ' + (Y0 + Y1) / 2 + ')',
            })
            var de = '',
                dn = '',
                N = 120
            for (var i = 0; i <= N; i++) {
                var kk = (KMAX * i) / N,
                    B = Math.round(Math.pow(2, kk))
                de +=
                    (i ? 'L' : 'M') +
                    sx(kk).toFixed(1) +
                    ',' +
                    sy(etaExp(B)).toFixed(1)
                dn +=
                    (i ? 'L' : 'M') +
                    sx(kk).toFixed(1) +
                    ',' +
                    sy(etaNuts(B)).toFixed(1)
            }
            G.el(
                'line',
                {
                    x1: X0,
                    x2: X1,
                    y1: sy(1),
                    y2: sy(1),
                    stroke: 'currentColor',
                    'stroke-dasharray': '5 4',
                    opacity: 0.7,
                },
                svg
            )
            G.txt(svg, X1 + 6, sy(1) + 4, 'fixed', { 'font-size': 12 })
            G.el(
                'path',
                { d: de, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 },
                svg
            )
            G.el(
                'path',
                { d: dn, fill: 'none', stroke: 'var(--s2)', 'stroke-width': 2 },
                svg
            )
            var Bend = Math.pow(2, KMAX)
            G.txt(svg, X1 + 6, sy(etaExp(Bend)) - 4, 'exponential', {
                'font-size': 12,
            })
            G.txt(svg, X1 + 6, sy(etaNuts(Bend)) + 12, 'NUTS-like', {
                'font-size': 12,
            })
            // one direct value label: the B = 1000 case quoted in the text
            var k1000 = Math.log2(1000)
            G.el(
                'circle',
                {
                    cx: sx(k1000),
                    cy: sy(etaExp(1000)),
                    r: 4,
                    fill: 'var(--s1)',
                },
                svg
            )
            G.txt(
                svg,
                sx(k1000) - 6,
                sy(etaExp(1000)) - 9,
                'B = 1000: η ≈ ' + etaExp(1000).toFixed(2),
                { 'text-anchor': 'end', 'font-size': 11 }
            )
            var cross = G.el(
                    'line',
                    {
                        y1: Y1,
                        y2: Y0,
                        stroke: 'currentColor',
                        opacity: 0.4,
                        display: 'none',
                    },
                    svg
                ),
                ce = G.el(
                    'circle',
                    { r: 4, fill: 'var(--s1)', display: 'none' },
                    svg
                ),
                cn = G.el(
                    'circle',
                    { r: 4, fill: 'var(--s2)', display: 'none' },
                    svg
                )
            svg.addEventListener('pointermove', function (ev) {
                var r = svg.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * 640) / r.width
                if (x < X0 || x > X1) {
                    svg.dispatchEvent(new Event('pointerleave'))
                    return
                }
                var kk = ((x - X0) / (X1 - X0)) * KMAX,
                    B = Math.max(1, Math.round(Math.pow(2, kk))),
                    xx = sx(Math.log2(B)),
                    e = etaExp(B),
                    n = etaNuts(B)
                cross.setAttribute('x1', xx)
                cross.setAttribute('x2', xx)
                cross.setAttribute('display', '')
                ce.setAttribute('cx', xx)
                ce.setAttribute('cy', sy(e))
                ce.setAttribute('display', '')
                cn.setAttribute('cx', xx)
                cn.setAttribute('cy', sy(n))
                cn.setAttribute('display', '')
                tip.style.display = 'block'
                tip.style.left =
                    Math.min(ev.clientX - r.left + 12, r.width - 170) + 'px'
                tip.style.top = ev.clientY - r.top + 20 + 'px'
                tip.innerHTML =
                    'B = ' +
                    B +
                    '<br>exponential η = ' +
                    e.toFixed(3) +
                    '<br>NUTS-like η = ' +
                    n.toFixed(3) +
                    '<br>fixed η = 1'
            })
            svg.addEventListener('pointerleave', function () {
                cross.setAttribute('display', 'none')
                ce.setAttribute('display', 'none')
                cn.setAttribute('display', 'none')
                tip.style.display = 'none'
            })
        })()
    }
)

GF.register(
    'gf-ns',
    '<div class="gf" id="gf-ns">\n<div class="ctl"><button type="button">Play</button><button type="button" data-reset>Reset</button><label>Points deleted per iteration, <i>k</i> <select aria-label="Points deleted per iteration"><option value="1" selected>1 (classic)</option><option value="10">10 (batched)</option></select></label></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>live points; k = 1 run</span><span><span class="key" style="background:var(--s3)"></span>k = 10 run</span><span><span class="key" style="background:var(--s2)"></span>threshold contour and fresh replacements</span><span>solid: estimated ln X \u00b7 dashed: true ln X</span></div>\n<svg viewBox="0 0 640 330" role="img" aria-label="Left: 100 live points of nested sampling on a two-dimensional Gaussian likelihood, with the current likelihood threshold drawn as a shrinking circle. Right: estimated and true log prior volume against iteration; deleting ten points per iteration reaches the same compression in a tenth of the iterations."></svg>\n<div class="ro"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-ns'),
                svg = root.querySelector('svg'),
                play = root.querySelector('button'),
                reset = root.querySelector('[data-reset]'),
                sel = root.querySelector('select'),
                ro = root.querySelector('.ro')
            var n = 100,
                LNXMIN = -8,
                NIT = 800
            function area(r) {
                // area of the disc of radius r inside the prior square [-1,1]^2
                if (r <= 1) return Math.PI * r * r
                if (r >= Math.SQRT2) return 4
                return (
                    Math.PI * r * r -
                    4 * (r * r * Math.acos(1 / r) - Math.sqrt(r * r - 1))
                )
            }
            var L = { x: 15, y: 15, s: 290 }
            function px(x) {
                return L.x + ((x + 1) / 2) * L.s
            }
            function py(y) {
                return L.y + ((1 - y) / 2) * L.s
            }
            G.el(
                'rect',
                {
                    x: L.x,
                    y: L.y,
                    width: L.s,
                    height: L.s,
                    fill: 'none',
                    stroke: 'currentColor',
                    'stroke-opacity': 0.5,
                },
                svg
            )
            G.txt(
                svg,
                L.x + L.s / 2,
                324,
                'uniform prior on the square; Gaussian likelihood',
                { 'text-anchor': 'middle', 'font-size': 11 }
            )
            var gDead = G.el('g', {}, svg),
                circ = G.el(
                    'circle',
                    {
                        cx: px(0),
                        cy: py(0),
                        fill: 'none',
                        stroke: 'var(--s2)',
                        'stroke-width': 2,
                    },
                    svg
                ),
                gLive = G.el('g', {}, svg)
            var R = { x0: 370, x1: 620, y0: 290, y1: 15 }
            function rx(i) {
                return R.x0 + ((R.x1 - R.x0) * i) / NIT
            }
            function ry(v) {
                return R.y1 + ((R.y0 - R.y1) * v) / LNXMIN
            }
            for (var v = 0; v >= LNXMIN; v -= 2) {
                G.el(
                    'line',
                    {
                        x1: R.x0,
                        x2: R.x1,
                        y1: ry(v),
                        y2: ry(v),
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(svg, R.x0 - 6, ry(v) + 4, String(v), {
                    'text-anchor': 'end',
                    'font-size': 11,
                })
            }
            for (var i = 0; i <= NIT; i += 200)
                G.txt(svg, rx(i), R.y0 + 16, String(i), {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
            G.el(
                'line',
                {
                    x1: R.x0,
                    x2: R.x1,
                    y1: R.y0,
                    y2: R.y0,
                    stroke: 'currentColor',
                },
                svg
            )
            G.txt(svg, (R.x0 + R.x1) / 2, 324, 'iteration', {
                'text-anchor': 'middle',
                'font-size': 11,
            })
            G.txt(svg, 345, (R.y0 + R.y1) / 2, 'log prior volume, ln X', {
                'text-anchor': 'middle',
                'font-size': 11,
                transform: 'rotate(-90 345 ' + (R.y0 + R.y1) / 2 + ')',
            })
            var paths = {}
            ;[
                ['1', 'var(--s1)'],
                ['10', 'var(--s3)'],
            ].forEach(function (c) {
                paths[c[0]] = {
                    est: G.el(
                        'path',
                        { fill: 'none', stroke: c[1], 'stroke-width': 2 },
                        svg
                    ),
                    tru: G.el(
                        'path',
                        {
                            fill: 'none',
                            stroke: c[1],
                            'stroke-width': 1.5,
                            'stroke-dasharray': '4 3',
                        },
                        svg
                    ),
                }
            })
            var k, r, P, it, lnX, dE, dT, deadN, dots
            function rad(p) {
                return Math.hypot(p[0], p[1])
            }
            function draw1(rmax) {
                var x, y
                do {
                    var rr = rmax * Math.sqrt(r()),
                        th = 2 * Math.PI * r()
                    x = rr * Math.cos(th)
                    y = rr * Math.sin(th)
                } while (Math.abs(x) > 1 || Math.abs(y) > 1)
                return [x, y]
            }
            function init(clearAll) {
                k = +sel.value
                r = G.rng(3 + k)
                P = []
                for (var i = 0; i < n; i++) P.push([2 * r() - 1, 2 * r() - 1])
                if (clearAll)
                    for (var key in paths) {
                        paths[key].est.setAttribute('d', '')
                        paths[key].tru.setAttribute('d', '')
                    }
                while (gDead.firstChild) gDead.removeChild(gDead.firstChild)
                deadN = 0
                it = 0
                lnX = 0
                dE = 'M' + rx(0) + ',' + ry(0)
                dT = dE
                render([])
            }
            function render(fresh) {
                while (gLive.firstChild) gLive.removeChild(gLive.firstChild)
                var col = k === 1 ? 'var(--s1)' : 'var(--s3)',
                    rmax = 0
                P.forEach(function (p) {
                    rmax = Math.max(rmax, rad(p))
                    G.el(
                        'circle',
                        {
                            cx: px(p[0]).toFixed(1),
                            cy: py(p[1]).toFixed(1),
                            r: 3,
                            fill: col,
                        },
                        gLive
                    )
                })
                fresh.forEach(function (p) {
                    G.el(
                        'circle',
                        {
                            cx: px(p[0]).toFixed(1),
                            cy: py(p[1]).toFixed(1),
                            r: 3.5,
                            fill: 'var(--s2)',
                        },
                        gLive
                    )
                })
                circ.setAttribute('r', ((rmax * L.s) / 2).toFixed(1))
                paths[String(k)].est.setAttribute('d', dE)
                paths[String(k)].tru.setAttribute('d', dT)
                var lnXt = Math.log(area(rmax) / 4)
                ro.textContent =
                    'k = ' +
                    k +
                    ' · iteration ' +
                    it +
                    ' · likelihood evaluations ' +
                    (n + k * it) +
                    ' · ln X estimated ' +
                    lnX.toFixed(2) +
                    ', true ' +
                    lnXt.toFixed(2) +
                    ' · rejection from the prior would need ≈ ' +
                    Math.round(Math.exp(-lnXt)) +
                    ' draws per replacement'
                return lnXt
            }
            function tick() {
                P.sort(function (a, b) {
                    return rad(b) - rad(a)
                }) // lowest likelihood first
                var dead = P.splice(0, k),
                    rstar = rad(dead[dead.length - 1])
                dead.forEach(function (p) {
                    if (deadN < 400) {
                        G.el(
                            'circle',
                            {
                                cx: px(p[0]).toFixed(1),
                                cy: py(p[1]).toFixed(1),
                                r: 1.6,
                                fill: 'var(--muted)',
                                'fill-opacity': 0.5,
                            },
                            gDead
                        )
                        deadN++
                    }
                })
                var fresh = []
                for (var j = 0; j < k; j++) {
                    lnX -= 1 / (n - j)
                    var q = draw1(rstar)
                    fresh.push(q)
                    P.push(q)
                }
                it++
                var lnXt = render(fresh) // threshold for the next deletion is the new outermost point
                var lnXdel = Math.log(area(rstar) / 4)
                dE +=
                    'L' +
                    rx(it).toFixed(1) +
                    ',' +
                    ry(Math.max(lnX, LNXMIN)).toFixed(1)
                dT +=
                    'L' +
                    rx(it).toFixed(1) +
                    ',' +
                    ry(Math.max(lnXdel, LNXMIN)).toFixed(1)
                paths[String(k)].est.setAttribute('d', dE)
                paths[String(k)].tru.setAttribute('d', dT)
                if (lnXdel <= LNXMIN || it >= NIT) anim.set(false)
            }
            var anim = G.animator(root, play, tick, 35)
            reset.addEventListener('click', function () {
                init(true)
            })
            sel.addEventListener('change', function () {
                init(false)
            })
            init(true)
        })()
    }
)

GF.register(
    'gf-amd',
    '<div class="gf" id="gf-amd">\n<div class="ctl"><label>Serial fraction <i>f</i> <input type="range" min="0" max="0.3" step="0.005" value="0.05" aria-label="Serial fraction"></label><span class="ro"></span></div>\n<div class="legend"><span><span class="key" style="background:var(--s1)"></span>Amdahl: fixed problem size</span><span><span class="key" style="background:var(--s3)"></span>Gustafson: problem grows with cores</span><span><span class="key" style="border:1px dashed currentColor"></span>ideal, S = N</span></div>\n<svg viewBox="0 0 640 300" role="img" aria-label="Speed-up against number of cores on logarithmic axes. The ideal line rises one-to-one; Gustafson\'s scaled speed-up stays close to it; Amdahl\'s speed-up flattens at one over the serial fraction."></svg>\n<div class="tip"></div>\n</div>',
    function () {
        ;(function () {
            var G = GF,
                root = document.getElementById('gf-amd'),
                svg = root.querySelector('svg'),
                inp = root.querySelector('input'),
                ro = root.querySelector('.ro'),
                tip = root.querySelector('.tip')
            var X0 = 60,
                X1 = 560,
                Y0 = 260,
                Y1 = 15,
                KM = 10 // N = 2^0 … 2^10
            function sx(k) {
                return X0 + ((X1 - X0) * k) / KM
            }
            function sy(l2) {
                return Y0 - ((Y0 - Y1) * l2) / KM
            }
            for (var k = 0; k <= KM; k += 2) {
                G.el(
                    'line',
                    {
                        x1: sx(k),
                        x2: sx(k),
                        y1: Y1,
                        y2: Y0,
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        y1: sy(k),
                        y2: sy(k),
                        stroke: 'var(--grid)',
                    },
                    svg
                )
                G.txt(svg, sx(k), Y0 + 16, String(Math.pow(2, k)), {
                    'text-anchor': 'middle',
                    'font-size': 11,
                })
                G.txt(svg, X0 - 8, sy(k) + 4, String(Math.pow(2, k)), {
                    'text-anchor': 'end',
                    'font-size': 11,
                })
            }
            G.txt(svg, (X0 + X1) / 2, 294, 'cores, N', {
                'text-anchor': 'middle',
                'font-size': 12,
            })
            G.txt(svg, 16, (Y0 + Y1) / 2, 'speed-up, S', {
                'text-anchor': 'middle',
                'font-size': 12,
                transform: 'rotate(-90 16 ' + (Y0 + Y1) / 2 + ')',
            })
            G.el(
                'path',
                {
                    d: 'M' + sx(0) + ',' + sy(0) + 'L' + sx(KM) + ',' + sy(KM),
                    stroke: 'currentColor',
                    'stroke-dasharray': '5 4',
                    opacity: 0.6,
                },
                svg
            )
            var pa = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2 },
                    svg
                ),
                pg = G.el(
                    'path',
                    { fill: 'none', stroke: 'var(--s3)', 'stroke-width': 2 },
                    svg
                ),
                la = G.txt(svg, 0, 0, 'Amdahl', { 'font-size': 12 }),
                lg = G.txt(svg, 0, 0, 'Gustafson', { 'font-size': 12 }),
                cap = G.el(
                    'line',
                    {
                        x1: X0,
                        x2: X1,
                        stroke: 'var(--s1)',
                        'stroke-dasharray': '2 3',
                        opacity: 0.7,
                    },
                    svg
                ),
                capt = G.txt(svg, X0 + 6, 0, '', { 'font-size': 10 })
            function am(N, f) {
                return 1 / (f + (1 - f) / N)
            }
            function gu(N, f) {
                return N - f * (N - 1)
            }
            function draw() {
                var f = +inp.value,
                    da = '',
                    dg = ''
                for (var i = 0; i <= 100; i++) {
                    var kk = (KM * i) / 100,
                        N = Math.pow(2, kk)
                    da +=
                        (i ? 'L' : 'M') +
                        sx(kk).toFixed(1) +
                        ',' +
                        sy(Math.log2(am(N, f))).toFixed(1)
                    dg +=
                        (i ? 'L' : 'M') +
                        sx(kk).toFixed(1) +
                        ',' +
                        sy(Math.log2(gu(N, f))).toFixed(1)
                }
                pa.setAttribute('d', da)
                pg.setAttribute('d', dg)
                var NM = Math.pow(2, KM)
                la.setAttribute('x', X1 + 6)
                la.setAttribute('y', sy(Math.log2(am(NM, f))) + 4)
                lg.setAttribute('x', X1 + 6)
                lg.setAttribute('y', sy(Math.log2(gu(NM, f))) + 4)
                if (f > 0) {
                    var yc = sy(Math.log2(1 / f))
                    cap.setAttribute('y1', yc)
                    cap.setAttribute('y2', yc)
                    cap.setAttribute('display', '')
                    capt.setAttribute('y', yc - 5)
                    capt.textContent =
                        'Amdahl limit 1/f = ' + (1 / f).toFixed(0)
                    capt.setAttribute('display', '')
                } else {
                    cap.setAttribute('display', 'none')
                    capt.setAttribute('display', 'none')
                }
                ro.textContent =
                    'f = ' +
                    (100 * f).toFixed(1) +
                    ' % serial · on 64 cores: Amdahl ' +
                    am(64, f).toFixed(1) +
                    '×, Gustafson ' +
                    gu(64, f).toFixed(1) +
                    '×'
            }
            svg.addEventListener('pointermove', function (ev) {
                var r = svg.getBoundingClientRect(),
                    x = ((ev.clientX - r.left) * 640) / r.width
                if (x < X0 || x > X1) {
                    tip.style.display = 'none'
                    return
                }
                var N = Math.max(
                        1,
                        Math.round(Math.pow(2, ((x - X0) / (X1 - X0)) * KM))
                    ),
                    f = +inp.value
                tip.style.display = 'block'
                tip.style.left =
                    Math.min(ev.clientX - r.left + 12, r.width - 160) + 'px'
                tip.style.top = ev.clientY - r.top + 14 + 'px'
                tip.innerHTML =
                    'N = ' +
                    N +
                    '<br>Amdahl ' +
                    am(N, f).toFixed(1) +
                    '×<br>Gustafson ' +
                    gu(N, f).toFixed(1) +
                    '×'
            })
            svg.addEventListener('pointerleave', function () {
                tip.style.display = 'none'
            })
            inp.addEventListener('input', draw)
            draw()
        })()
    }
)
