/**
 * What if I just put everything into one big file this year
 * well everything except for the font, that was annoying
 */

let html = (tag, props, ...children) => {
    let node = document.createElement(tag);
    if (props)
        for (let key in props)
            node.setAttribute(key, props[key]);
    for (let child of children)
        node.appendChild(child);
    return node;
};

let text = t => document.createTextNode(t);

// Thanks StackOverflow (and past me)
// https://github.com/LeoRiether/Fireworks2019.5JS/blob/master/countdown.js
// Thanks, StackOverflow
let MyDate = (() => {
    let offset = 0;

    const worldTimeAPI = {
        url: "https://worldtimeapi.org/api/timezone/Etc/UTC",
        timeParam: "utc_datetime",
    };

    const worldClockAPI = {
        url: "http://worldclockapi.com/api/json/utc/now",
        timeParam: "currentDateTime",
    };

    const anotherWorldTimeAPI = {
        url: "https://myworldtimeapi.herokuapp.com/Antarctica/Troll",
        timeParam: "utc_datetime",
    };

    const getOffsetWith = API => new Promise((res, rej) => {
        let xhr = new XMLHttpRequest();
        xhr.open("GET", API.url);
        xhr.responseType = 'json';

        xhr.onload = () => {
            let server = new Date(xhr.response[API.timeParam]);
            res(server - new Date());
        };

        xhr.onerror = rej;

        xhr.send();
    });

    const getOffset = () =>
        getOffsetWith(anotherWorldTimeAPI)
            .catch(() => {
                console.log("myworldtimeapi query failed! Trying worldclocktime instead");
                return getOffsetWith(worldTimeAPI);
            })
            .catch(() => {
                console.log("worldtimeapi query failed! Trying worldclockapi instead");
                return getOffsetWith(worldClockAPI);
            });

    (function init() {
        getOffset()
            .then(o => offset = o)
            .then(() => console.log('offset found: ', offset))
            .catch(() => console.log('getOffset() failed'));
    })();

    function now() {
        let d = new Date();
        d.setTime(d.getTime() + offset);
        return d;
    }

    return { now };
})();

let variables = {
    container: document.getElementById('variables'),

    range(label, initial, min, max, step=1) {
        let value = initial;

        let valueNode = html('span');
        valueNode.innerText = value; 

        let input = html('input', {
            min, max, value, step,
            'type': 'range',
            'style': 'margin-left: 0.8rem; margin-right: 0.8rem;',
        });
        input.addEventListener('input', () => {
            value = +input.value;
            valueNode.innerText = value;
        });

        let labelNode = html('label', {
            'style': 'display: flex;'
        }, text(label), input, valueNode);

        this.container.appendChild(labelNode);
        return () => value;
    },
};

const rand = (min, max) => Math.random() * (max - min) + min;
const allowedHue = (hue) => (~~(hue/4))*4;
const randColor = (hue) => `hsl(${allowedHue(hue || ~~rand(0, 360))}, 89%, 50%)`;
const hypot2 = (x, y) => x*x + y*y;
const lerp = (from, to, p) => from + (to - from)*p;

let perf = document.getElementById('perf');

let canvas = document.getElementById('world');
let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;
let ctx = canvas.getContext('2d');
ctx.fillStyle = 'black';
ctx.fillRect(0, 0, w, h);

let particles = {};
let newParticles = [];

function push(p) {
    newParticles.push(p);
} 
function processPushes() {
    for (let i = 0; i < newParticles.length; i++) {
        let p = newParticles[i];
        if (!particles[p.color]) particles[p.color] = [];
        particles[p.color].push(p);
    }
    newParticles = [];
}

let gravity = variables.range("gravity", 806, 600, 2000);
let startVx = variables.range("startVx", w/8, w/10, w/2);
let timeToParticle = variables.range("ttp (ms)", 800, 500, 2000);
let haloRadius = variables.range("halo radius", 10, 8, 18);
let explosionForce = variables.range("explosion force", 46640400, 30000000, 90000000);
let digitForce = variables.range("digit force", 1.5, 1, 2, 0.1);

function fader(p) {
    let time = 0; 
    p.behavior = (next => dt => {
        if (next) next(dt);
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (hypot2(p.vx, p.vy)*dt < 5)
            p.dead = true;

        time += dt;
        if (time > 1.2)
            p.dead = true;
    })(p.behavior);
    return p; 
}

function timefader(time, p) {
    p.behavior = (next => dt => {
        if (next) next(dt);
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        time -= dt;
        if (time < 0)
            p.dead = true;
    })(p.behavior);
    return p; 
}

function explode(p) {
    let subparticles = new Array(~~rand(80, 120));
    for (let i = 0; i < subparticles.length; i++) {
        let t = rand(0, 2*Math.PI);
        let v = Math.cbrt(rand(0, explosionForce()));
        subparticles[i] = timefader(rand(0.5, 1.0), {
            ...p,
            vx: v*Math.cos(t),
            vy: v*Math.sin(t),
            dead: false,
            behavior: () => {},
        });
    }
    if (p.modExplosion) p.modExplosion(subparticles);
    for (let subp of subparticles)
        push(subp);
}

function exploder(p) {
    p.fuse = rand(0.5, 1.0);
    p.behavior = (next => dt => {
        if (next) next(dt);
        
        p.fuse -= dt;
        if (p.fuse <= 0) {
            explode(p);
            p.dead = true;
        }
    })(p.behavior);
    return p;
}

const multicolorExplosion = next => subparticles => {
    let k = ~~((subparticles.length + 2) / 3);
    let baseHue = rand(0, 360);
    for (let i = 0; i < 3; i++) {
        let color = randColor(21*i + baseHue);
        for (let j = 0; j < k && i*k+j < subparticles.length; j++)
            subparticles[i*k+j].color = color;
    }

    if (next) next(subparticles);
}

function rigidbody(p) {
    p.behavior = (next => dt => {
        if (next) next(dt);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += gravity() * dt;
    })(p.behavior);
    return p;
}

function lerper(to, time, p) {
    let fromX = p.x;
    let fromY = p.y;
    let timer = 0;
    p.behavior = (next => dt => {
        if (next) next(dt);

        timer += dt;
        let perc = timer / time;
        p.x = lerp(fromX, to.x, perc);
        p.y = lerp(fromY, to.y, perc);
        if (timer >= time)
            p.dead = true;
    })(p.behavior);
    return p;
}

function deadExploder(p) {
    p.behavior = (next => dt => {
        if (next) next(dt);
        if (p.dead) explode(p);
    })(p.behavior);
    return p;
}

function deadDigit(index, p) {
    p.behavior = (next => dt => {
        if (next) next(dt);
        if (p.dead) {
            let glyph = Font.glyphs[index];
            let subparticles = new Array(glyph.length);
            for (let i = 0; i < glyph.length; i++) {
                subparticles[i] = timefader(1.0, {
                    ...p,
                    vx: glyph[i][0] * digitForce(),
                    vy: glyph[i][1] * digitForce(),
                    dead: false,
                    behavior: () => {},
                });
            }
            for (let p of subparticles)
                push(p);
        }
    })(p.behavior);
    return p;
}

function pushText(text) {
    const toDigit = c => c == ':' ? 10 : +c;

    const cw = 140; // totally works
    for (let i = 0; i < text.length; i++) {
        let position = { x: (i-text.length/2+0.5)*cw + w/2 ,y: h/2 };
        push(deadDigit(toDigit(text[i]), lerper(position, 1.0, {
            x: w/2,
            y: h-1,
            color: randColor(),
            behavior: () => {},
        })));
    }
}

function pushCountdown(seconds) {
    let minutes = ~~(seconds / 60);
    seconds %= 60;
    let hours = ~~(minutes / 60);  
    minutes %= 60;

    const fmt = x => (t => '0'.repeat(Math.max(0, 2-t.length)) + t)(""+x);

    if (hours > 0)
        pushText(`${hours}:${fmt(minutes)}:${fmt(seconds)}`);
    else if (minutes > 0)
        pushText(`${fmt(minutes)}:${fmt(seconds)}`);
    else
        pushText(`${fmt(seconds)}`);
}

let ttp = 0;
let targetDate = new Date(2025, 0, 1, 0, 0, 0);
let beforeMidnight = true;
let lastSecondsTillMidnight;
function update(dt) {
    for (let color in particles) {
        let ps = particles[color];
        for (let p of ps) {
            p.behavior(dt);
        }
    }

    for (let color in particles) {
        let ps = particles[color];
        for (let i = 0; i < ps.length; i++) {
            if (ps[i].y - haloRadius() - 1 > h || ps[i].dead) {
                ps[i] = ps[ps.length-1];
                ps.pop();
                i--;
            }
        }
        if (!particles[color].length)
            delete particles[color];
    }

    if (beforeMidnight) {
        let secondsTillMidnight = ~~((targetDate - MyDate.now()) / 1000);
        if (secondsTillMidnight <= 0) {
            for (let i = 0; i < 5; i++)
                setTimeout(() => pushText("2025"), i*1000);
            beforeMidnight = false;
        } else if (lastSecondsTillMidnight != secondsTillMidnight) {
            pushCountdown(secondsTillMidnight);
            lastSecondsTillMidnight = secondsTillMidnight;
        }
    } else {
        ttp -= dt;
        if (ttp <= 0) {
            ttp = rand(0.2, timeToParticle()/1000);
            push(exploder(rigidbody({
                x: rand(0, w),
                y: h-1,
                vx: rand(-startVx(), startVx()),
                vy: rand(-1500, -400),
                color: randColor(),
                modExplosion: multicolorExplosion(),
                behavior: () => {},
            })));
        }
    }

    processPushes();
}

function clear() {
    ctx.globalCompositeOperation = 'darken';
    ctx.fillStyle = 'rgba(0,0,0,.93)';
    ctx.beginPath();
    for (let color in particles) {
        let ps = particles[color];
        for (let p of ps) {
            ctx.moveTo(p.x|0, p.y|0);
            ctx.arc(p.x|0, p.y|0, haloRadius()+1, 0, 2*Math.PI);
        }
    }
    ctx.fill();
}

let totalParticles = 0; // weird ugly hack
let totalColors = 0;
function draw() {
    totalParticles = 0;
    totalColors = 0;
    ctx.globalCompositeOperation = 'lighten';

    // White core
    ctx.fillStyle = 'white';
    ctx.beginPath();
    for (let color in particles) {
        let ps = particles[color];
        for (let p of ps) {
            ctx.moveTo(p.x|0, p.y|0);
            ctx.arc(p.x|0, p.y|0, 2, 0, 2*Math.PI);
        }
    }
    ctx.fill();

    // Colored halos
    ctx.globalAlpha = 0.22;
    const haloDelta = (haloRadius() - 3) / 3;
    for (let color in particles) {
        let ps = particles[color];
        ctx.fillStyle = color;
        for (let p of ps) {
            ctx.beginPath();
            // for (let r = 3, i = 0; i <= 3; r += haloDelta, i++) {
                ctx.moveTo(p.x|0, p.y|0);
                ctx.arc(p.x|0, p.y|0, haloRadius(), 0, 2*Math.PI);
            // }
            ctx.fill();
        }

        totalParticles += ps.length;
        totalColors++;
    }
    ctx.globalAlpha = 1.0;
}

let perfAvg = 0;
let lastFrame = performance.now();
function loop() {
    let thisFrame = performance.now();
    let dt = (thisFrame - lastFrame) / 1000;
    lastFrame = thisFrame;

    if (dt < 1000) {
        clear();
        update(dt);
        draw();

        let perfThisFrame = 1000 / (performance.now() - thisFrame);
        perfAvg = Math.min(1000, 0.95*perfAvg + 0.05*perfThisFrame);
        let text = '1/dt (avg): ' + (perfAvg >= 1000 ? "∞" : Math.round(perfAvg / 10) * 10);
        text += `\n${totalParticles} particles`;
        text += `\n${totalColors} colors`;
        perf.innerText = text;
    }
    requestAnimationFrame(loop);
}
loop();

window.addEventListener('mousedown', event => {
    event.stopImmediatePropagation();
    let to = { x: event.clientX, y: event.clientY };
    push(deadDigit(~~rand(0, 10), lerper(to, 1, {
        x: w/2,
        y: h-1,
        color: randColor(),
        behavior: () => {},
    })));
});

window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, w, h);
});
