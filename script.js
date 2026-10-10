const canvas = document.getElementById("cvs");
const ctx = canvas.getContext("2d");

const SC = 28; 
const OY = 25; 
const DURATION = 8; // Чуть быстрее сборка
const TICK = 16;
const ANIM = 42;
const LIFT = 34;
const GAP = 7;
const SIZES = [15, 17, 19, 21]; 
const FONT = "Arial";
const BG = "#060208";
const BGC = [0x06 / 255, 0x02 / 255, 0x08 / 255];
const FLASH = [1.0, 0.9, 0.9]; // Более яркие вспышки

const PHRASES = [
    "I love you", "Мен сені жақсы көремін", "我爱你", "사랑해", 
    "愛してる", "Men seni sevaman", "Te iubesc", "Seni seviyorum", 
    "Te amo", "Je t'aime", "Ich liebe dich", "Ti amo", 
    "Eu te amo", "Я тебя люблю", "मैं तुमसे प्यार करता हूँ", 
    "Σ' αγαπώ", "Ik hou van jou", "Jag älskar dig", "Kocham cię", 
    "ฉันรักเธอ", "Anh yêu em", "Aku cinta kamu", "Я тебе кохаю"
];

const CX = 500;
const CY_offset = 500;

ctx.textAlign = "center";
ctx.textBaseline = "middle";

class Random {
    constructor(seed) { this.seed = seed; }
    next() {
        this.seed = (this.seed * 9301 + 49297) % 233280;
        return this.seed / 233280;
    }
    uniform(min, max) { return min + this.next() * (max - min); }
    choice(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
const rng = new Random(11);

// ВОЛШЕБНЫЕ СВЕТЛЯЧКИ (BOKEH)
const PARTICLES = [];
for (let i = 0; i < 150; i++) {
    PARTICLES.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        r: Math.random() * 3 + 1, // Крупнее
        dy: Math.random() * 0.5 + 0.2,
        dx: Math.random() * Math.PI * 2, // Для синусоиды
        dxSpeed: Math.random() * 0.02 + 0.01,
        alpha: Math.random(),
        da: (Math.random() - 0.5) * 0.03,
        c: rng.choice([
            '255, 50, 100', // Розовый неон
            '255, 200, 220', // Белый неон
            '200, 0, 50'     // Темно-красный
        ])
    });
}

function heart(a) {
    const x = 16 * Math.pow(Math.sin(a), 3);
    const y = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
    return [x * SC, y * SC + OY];
}

function hx(c) {
    const r = Math.round(Math.max(0, Math.min(1, c[0])) * 255);
    const g = Math.round(Math.max(0, Math.min(1, c[1])) * 255);
    const b = Math.round(Math.max(0, Math.min(1, c[2])) * 255);
    return `rgb(${r},${g},${b})`;
}

function mix(a, b, k) {
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function dim(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
function clamp(v) { return Math.max(0.0, Math.min(1.0, v)); }
function math_sin(v) { return Math.sin(Math.PI * v); }

const POLY = [];
for (let i = 0; i < 720; i++) POLY.push(heart(2 * Math.PI * i / 720));
const EDGES = [];
for (let i = 0; i < 720; i++) EDGES.push([POLY[i], POLY[(i + 1) % 720]]);

const YMAX = Math.max(...POLY.map(p => p[1]));
const YMIN = Math.min(...POLY.map(p => p[1]));
const CY = (YMAX + YMIN) / 2;

function spans(y) {
    const xs = [];
    for (const [p1, p2] of EDGES) {
        if ((p1[1] <= y && y < p2[1]) || (p2[1] <= y && y < p1[1])) {
            xs.push(p1[0] + (y - p1[1]) * (p2[0] - p1[0]) / (p2[1] - p1[1]));
        }
    }
    xs.sort((a, b) => a - b);
    const pairs = [];
    for (let i = 0; i < xs.length; i += 2) {
        if (xs[i + 1] !== undefined) pairs.push([xs[i], xs[i + 1]]);
    }
    return pairs;
}

function intersect(A, B) {
    const out = [];
    for (const a of A) {
        for (const b of B) {
            const lo = Math.max(a[0], b[0]);
            const hi = Math.min(a[1], b[1]);
            if (hi - lo > 14) out.push([lo, hi]);
        }
    }
    return out;
}

function* phrase_cycle() {
    while (true) {
        const order = [...PHRASES];
        rng.shuffle(order);
        for (const p of order) yield p;
    }
}

function measureText(text, size) {
    ctx.font = `bold ${size}px ${FONT}`;
    return ctx.measureText(text).width;
}

function math_dist(x, y) {
    return Math.hypot(x / (16 * SC), (y - CY) / (14.5 * SC));
}

function build() {
    const cycle = phrase_cycle();
    const row_h = Math.max(...SIZES) * 1.2 + 4;
    const half = row_h / 2;
    const placed = [];

    let y = YMAX - half;
    while (y > YMIN + half) {
        const row = intersect(spans(y + half), spans(y - half));
        for (let [lo, hi] of row) {
            lo += 4; hi -= 4;
            let cur = lo + rng.uniform(0, 8);
            const line = [];

            while (true) {
                let fit = null;
                for (let i = 0; i < 10; i++) {
                    const text = cycle.next().value;
                    const size = rng.choice(SIZES);
                    const w = measureText(text, size);
                    if (cur + w <= hi) { fit = { text, size, w }; break; }
                }
                if (!fit) break;
                line.push({ x: cur + fit.w / 2, text: fit.text, size: fit.size, w: fit.w });
                cur += fit.w + GAP;
            }

            if (!line.length) continue;

            if (line.length > 1) {
                const left = hi - (line[line.length - 1].x + line[line.length - 1].w / 2);
                line.forEach((it, i) => it.x += left * i / (line.length - 1));
            } else {
                line[0].x = (lo + hi) / 2;
            }

            line.forEach((it, i) => {
                const edge = (i === 0 || i === line.length - 1);
                placed.push({ x: it.x, y: y, text: it.text, size: it.size, edge });
            });
        }
        y -= row_h;
    }

    const wine = [0.65, 0.0, 0.15];
    const crimson = [1.0, 0.1, 0.25];
    const blood = [1.0, 0.15, 0.3];

    for (const p of placed) {
        const rad = Math.min(1.0, math_dist(p.x, p.y));
        let base = mix(wine, crimson, 0.25 + 0.75 * rad);
        base = mix(base, blood, rng.uniform(0, 0.35) + (p.edge ? 0.3 : 0));
        p.color = base.map(v => Math.min(1, v));
        p.rad = rad;
        p.f = 0;
        p.dx = rng.uniform(-10, 10);
        p.currentColor = p.color;
    }

    const edges = placed.filter(p => p.edge);
    const inner = placed.filter(p => !p.edge);
    edges.sort((a, b) => (Math.atan2(a.x, a.y - CY) + 2 * Math.PI) % (2 * Math.PI) - (Math.atan2(b.x, b.y - CY) + 2 * Math.PI) % (2 * Math.PI));
    inner.sort((a, b) => -a.rad + rng.uniform(0, 0.08) - (-b.rad + rng.uniform(0, 0.08)));

    return [...edges, ...inner];
}

const ORDER = build();
let spawnIndex = 0;
const RATE = ORDER.length / (DURATION * 1000 / TICK);
let acc = 0.0;
let spawning = true;

const active = [];
const finished = [];

function step() {
    if (spawning) {
        acc += RATE;
        while (acc >= 1 && spawnIndex < ORDER.length) {
            acc -= 1;
            active.push(ORDER[spawnIndex++]);
        }
        if (spawnIndex >= ORDER.length) {
            spawning = false;
            // Включаем пульсацию, когда все слова появились
            canvas.classList.add('beating');
        }
    }

    for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        p.f += 1;
        if (p.f / ANIM >= 1) {
            finished.push(p);
            active.splice(i, 1);
        }
    }

    draw();

    if (!spawning && active.length === 0 && !window.shimmerStarted) {
        window.shimmerStarted = true;
        setTimeout(shimmer, 140);
    }
    
    requestAnimationFrame(step);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Отрисовка магической пыли с мягким свечением
    for (const p of PARTICLES) {
        p.y -= p.dy;
        p.dx += p.dxSpeed; 
        const realX = p.x + Math.sin(p.dx) * 15; // Танцующее движение
        
        p.alpha += p.da;
        if (p.alpha <= 0.05 || p.alpha >= 0.7) p.da *= -1; 
        if (p.y < -20) {
            p.y = 1020;
            p.x = Math.random() * 1000;
        }
        
        ctx.beginPath();
        ctx.arc(realX, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.c}, ${p.alpha})`;
        
        // Свечение пылинок
        ctx.shadowBlur = 10;
        ctx.shadowColor = `rgba(${p.c}, 0.8)`;
        ctx.fill();
    }
    
    // Отключаем тени для оптимизации основного текста
    ctx.shadowBlur = 0;

    for (const p of finished) {
        ctx.font = `bold ${p.size}px ${FONT}`;
        ctx.fillStyle = hx(p.currentColor);
        
        // Если слово мерцает, добавляем ему яркое неоновое свечение
        if (p.isShimmering) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffb3c6';
        } else {
            ctx.shadowBlur = 0;
        }
        
        ctx.fillText(p.text, CX + p.x, CY_offset - p.y);
    }

    ctx.shadowBlur = 0; // Сбрасываем тени для активных частиц

    for (const p of active) {
        const u = clamp(p.f / ANIM);
        const e = 1 - Math.pow(1 - u, 3);
        const c = p.color;
        const x = CX + p.x;
        const y = CY_offset - p.y;
        const hover = (1 - e) * LIFT;
        const px = x + p.dx * (1 - e);
        const py = y - hover;

        const shadowFill = hx(mix(BGC, dim(c, 0.30), e));
        const haloFill = hx(mix(BGC, dim(c, 0.20), e * e));
        const flash = 0.75 * math_sin(clamp((u - 0.55) / 0.45));
        const mainFill = hx(mix(mix(BGC, c, Math.pow(e, 1.5)), FLASH, flash));

        ctx.font = `bold ${p.size}px ${FONT}`;
        ctx.fillStyle = shadowFill;
        ctx.fillText(p.text, px + 2, py + 3);

        ctx.font = `bold ${p.size + 1}px ${FONT}`;
        ctx.fillStyle = haloFill;
        ctx.fillText(p.text, px, py);

        // В момент появления слово тоже светится
        ctx.shadowBlur = flash * 20;
        ctx.shadowColor = hx(FLASH);
        
        ctx.font = `bold ${p.size}px ${FONT}`;
        ctx.fillStyle = mainFill;
        ctx.fillText(p.text, px, py);
        
        ctx.shadowBlur = 0;
    }
}

function shimmer() {
    if (finished.length === 0) return;
    
    // Заставляем мерцать сразу несколько слов для большего вау-эффекта
    const count = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < count; i++) {
        const p = finished[Math.floor(Math.random() * finished.length)];
        const orig = p.color;
        
        p.currentColor = mix(orig, FLASH, 0.8);
        p.isShimmering = true;
        
        setTimeout(() => {
            p.currentColor = orig;
            p.isShimmering = false;
        }, 350);
    }
    
    setTimeout(shimmer, 200);
}

setTimeout(() => requestAnimationFrame(step), 200);
