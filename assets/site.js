(function () {
    'use strict';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// The welcome page is a short deck of full-screen steps. One scroll gesture
// (wheel flick, swipe, arrow/page keys, or a click on the dots) moves exactly
// one step, and the transition then plays by itself - the page never scrolls.
//
//   step 0  intro (portrait + short intro on the grey panel)
//   step 1  the panel's text changes by itself (headline leaves up through the
//           panel's top edge, then the writing slide rises in) and the panel
//           eases from grey to pastel yellow
//   step 2  a black card rises from the bottom while the hero is pushed up and
//           out; the certification badges slide left on their own
//   step 3  the card leaves off the top, revealing an empty grey page
//           (placeholder for the next page)
//
// All visuals are a function of one number, p (0..3), that is tweened to the
// target step; that keeps forward, backward and jump-by-dot all consistent.
    (function () {
        var slides = Array.prototype.slice.call(document.querySelectorAll('#hero-stage .hero-slide'));
        var dotsBox = document.getElementById('hero-dots');
        var stage = document.getElementById('cert-stage');
        var panel = document.querySelector('.hero-panel');
        var track = document.getElementById('cert-track');
        var nextPage = document.getElementById('next-page');
        var navBar = document.querySelector('.nav');
        var n = slides.length;
        if (n < 2) return;

        var LAST = 3;
        var STEP_MS = 620;
        var GREY = [234, 233, 228];
        // screen 2's panel colour: one of five pastels (yellow, blue, pink, mint, lavender), picked at
        // random each time you scroll down to it, never the same twice in a row
        var PANEL_COLOURS = [[247, 216, 155], [207, 220, 251], [246, 208, 218], [205, 238, 219], [224, 214, 246]];
        var PANEL = PANEL_COLOURS[0], lastPanel = -1;
        function pickPanel() {
            var k;
            do { k = Math.floor(Math.random() * PANEL_COLOURS.length); } while (k === lastPanel);
            lastPanel = k;
            PANEL = PANEL_COLOURS[k];
        }

        function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
        function ease(t) { return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t); }
        // ease-out: moves at full speed from the first frame, so a swipe is answered instantly
        function easeCubic(t) { return 1 - Math.pow(1 - t, 3); }
        function mix(a, b, t) { return Math.round(a + (b - a) * t); }

        // ---- certification row: a smooth, constant-speed slide to the left, looping.
        // The screen is split into (per + 2) equal columns: the middle `per` columns
        // are clear and the first and last column are the left and right MARGINS.
        // Badges are never faded as a whole - the margins carry a gradient mask
        // (see .cert-marquee in site.css), so only the part of a badge that is
        // inside a margin fades, gently, and it comes back to full strength as it
        // leaves the margin.
        var MIN_ITEM_PX = 224;       // narrowest a column may get
        var MAX_PER = 3;             // most badges shown at full strength at once
        var SECONDS_PER_BADGE = 4.5; // how long one column-width of travel takes
        var per = 3, count = 0, x = 0, rafCert = 0, lastCertT = 0;

        // how many fit, from the screen width; names are shrunk (one line, never cut) to the column
        function layoutCerts() {
            if (!track || !stage) return;
            count = track.children.length / 2;
            if (!count) return;
            per = Math.max(1, Math.min(MAX_PER, Math.floor(window.innerWidth / MIN_ITEM_PX) - 2, count));
            stage.style.setProperty('--per', per);
            stage.classList.toggle('is-static', count <= per);
            var colW = window.innerWidth / (per + 2) - 0.02 * window.innerWidth;
            stage.style.setProperty('--cert-fs', '40px');
            var widest = 0;
            Array.prototype.forEach.call(track.querySelectorAll('.cert-name'), function (el) {
                widest = Math.max(widest, el.scrollWidth);
            });
            if (widest) {
                var fs = Math.max(10, Math.min(26, 40 * colW / widest * 0.97));
                stage.style.setProperty('--cert-fs', fs.toFixed(2) + 'px');
            }
            paintCerts();
        }

        function paintCerts() {
            if (!track || !count) return;
            var itemW = window.innerWidth / (per + 2);
            var copyW = count * itemW;
            x = count <= per ? 0 : x % copyW;
            track.style.transform = 'translate3d(' + (-x).toFixed(2) + 'px,0,0)';
        }

        function certFrame(t) {
            var dt = Math.min(0.05, (t - lastCertT) / 1000 || 0.016);
            lastCertT = t;
            x += dt * (window.innerWidth / (per + 2)) / SECONDS_PER_BADGE;
            paintCerts();
            rafCert = requestAnimationFrame(certFrame);
        }
        function stopCarousel() { if (rafCert) cancelAnimationFrame(rafCert); rafCert = 0; }
        function startCarousel() {
            stopCarousel();
            layoutCerts();
            x = 0;
            paintCerts();
            if (!reduceMotion && count > per) {
                lastCertT = performance.now();
                rafCert = requestAnimationFrame(certFrame);
            }
        }
        document.addEventListener('certs-rendered', function () {
            layoutCerts();
            if (stageShown) startCarousel();
        });
        window.addEventListener('resize', function () {
            layoutCerts();
            if (stageShown) startCarousel();
        });

        var state = 0;      // target step
        var p = 0;          // current (animated) position, 0..LAST
        var stageShown = false;

        var dots = [];
        for (var i = 0; i <= LAST; i++) {
            (function (i) {
                var d = document.createElement('button');
                d.type = 'button';
                d.className = 'hero-dot';
                d.setAttribute('aria-label', 'Go to step ' + (i + 1));
                d.addEventListener('click', function () { go(i, true); });
                if (dotsBox) dotsBox.appendChild(d);
                dots.push(d);
            })(i);
        }

        function apply() {
            var a = clamp(p), b = clamp(p - 1), c = clamp(p - 2);

            // panel slides: the old one leaves, then the new one arrives
            var u = a * (n - 1);
            slides.forEach(function (s, k) {
                var exit = k === n - 1 ? 0 : clamp((u - k) / 0.5);
                var enter = k === 0 ? 1 : clamp((u - (k - 1) - 0.5) / 0.5);
                var ty, op;
                if (exit > 0) { ty = -105 * ease(exit); op = 1 - clamp(exit / 0.8); }
                else { ty = 105 * (1 - ease(enter)); op = enter; }
                s.style.transform = 'translateY(' + ty.toFixed(2) + '%)';
                s.style.opacity = op.toFixed(3);
                s.style.visibility = op > 0.001 ? 'visible' : 'hidden';
                s.setAttribute('aria-hidden', op > 0.5 ? 'false' : 'true');
            });

            if (panel) {
                var w = ease(clamp((a - 0.25) / 0.6));
                panel.style.backgroundColor = 'rgb(' + mix(GREY[0], PANEL[0], w) + ',' + mix(GREY[1], PANEL[1], w) + ',' + mix(GREY[2], PANEL[2], w) + ')';
                panel.style.setProperty('--a', a.toFixed(3));
            }

            // --b / --c drive the black card (rises, then leaves) and push the hero up
            var root = document.documentElement;
            root.style.setProperty('--b', ease(b).toFixed(4));
            root.style.setProperty('--c', ease(c).toFixed(4));
            if (stage) {
                var shown = b > 0.002 && c < 0.998;
                stage.style.visibility = shown ? 'visible' : 'hidden';
                stage.style.pointerEvents = shown ? 'auto' : 'none';
                stage.setAttribute('aria-hidden', shown ? 'false' : 'true');
                if (shown && !stageShown) startCarousel();       // from the first badge each time the card comes up
                if (!shown && stageShown) stopCarousel();
                stageShown = shown;
            }
            if (navBar) {
                // the header bar fades away as the last page is revealed (opacity is in CSS, from --c)
                navBar.style.visibility = c > 0.995 ? 'hidden' : '';
                navBar.style.pointerEvents = c > 0.5 ? 'none' : '';
            }
            if (nextPage) {
                nextPage.style.visibility = c > 0.002 ? 'visible' : 'hidden';
                nextPage.setAttribute('aria-hidden', c > 0.5 ? 'false' : 'true');
            }
        }

        function renderDots() {
            dots.forEach(function (d, k) { d.classList.toggle('is-active', k === state); });
        }

        var raf = 0, busyUntil = 0;
        function go(target, force) {
            target = Math.max(0, Math.min(LAST, target));
            var now = performance.now();
            if (!force && now < busyUntil) return;
            if (target === state && Math.abs(p - target) < 0.001) return;
            if (target >= 1 && state < 1) pickPanel();     // a new colour each time screen 2 is entered
            state = target;
            renderDots();
            var from = p, dist = Math.abs(target - from);
            var dur = reduceMotion ? 0 : STEP_MS * Math.pow(Math.max(dist, 0.2), 0.6);
            var t0 = now;
            busyUntil = now + dur * 0.7;
            if (raf) cancelAnimationFrame(raf);
            function frame(t) {
                var k = dur ? Math.min(1, (t - t0) / dur) : 1;
                p = from + (target - from) * easeCubic(k);
                apply();
                raf = k < 1 ? requestAnimationFrame(frame) : 0;
            }
            raf = requestAnimationFrame(frame);
        }

        function modalOpen() { return document.body.classList.contains('modal-open'); }

        // wheel / trackpad: one step per flick; the tail of a trackpad flick is swallowed
        var lastWheel = 0;
        window.addEventListener('wheel', function (e) {
            if (modalOpen() || e.ctrlKey) return;
            e.preventDefault();
            if (Math.abs(e.deltaY) < 4) return;
            var now = performance.now();
            var continuing = now - lastWheel < 130;
            lastWheel = now;
            if (now < busyUntil) { if (continuing) busyUntil = Math.max(busyUntil, now + 150); return; }
            if (continuing && now - lastStep < 400) return;
            lastStep = now;
            go(state + (e.deltaY > 0 ? 1 : -1));
        }, { passive: false });
        var lastStep = 0;

        // touch: swipe up = next, swipe down = previous
        // Reacts as soon as the finger has moved a few pixels (and again on lift, for very quick
        // flicks that sent no move event), and may interrupt a step that is still running.
        var touchY = null, touchLastY = 0;
        window.addEventListener('touchstart', function (e) {
            touchY = e.touches[0].clientY;
            touchLastY = touchY;
        }, { passive: true });
        window.addEventListener('touchmove', function (e) {
            if (modalOpen()) return;
            if (e.cancelable) e.preventDefault();
            touchLastY = e.touches[0].clientY;
            if (touchY === null) return;
            var dy = touchY - touchLastY;
            if (Math.abs(dy) > 10) { touchY = null; go(state + (dy > 0 ? 1 : -1), true); }
        }, { passive: false });
        window.addEventListener('touchend', function (e) {
            if (modalOpen() || touchY === null) return;
            var y = e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientY : touchLastY;
            var dy = touchY - y;
            touchY = null;
            if (Math.abs(dy) > 10) go(state + (dy > 0 ? 1 : -1), true);
        }, { passive: true });
        window.addEventListener('touchcancel', function () { touchY = null; }, { passive: true });

        window.addEventListener('keydown', function (e) {
            if (modalOpen() || e.altKey || e.ctrlKey || e.metaKey) return;
            if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName)) return;
            var next = e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ';
            var prev = e.key === 'ArrowUp' || e.key === 'PageUp';
            if (!next && !prev && e.key !== 'Home' && e.key !== 'End') return;
            e.preventDefault();
            if (e.key === 'Home') go(0);
            else if (e.key === 'End') go(LAST);
            else go(state + (next ? 1 : -1));
        });

        window.addEventListener('resize', apply);
        renderDots();
        apply();
    })();
// Wordmark: the full name <-> its initials ("Mistry Akshat Ankur" <-> "MAA.") on its own,
// forever, set in the same face as the page content. window.Wordmark.set(name) (called
// once config/homepage.json is loaded) rebuilds it from any name. Going short, every letter after
// the initials folds away one by one (left to right) while the initials slide together,
// the spaces close and the dot pops in; going long, it unfolds again from the last letter.
// The motion is CSS (see the wordmark rules in site.css); this builds the words and
// letters, measures them so their widths can animate, and flips a class on a timer.
    (function () {
        var mark = document.querySelector('.nav-mark[data-wordmark]');
        if (!mark) return;
        var wm = mark.querySelector('.wm');
        var letters = [];
        function measure() {
            letters.forEach(function (c) {
                c.style.removeProperty('--cw');
                c.style.width = 'auto';
                var w = c.getBoundingClientRect().width;
                c.style.width = '';
                c.style.setProperty('--cw', w + 'px');
            });
        }
        function span(cls, text) {
            var e = document.createElement('span');
            e.className = cls;
            if (text) e.textContent = text;
            return e;
        }
        function build(name) {
            var words = String(name || '').trim().split(/\s+/).filter(Boolean);
            if (!words.length) return;
            wm.innerHTML = '';
            letters = [];
            words.forEach(function (w, i) {
                if (i) wm.appendChild(span('wm-gap'));
                var word = span('wm-word');
                word.appendChild(span('wm-i', w.charAt(0)));
                var tail = span('wm-r');
                w.slice(1).split('').forEach(function (ch) {
                    var c = span('wm-c', ch);
                    c.style.setProperty('--gi', letters.length);
                    tail.appendChild(c);
                    letters.push(c);
                });
                word.appendChild(tail);
                wm.appendChild(word);
            });
            wm.appendChild(span('wm-dot', '.'));
            letters.forEach(function (c, k) { c.style.setProperty('--ri', letters.length - 1 - k); });
            mark.setAttribute('aria-label', words.join(' '));
            mark.title = words.join(' ');
            measure();
        }
        // the monogram's colours: the letters in one, the dot in another - two different picks from
        // five (blue, amber, coral, green, violet), new every time it shrinks
        var LOGO_COLOURS = ['#4169e1', '#f4a93d', '#ec6a5e', '#2fb37a', '#8d6bdc'];
        function pickLogoColours() {
            var a = Math.floor(Math.random() * LOGO_COLOURS.length);
            var b;
            do { b = Math.floor(Math.random() * LOGO_COLOURS.length); } while (b === a);
            mark.style.setProperty('--lc1', LOGO_COLOURS[a]);
            mark.style.setProperty('--lc2', LOGO_COLOURS[b]);
        }
        pickLogoColours();
        window.Wordmark = { set: build };
        build(mark.getAttribute('data-name'));
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
        if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', measure);
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        var short = false;
        function flip() {
            short = !short;
            if (short) pickLogoColours();      // each time it shrinks to the monogram it gets two new colours
            mark.classList.toggle('is-short', short);
            setTimeout(flip, short ? 2800 : 4200);
        }
        setTimeout(flip, 3200);
    })();

// Reveal every .reveal element with a small stagger. Uses setTimeout rather
// than requestAnimationFrame to flush the initial (hidden) style before
// adding .is-visible - rAF is suspended by some browsers for
// backgrounded/hidden tabs, which would otherwise leave content stuck
// invisible.
    var revealItems = document.querySelectorAll('.reveal');
    if (reduceMotion) {
        revealItems.forEach(function (el) {
            el.classList.add('is-visible');
        });
    } else {
        revealItems.forEach(function (el, i) {
            el.style.transitionDelay = 60 + i * 70 + 'ms';
        });
        setTimeout(function () {
            revealItems.forEach(function (el) {
                el.classList.add('is-visible');
            });
        }, 10);
    }
// Email "links" are buttons that copy the address instead of navigating - 
// mailto: silently does nothing for anyone without a configured desktop
// mail client, which is common in a browser-only workflow. site.js
// writes the real address into data-copy-email once profile.json loads.
    document.addEventListener('click', function (e) {
        var btn = e.target.closest && e.target.closest('[data-copy-email]');
        if (!btn) return;
        var email = btn.getAttribute('data-copy-email');
        if (!email) return;
        var showTooltip = function () {
            var tip = document.createElement('span');
            tip.className = 'copy-tooltip';
            tip.textContent = 'Copied ' + email;
            btn.appendChild(tip);
            requestAnimationFrame(function () {
                tip.classList.add('is-visible');
            });
            setTimeout(function () {
                tip.classList.remove('is-visible');
                setTimeout(function () {
                    tip.remove();
                }, 200);
            }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).then(showTooltip).catch(function () {
                window.prompt('Copy this email address:', email);
            });
        } else {
            window.prompt('Copy this email address:', email);
        }
    });
// "About Him" popup - generic open/close chrome only; site.js fills
// in the name and paragraphs once config/homepage.json loads.
// Title-bar buttons on the welcome page: black at rest; on hover each fills with one of six pastels,
// picked at random every time and never the same twice in a row. (The "Explore his content" button on
// screen 2 is always black - its panel takes the pastel instead.)
    if (!document.body.classList.contains('explore')) {
        var PILL_PASTELS = ['#f7d89b', '#c9d8fb', '#f7cfd8', '#cdeedb', '#dcd3f5', '#fbd9c5'];
        var lastPill = -1;
        var pickPill = function (pill) {
            if (pill.classList.contains('slide-link')) return;
            var k;
            do {
                k = Math.floor(Math.random() * PILL_PASTELS.length);
            } while (k === lastPill);
            lastPill = k;
            pill.style.setProperty('--pbg', PILL_PASTELS[k]);
            pill.style.setProperty('--pfg', '#14120d');
        };
        document.addEventListener('pointerover', function (e) {
            var pill = e.target.closest && e.target.closest('.pill');
            if (pill && !(e.relatedTarget && pill.contains(e.relatedTarget))) pickPill(pill);
        });
        document.addEventListener('focusin', function (e) {
            var pill = e.target.closest && e.target.closest('.pill');
            if (pill) pickPill(pill);
        });
    }
    var aboutBackdrop = document.getElementById('about-modal-backdrop');
    if (aboutBackdrop) {
        var lastFocused = null;
        var openAbout = function () {
            lastFocused = document.activeElement;
            aboutBackdrop.hidden = false;
            document.body.classList.add('modal-open');
            aboutBackdrop.querySelector('.about-modal-close').focus();
        };
        var closeAbout = function () {
            aboutBackdrop.hidden = true;
            document.body.classList.remove('modal-open');
            if (lastFocused && lastFocused.focus) lastFocused.focus();
        };
        document.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('[data-open-about]')) openAbout();
        });
        aboutBackdrop.addEventListener('click', function (e) {
            if (e.target === aboutBackdrop) closeAbout();
        });
        aboutBackdrop.querySelectorAll('[data-close-about]').forEach(function (btn) {
            btn.addEventListener('click', closeAbout);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && !aboutBackdrop.hidden) closeAbout();
        });
    }
})();

(function () {
    'use strict';
// Renders the welcome page from config/homepage.json and the explore page from
// config/explore.json (see the _help lines inside each). Requires an actual HTTP server (GitHub
// Pages, npx serve, etc.) - fetch() of local files is blocked when a page is opened
// directly via file://.
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    // ---------- rich text ----------
    // *text* is colour coded (a span.hl) where the component supports it; where it does not
    // the stars are dropped. /* and \* print a literal asterisk.
    var STAR = '\u0001';
    function unstar(t) { return t.split(STAR).join('*'); }

    function richNodes(src, colored) {
        var s = String(src == null ? '' : src).replace(/\\\*|\/\*/g, STAR);
        var frag = document.createDocumentFragment();
        var re = /\*([^*]+)\*/g, last = 0, m;
        while ((m = re.exec(s))) {
            if (m.index > last) frag.appendChild(document.createTextNode(unstar(s.slice(last, m.index))));
            var inner = unstar(m[1]);
            frag.appendChild(colored ? el('span', 'hl', inner) : document.createTextNode(inner));
            last = re.lastIndex;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(unstar(s.slice(last))));
        return frag;
    }

    function setRich(node, src, colored) {
        if (!node) return;
        node.textContent = '';
        node.appendChild(richNodes(src, colored));
    }

    function setText(id, value) {
        var n = document.getElementById(id);
        if (n && value !== undefined) n.textContent = value;
    }

    // ---------- welcome page ----------
    var ARROW_SVG = '<span class="pill-chev" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 20 20" fill="none" ' +
        'stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M4 10h12M11 5l5 5-5 5"/></svg></span>';

    function renderNav(items) {
        var nav = document.getElementById('nav-links');
        if (!nav || !items) return;
        nav.innerHTML = '';
        var here = location.pathname.split('/').pop() || 'index.html';
        items.forEach(function (it) {
            if (it.link && it.link === here) return;   // no button for the page you are already on
            var node;
            if (it.action === 'about') {
                node = el('button', 'pill');
                node.type = 'button';
                node.setAttribute('data-open-about', '');
            } else {
                node = el('a', 'pill');
                node.href = it.link || '#';
                if (/^https?:/i.test(it.link || '')) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
            }
            node.appendChild(document.createTextNode(it.label + ' '));
            node.insertAdjacentHTML('beforeend', ARROW_SVG);
            nav.appendChild(node);
        });
    }

    function isEmail(v) {
        return /^(mailto:)?[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(String(v || ''));
    }

    // an e-mail address copies to the clipboard (see site.js); anything else is a link
    function renderContacts(box, contacts) {
        if (!box) return;
        box.innerHTML = '';
        (contacts || []).forEach(function (c, i) {
            if (i) {
                var sep = el('span', 'contact-sep', ' - ');
                sep.setAttribute('aria-hidden', 'true');
                box.appendChild(sep);
            }
            var v = String(c.value || '');
            var node;
            if (c.copy === true || (c.copy !== false && isEmail(v))) {
                node = el('button', 'contact-link', c.key);
                node.type = 'button';
                node.setAttribute('data-copy-email', v.replace(/^mailto:/i, ''));
            } else {
                node = el('a', 'contact-link', c.key);
                node.href = v;
                node.target = '_blank';
                node.rel = 'noopener noreferrer';
            }
            box.appendChild(node);
        });
    }

    function renderAbout(about) {
        about = about || {};
        setText('about-modal-name', about.title || '');
        var body = document.getElementById('about-modal-body');
        if (!body) return;
        body.innerHTML = '';
        (about.paragraphs || []).forEach(function (text) {
            var p = el('p');
            setRich(p, text, true);
            body.appendChild(p);
        });
    }

    // "4 Anthropic certifications + 1 AWS certification": one group per provider in
    // screen-3.secondary (or, when that is missing, every provider found), matched to
    // certification.provider; the provider name opens the list popup.
    function renderCertSummary(secondary, certs) {
        var line = document.getElementById('cert-count-line');
        if (!line) return;
        var providers = (secondary || []).map(function (p) { return typeof p === 'string' ? p : p.provider; });
        if (!providers.length) {
            certs.forEach(function (c) { if (providers.indexOf(c.provider) < 0) providers.push(c.provider); });
        }
        line.innerHTML = '';
        var shown = 0;
        providers.forEach(function (prov) {
            var list = certs.filter(function (c) { return c.provider === prov; });
            if (!list.length) return;
            if (shown++) line.appendChild(el('span', 'cert-plus', ' + '));
            line.appendChild(el('span', 'cert-count-num', String(list.length)));
            line.appendChild(document.createTextNode(' '));
            var b = el('button', 'cert-provider', prov);
            b.type = 'button';
            b.addEventListener('click', function () { openCertModal(prov, list); });
            line.appendChild(b);
            line.appendChild(document.createTextNode(' certification' + (list.length === 1 ? '' : 's')));
        });
    }

    // popup: translucent backdrop, the provider's certifications as a plain list (name + dates)
    function openCertModal(provider, list) {
        var modal = document.getElementById('cert-modal');
        if (!modal) return;
        document.getElementById('cert-modal-title').textContent = provider + ' certifications';
        var ul = document.getElementById('cert-modal-list');
        ul.innerHTML = '';
        list.forEach(function (c) {
            var li = el('li', 'cert-modal-item');
            li.appendChild(el('span', 'cert-modal-name', c.name));
            var dates = [c.from, c.to].filter(Boolean);
            li.appendChild(el('span', 'cert-modal-dates', dates.length ? dates.join(' \u2192 ') : 'dates to be added'));
            ul.appendChild(li);
        });
        modal.hidden = false;
        document.body.classList.add('modal-open');
        document.getElementById('cert-modal-close').focus();
    }

    function closeCertModal() {
        var modal = document.getElementById('cert-modal');
        if (!modal || modal.hidden) return;
        modal.hidden = true;
        document.body.classList.remove('modal-open');
    }

    (function () {
        var modal = document.getElementById('cert-modal');
        if (!modal) return;
        document.getElementById('cert-modal-close').addEventListener('click', closeCertModal);
        modal.addEventListener('click', function (e) { if (e.target === modal) closeCertModal(); });
        window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeCertModal(); });
    })();

    // last page: one or two target cards (never more than two). With one, the card sits in the middle.
    function renderTargets(s4) {
        var box = document.getElementById('target-cards');
        if (!box) return;
        var cards = (s4.cards || []).slice(0, 2);
        var label = s4['start-label'] || 'Preparation started';
        box.innerHTML = '';
        box.className = 'target-cards has-' + cards.length;
        cards.forEach(function (t) {
            var card = el('article', 'target-card');
            card.appendChild(el('p', 'target-issuer', t.provider));
            card.appendChild(el('h3', 'target-name', t.title));
            if (t.subtitle) card.appendChild(el('p', 'target-code', t.subtitle));
            var row = el('div', 'target-prep');
            row.appendChild(el('span', 'target-prep-label', label));
            row.appendChild(el('span', 'target-prep-date', t.start || 'date to be added'));
            card.appendChild(row);
            box.appendChild(card);
        });
        fitTargets();
    }

    // Every line on a target card stays on ONE line, and all cards share one font size.
    // The layout is chosen to fit the screen, in this order:
    //   1. side by side (vertical cards)       - if the name still fits at a comfortable size
    //   2. horizontal cards, one per row       - name on the left, date on the right
    //   3. vertical cards, one per row         - the narrow-screen fallback
    // The name size is shrunk until the longest name fits the card. Runs on load and on resize.
    var TARGET_BASE_PX = 32;
    var TARGET_MODES = [
        { cls: '',         min: 17 },
        { cls: 'is-rows',  min: 17 },
        { cls: 'is-stack', min: 0 }
    ];

    function fitTargets() {
        var box = document.getElementById('target-cards');
        if (!box || !box.children.length) return;
        var fs = TARGET_BASE_PX;
        TARGET_MODES.some(function (mode, i) {
            box.classList.remove('is-rows', 'is-stack');
            if (mode.cls) box.classList.add(mode.cls);
            box.style.setProperty('--target-fs', TARGET_BASE_PX + 'px');
            var widest = 0;
            Array.prototype.forEach.call(box.querySelectorAll('.target-name'), function (n) {
                widest = Math.max(widest, n.scrollWidth);
            });
            var room = box.querySelector('.target-name').clientWidth;
            fs = Math.min(TARGET_BASE_PX, TARGET_BASE_PX * room / widest * 0.98);
            return fs >= mode.min || i === TARGET_MODES.length - 1;
        });
        box.style.setProperty('--target-fs', Math.max(9, fs).toFixed(2) + 'px');
    }
    window.addEventListener('resize', fitTargets);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitTargets);

    function renderCerts(certs) {
        var track = document.getElementById('cert-track');
        if (!track || !certs.length) return;
// The track holds the list twice back to back and slides left by exactly one
// copy (CSS), so it loops seamlessly. Each copy needs at least three entries to
// be wider than the screen, hence the repeat for very short lists.
        var half = [];
        for (var r = 0; r < Math.ceil(3 / certs.length); r++) half = half.concat(certs);
        track.innerHTML = '';
        track.style.setProperty('--n', half.length);
        [0, 1].forEach(function (copy) {
            half.forEach(function (c) {
                var li = el('li', 'cert');
                if (copy) li.setAttribute('aria-hidden', 'true');
                var badge = el('div', 'cert-badge');
                if (c.image) {
                    var img = el('img', null);
                    img.src = c.image;
                    img.alt = c.name || '';
                    img.draggable = false;
                    badge.appendChild(img);
                } else {
                    badge.classList.add('cert-badge-text');
                    badge.appendChild(el('span', null, c.name));
                }
                li.appendChild(badge);
                // name and dates sit under every entry, badge image or not, so a
                // text-only entry occupies exactly the same slot as the others
                var name = c.url ? el('a', 'cert-name', c.name) : el('p', 'cert-name', c.name);
                if (c.url) { name.href = c.url; name.target = '_blank'; name.rel = 'noopener noreferrer'; }
                li.appendChild(name);
                var dates = [c.from, c.to].filter(Boolean);
                var p = el('p', 'cert-dates');
                p.textContent = dates.length ? dates.join(' \u2192 ') : 'dates to be added';
                li.appendChild(p);
                track.appendChild(li);
            });
        });
        document.dispatchEvent(new Event('certs-rendered'));
    }

    function initHome(cfg) {
        var site = cfg.site || {};
        var sc = cfg.screens || {};
        var s1 = sc['screen-1'] || {}, s2 = sc['screen-2'] || {}, s3 = sc['screen-3'] || {}, s4 = sc['screen-4'] || {};

        if (site.title && document.getElementById('hero-stage')) document.title = site.title;
        if (site.logo && window.Wordmark) window.Wordmark.set(site.logo);
        renderNav(site.nav);
        var cmsLink = document.getElementById('cms-link');
        if (cmsLink) {
            var cms = site.cms || {};
            cmsLink.hidden = !cms.link;
            if (cms.link) { cmsLink.href = cms.link; cmsLink.textContent = cms.label || 'Edit this site'; }
        }

        // screen 1
        setRich(document.getElementById('profile-headline'), s1.primary, true);
        // the highlighted name opens the About window
        var nameLink = document.querySelector('#profile-headline .hl');
        if (nameLink) {
            nameLink.classList.add('about-link');
            nameLink.setAttribute('data-open-about', '');
            nameLink.setAttribute('role', 'button');
            nameLink.setAttribute('tabindex', '0');
            nameLink.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nameLink.click(); }
            });
        }
        var portrait = document.getElementById('profile-portrait');
        if (portrait && s1.photo) { portrait.src = s1.photo; portrait.alt = s1['photo-alt'] || ''; }
        renderContacts(document.getElementById('hero-contacts'), s1.contacts);
        renderContacts(document.getElementById('about-contacts'), s1.contacts);
        renderAbout(s1['about-him']);

        // screen 2 (the panel is yellow here: colour coding is not shown, so stars are dropped)
        setRich(document.getElementById('s2-primary'), s2.primary, false);
        var btn = document.getElementById('s2-button');
        var sb = s2['secondary-button'];
        if (btn && sb) {
            btn.href = sb.link || '#';
            btn.textContent = sb.label + ' ';
            btn.appendChild(el('span', 'pill-go', '\u2192'));
            btn.lastChild.setAttribute('aria-hidden', 'true');
        } else if (btn) {
            btn.hidden = true;
        }

        // screen 3
        setRich(document.getElementById('s3-pre'), s3['pre-primary'], false);
        setRich(document.getElementById('s3-primary'), s3.primary, true);
        var dir = s3['badge-folder'] || 'config/badges/';
        var certs = (s3.certifications || []).map(function (c) {
            return {
                provider: c.provider, name: c.name, from: c.from, to: c.to, url: c.url,
                image: c.badge ? (c.badge.indexOf('/') >= 0 ? c.badge : dir + c.badge) : ''
            };
        });
        renderCertSummary(s3.secondary, certs);
        renderCerts(certs);

        // screen 4
        setRich(document.getElementById('s4-pre'), s4['pre-primary'], false);
        setRich(document.getElementById('s4-primary'), s4.primary, true);
        renderTargets(s4);
    }

    // ---------- explore page ----------
    // config/explore.json -> three categories beneath a big EXPLORE heading and a search bar.
    // Typing in the search bar fuzzy-matches the titles of every item in every category, hides
    // the categories and shows the best matches in a separate box underneath.

    function isBoundary(t, i) { return i === 0 || /[^a-z0-9]/.test(t.charAt(i - 1)); }

    var WORD_CHAR = /[a-z0-9\u00c0-\u024f]/;

    // The title without punctuation and spaces, so "CCAR-P" can be typed "ccarp"; map[] remembers
    // where each kept letter sat in the real title (for highlighting).
    function squash(title) {
        var low = title.toLowerCase(), s = '', map = [];
        for (var i = 0; i < low.length; i++) {
            if (WORD_CHAR.test(low.charAt(i))) { s += low.charAt(i); map.push(i); }
        }
        return { low: low, s: s, map: map };
    }

    function normToken(t) {
        var out = '';
        for (var i = 0; i < t.length; i++) if (WORD_CHAR.test(t.charAt(i))) out += t.charAt(i);
        return out;
    }

    // how many slips a word of this length may contain
    function maxTypos(len) { return len <= 3 ? 0 : len <= 6 ? 1 : 2; }

    // The closest stretch of `text` to the word `tok`, counting a wrong, missing, extra or swapped
    // letter as one slip each (edit distance with transpositions, matched anywhere in the text).
    function approxFind(tok, text, k) {
        var m = tok.length, n = text.length, D = [], i, j;
        for (i = 0; i <= m; i++) { D.push(new Array(n + 1)); D[i][0] = i; }
        for (j = 0; j <= n; j++) D[0][j] = 0;
        for (i = 1; i <= m; i++) {
            for (j = 1; j <= n; j++) {
                var v = Math.min(
                    D[i - 1][j - 1] + (tok.charAt(i - 1) === text.charAt(j - 1) ? 0 : 1),
                    D[i - 1][j] + 1,
                    D[i][j - 1] + 1
                );
                if (i > 1 && j > 1 && tok.charAt(i - 1) === text.charAt(j - 2) && tok.charAt(i - 2) === text.charAt(j - 1)) {
                    v = Math.min(v, D[i - 2][j - 2] + 1);
                }
                D[i][j] = v;
            }
        }
        var best = Infinity, end = -1;
        for (j = 1; j <= n; j++) if (D[m][j] < best) { best = D[m][j]; end = j; }
        return best <= k ? { dist: best, end: end - 1 } : null;
    }

    // One query word against one title, best way first: the exact letters in a row; the letters in
    // order and close together; or a near miss (spelling slips). Matching is done on the squashed
    // title, so punctuation, spaces and case never get in the way.
    function matchToken(tok, sq) {
        var s = sq.s, map = sq.map, low = sq.low, idx = [], i;
        var at = s.indexOf(tok);
        if (at >= 0) {
            for (i = 0; i < tok.length; i++) idx.push(map[at + i]);
            return { score: 100 + tok.length * 2 + (isBoundary(low, map[at]) ? 20 : 0) - at * 0.2, idx: idx };
        }
        var j = 0, end = -1;
        for (i = 0; i < s.length; i++) {
            if (s.charAt(i) === tok.charAt(j)) { j++; if (j === tok.length) { end = i; break; } }
        }
        if (end >= 0) {
            var k2 = tok.length - 1, start = end;
            for (i = end; i >= 0; i--) {
                if (s.charAt(i) === tok.charAt(k2)) { k2--; if (k2 < 0) { start = i; break; } }
            }
            var span = end - start + 1;
            if (span <= tok.length * 2 + 2) {
                j = 0;
                var bounds = 0;
                for (i = start; i <= end && j < tok.length; i++) {
                    if (s.charAt(i) === tok.charAt(j)) { idx.push(map[i]); if (isBoundary(low, map[i])) bounds++; j++; }
                }
                return { score: 50 - (span - tok.length) * 3 + bounds * 4 - start * 0.2, idx: idx };
            }
        }
        var k = maxTypos(tok.length);
        if (k) {
            var f = approxFind(tok, s, k);
            if (f) {
                var from = Math.max(0, f.end - tok.length + 1);
                for (i = from; i <= f.end; i++) if (tok.indexOf(s.charAt(i)) >= 0) idx.push(map[i]);   // only letters of the word
                return { score: 40 - f.dist * 12 + (isBoundary(low, map[from]) ? 10 : 0), idx: idx };
            }
        }
        return null;
    }

    // Text in "double quotes" is exact: it must appear as typed (any case, punctuation and spacing
    // as given) AND as whole words - "architect" does not match "architecture". While the closing
    // quote is not typed yet it only has to start a word, so results still appear as you type.
    function findExact(low, ph, closed) {
        var from = 0, at;
        while ((at = low.indexOf(ph, from)) >= 0) {
            var end = at + ph.length;
            var before = at === 0 ? '' : low.charAt(at - 1);
            var after = end >= low.length ? '' : low.charAt(end);
            var okStart = !WORD_CHAR.test(ph.charAt(0)) || !before || !WORD_CHAR.test(before);
            var okEnd = !closed || !WORD_CHAR.test(ph.charAt(ph.length - 1)) || !after || !WORD_CHAR.test(after);
            if (okStart && okEnd) return at;
            from = at + 1;
        }
        return -1;
    }

    // Every word of the query must match; returns the score and the matched character positions.
    // Words are matched fuzzily (see above) - except quoted text, which is exact (see findExact).
    // A query typed with a space ("ccar p") is also tried as one word ("ccarp").
    function fuzzyMatch(query, title) {
        var sq = squash(title);
        var phrases = [];
        var rest = query.replace(/["\u201c\u201d]([^"\u201c\u201d]*)(["\u201c\u201d]|$)/g, function (m, p, close) {
            p = p.trim().toLowerCase();
            if (p) phrases.push({ text: p, closed: !!close });
            return ' ';
        });
        var phraseScore = 0, marks = {};
        for (var q = 0; q < phrases.length; q++) {
            var ph = phrases[q].text;
            var at = findExact(sq.low, ph, phrases[q].closed);
            if (at < 0) return null;
            phraseScore += 100 + ph.length * 2 + (isBoundary(sq.low, at) ? 20 : 0) - at * 0.2;
            for (var c = 0; c < ph.length; c++) marks[at + c] = true;
        }
        var tokens = rest.toLowerCase().split(/\s+/).map(normToken).filter(Boolean);
        if (!tokens.length) return phrases.length ? { score: phraseScore, marks: marks } : null;
        function run(list) {
            var total = 0, m = {};
            for (var n = 0; n < list.length; n++) {
                var r = matchToken(list[n], sq);
                if (!r) return null;
                total += r.score;
                r.idx.forEach(function (i) { m[i] = true; });
            }
            return { score: total, marks: m };
        }
        var best = run(tokens);
        if (tokens.length > 1) {
            var joined = run([tokens.join('')]);
            if (joined && (!best || joined.score > best.score)) best = joined;
        }
        if (!best) return null;
        best.score += phraseScore;
        for (var k in marks) best.marks[k] = true;
        return best;
    }

    // the title with matched letters wrapped in <mark>
    function markedTitle(title, marks) {
        var frag = document.createDocumentFragment(), run = '', on = false;
        function flush() {
            if (!run) return;
            frag.appendChild(on ? el('mark', null, run) : document.createTextNode(run));
            run = '';
        }
        for (var i = 0; i < title.length; i++) {
            var m = !!marks[i];
            if (m !== on) { flush(); on = m; }
            run += title.charAt(i);
        }
        flush();
        return frag;
    }

    var ARROW_UP_RIGHT = '<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 14 14 6M7 6h7v7"/></svg>';

    // every content link opens in a new tab, so the explore page stays where it is
    function linkAttrs(a, link) {
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
    }

    var ARROW_RIGHT = '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"/></svg>';

    function initExplore(cfg) {
        var cats = cfg.categories || [];
        var heading = document.getElementById('xp-title');
        if (heading && cfg.title) heading.textContent = cfg.title;

        var hero = document.getElementById('xp-hero');
        var catsBox = document.getElementById('xp-cats');
        var promoBox = document.getElementById('xp-promo');
        var view = document.getElementById('xp-view');
        // six pastels: used for the box hover colour and (one each, never the same as the tile
        // beside or above it) for the tiles in the Tiles view
        var PASTELS = ['#f7d89b', '#c9d8fb', '#f7cfd8', '#cdeedb', '#dcd3f5', '#fbd9c5'];

        // every category is a list of groups (sub-categories); a flat "items" list is one untitled group
        var all = [];
        cats.forEach(function (c) {
            c.groups = (c.groups && c.groups.length) ? c.groups : [{ title: '', items: c.items || [] }];
            c.total = 0;
            var last1 = -1, last2 = -1;     // carried across groups, so a group never opens in the colour the last one ended with
            c.groups.forEach(function (g) {
                (g.items || []).forEach(function (it) {
                    var k;
                    do { k = Math.floor(Math.random() * PASTELS.length); } while (k === last1 || k === last2);
                    last2 = last1;
                    last1 = k;
                    it.tile = PASTELS[k];
                    c.total++;
                    all.push({ cat: c, group: g.title, title: it.title, link: it.link });
                });
            });
        });

        // a box's hover colour: one of six pastels, chosen at random each time (never the same
        // one twice in a row), always with dark text
        var HOVER_COLOURS = PASTELS;
        var lastHover = -1;
        function pickHover(node) {
            var i;
            do { i = Math.floor(Math.random() * HOVER_COLOURS.length); } while (i === lastHover);
            lastHover = i;
            node.style.setProperty('--hbg', HOVER_COLOURS[i]);
            node.style.setProperty('--hfg', '#14120d');
            node.style.setProperty('--hdesc', '#5f5a4e');
        }

        // ----- category boxes: title, sub line, size; a click opens the whole category -----
        cats.forEach(function (c) {
            var b = el('button', 'xp-box');
            b.type = 'button';
            b.appendChild(el('h2', 'xp-box-title', c.title));
            b.appendChild(el('p', 'xp-box-desc', c.description));
            var foot = el('div', 'xp-box-foot');
            var n = c.total;
            foot.appendChild(el('span', 'xp-box-count', n + (n === 1 ? ' item' : ' items')));
            var go = el('span', 'xp-box-go');
            go.innerHTML = ARROW_RIGHT;
            foot.appendChild(go);
            b.appendChild(foot);
            b.addEventListener('click', function () { openCategory(c); });
            b.addEventListener('pointerenter', function () { pickHover(b); });
            b.addEventListener('focus', function () { pickHover(b); });
            catsBox.appendChild(b);
        });

        // ----- the Promoted box: hand-picked links drifting past in one slow line -----
        var promo = cfg.promoted || {};
        var promoItems = promo.items || [];
        var hasPromo = promoItems.length > 0;
        var PROMO_PX_PER_S = 36;       // how fast the line drifts
        var promoTrack = null, promoStrip = null;
        if (hasPromo) {
            promoBox.appendChild(el('p', 'xp-promo-title', promo.title || 'Promoted'));
            promoStrip = el('div', 'xp-promo-marquee');
            promoTrack = el('div', 'xp-promo-track');
            promoStrip.appendChild(promoTrack);
            promoBox.appendChild(promoStrip);
        }
        function promoLink(p, copy) {
            var a = el('a', 'xp-promo-link');
            linkAttrs(a, p.link);
            if (copy) { a.setAttribute('aria-hidden', 'true'); a.tabIndex = -1; }
            a.appendChild(el('span', 'xp-promo-label', p.label));
            var go = el('span', 'xp-promo-go');
            go.innerHTML = ARROW_RIGHT;
            a.appendChild(go);
            return a;
        }
        // The links are laid out once (repeated if needed to be wider than the strip), then the
        // whole run is repeated a second time: the track slides left by exactly one run, so the
        // loop has no seam.
        function buildPromo() {
            if (!promoTrack || !promoStrip.clientWidth) return;
            promoTrack.innerHTML = '';
            promoItems.forEach(function (p) { promoTrack.appendChild(promoLink(p, false)); });
            var one = promoTrack.scrollWidth || 1;
            var reps = Math.max(1, Math.ceil((promoStrip.clientWidth + 1) / one));
            var r, i;
            for (r = 1; r < reps; r++) promoItems.forEach(function (p) { promoTrack.appendChild(promoLink(p, true)); });
            var run = promoTrack.scrollWidth;
            for (r = 0; r < reps; r++) promoItems.forEach(function (p) { promoTrack.appendChild(promoLink(p, true)); });
            promoTrack.style.setProperty('--shift', run + 'px');
            promoTrack.style.setProperty('--dur', (run / PROMO_PX_PER_S).toFixed(1) + 's');
        }
        window.addEventListener('resize', function () { if (!promoBox.hidden) buildPromo(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (!promoBox.hidden) buildPromo(); });
        // the boxes and the Promoted box are the page's resting state; search and a
        // category view each replace them
        function idle(show) {
            catsBox.hidden = !show;
            promoBox.hidden = !(show && hasPromo);
            if (show && hasPromo) buildPromo();
        }
        idle(true);

        // ----- one category, opened in full -----
        var vTitle = document.getElementById('xp-view-title');
        var vDesc = document.getElementById('xp-view-desc');
        var vCount = document.getElementById('xp-view-count');
        var vFilter = document.getElementById('xp-filter');
        var vList = document.getElementById('xp-view-list');
        var current = null;

        // List (default) or Tiles; the choice is remembered
        var mode = 'list';
        try { if (localStorage.getItem('xpViewMode') === 'tiles') mode = 'tiles'; } catch (e) {}
        var modeList = document.getElementById('xp-mode-list');
        var modeTiles = document.getElementById('xp-mode-tiles');
        function syncModes() {
            modeList.classList.toggle('is-on', mode === 'list');
            modeTiles.classList.toggle('is-on', mode === 'tiles');
            modeList.setAttribute('aria-pressed', mode === 'list' ? 'true' : 'false');
            modeTiles.setAttribute('aria-pressed', mode === 'tiles' ? 'true' : 'false');
        }
        function setMode(m) {
            mode = m;
            try { localStorage.setItem('xpViewMode', m); } catch (e) {}
            syncModes();
            if (current) { renderList(vFilter.value); vList.scrollTop = 0; }
        }
        modeList.addEventListener('click', function () { setMode('list'); });
        modeTiles.addEventListener('click', function () { setMode('tiles'); });
        syncModes();

        // Every group keeps its own heading and its own items, in either view. With a filter typed,
        // each group shows only its matches (best first) and groups with none disappear.
        function renderList(q) {
            q = q.trim();
            var shown = 0;
            vList.innerHTML = '';
            vList.classList.toggle('is-tiles', mode === 'tiles');
            current.groups.forEach(function (g) {
                var items = g.items || [];
                var rows = [];
                if (q) {
                    items.forEach(function (it, i) {
                        var m = fuzzyMatch(q, it.title);
                        if (m) rows.push({ it: it, m: m, i: i });
                    });
                    rows.sort(function (a, b) { return b.m.score - a.m.score || a.i - b.i; });
                } else {
                    rows = items.map(function (it, i) { return { it: it, m: null, i: i }; });
                }
                if (!rows.length) return;
                shown += rows.length;
                var sec = el('section', 'xp-group');
                sec.setAttribute('data-group', g.title || '');
                if (g.title) {
                    var head = el('div', 'xp-group-head');
                    head.appendChild(el('h3', 'xp-group-title', g.title));
                    if (g.description) head.appendChild(el('p', 'xp-group-desc', g.description));
                    sec.appendChild(head);
                }
                var holder = el(mode === 'tiles' ? 'div' : 'ul', mode === 'tiles' ? 'xp-tiles' : 'xp-list');
                rows.forEach(function (r) {
                    var a = el('a', mode === 'tiles' ? 'xp-tile' : null);
                    linkAttrs(a, r.it.link);
                    if (mode === 'tiles') a.style.setProperty('--tile', r.it.tile);
                    var t = el('span', 'xp-item-title');
                    if (r.m) t.appendChild(markedTitle(r.it.title, r.m.marks)); else t.textContent = r.it.title;
                    a.appendChild(t);
                    var go = el('span', 'xp-go');
                    go.innerHTML = ARROW_UP_RIGHT;
                    a.appendChild(go);
                    if (mode === 'tiles') {
                        holder.appendChild(a);
                    } else {
                        var li = document.createElement('li');
                        li.appendChild(a);
                        holder.appendChild(li);
                    }
                });
                sec.appendChild(holder);
                vList.appendChild(sec);
            });
            vCount.textContent = q ? shown + ' of ' + current.total : current.total + (current.total === 1 ? ' item' : ' items');
            if (!shown) vList.appendChild(el('p', 'xp-view-empty', 'Nothing here matches \u201c' + q + '\u201d.'));
        }

        // the category name is as big as will fit in two lines: it breaks only at spaces and
        // hyphens (Open- / Questionnaires), and shrinks until its longest word fits the column
        function fitViewTitle() {
            vTitle.style.fontSize = '';
            var size = parseFloat(getComputedStyle(vTitle).fontSize);
            while (size > 22) {
                var tooWide = vTitle.scrollWidth > vTitle.clientWidth + 1;
                var lines = Math.round(vTitle.getBoundingClientRect().height / (size * 1.0));
                if (!tooWide && lines <= 2) break;
                size -= 2;
                vTitle.style.fontSize = size + 'px';
            }
        }
        window.addEventListener('resize', function () { if (current) fitViewTitle(); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (current) fitViewTitle(); });

        function openCategory(c, push, groupTitle) {
            current = c;
            vTitle.textContent = c.title;
            vDesc.textContent = c.description;
            vFilter.value = '';
            vFilter.placeholder = 'Filter ' + c.title.toLowerCase();
            renderList('');
            hero.hidden = true;
            idle(false);
            view.hidden = false;
            fitViewTitle();
            vList.scrollTop = 0;
            if (groupTitle) {
                // a sub-category picked in search: scroll the list to it
                var secs = vList.querySelectorAll('.xp-group');
                for (var si = 0; si < secs.length; si++) {
                    if (secs[si].getAttribute('data-group') === groupTitle) {
                        vList.scrollTop = secs[si].getBoundingClientRect().top - vList.getBoundingClientRect().top + vList.scrollTop;
                        break;
                    }
                }
            }
            if (push !== false && location.hash !== '#' + c.id) history.pushState(null, '', '#' + c.id);
        }
        function closeCategory(push) {
            if (!current) return;
            current = null;
            view.hidden = true;
            hero.hidden = false;
            idle(true);
            if (push !== false && location.hash) history.pushState(null, '', location.pathname + location.search);
        }
        document.getElementById('xp-back').addEventListener('click', function () { closeCategory(); });
        vFilter.addEventListener('input', function () { if (current) renderList(vFilter.value); });
        window.addEventListener('popstate', function () {
            var id = location.hash.slice(1);
            var hit = cats.filter(function (c) { return c.id === id; })[0];
            if (hit) openCategory(hit, false); else closeCategory(false);
        });

        // ----- search -----
        // Clicking the pill opens search MODE: the page turns black, the layout moves up, the
        // boxes go away and the hints appear. Typing swaps the hints for the best matches.
        // Esc, the x (when the field is empty) or a click on the background leaves search mode.
        var wrap = document.getElementById('xp-search');
        var input = document.getElementById('xp-input');
        var openBtn = document.getElementById('xp-open');
        var clearBtn = document.getElementById('xp-clear');
        var box = document.getElementById('xp-results');
        var hintsBox = document.getElementById('xp-hints');
        var hints = (cfg.promoted && cfg.promoted.items) || [];   // the same links as the Promoted box
        var active = -1, searching = false;

        // the page turns dark while search is open
        function applyTheme() {
            document.body.classList.toggle('xp-dark', searching);
        }

        hintsBox.innerHTML = '';
        if (hints.length) {
            hintsBox.appendChild(el('p', 'xp-hints-title', cfg['hints-title'] || 'Try'));
            var hl = el('div', 'xp-hint-list');
            hints.forEach(function (h) {
                var a = el('a', 'xp-hint');
                linkAttrs(a, h.link);
                a.appendChild(el('span', 'xp-hint-label', h.label));
                var go = el('span', 'xp-go');
                go.innerHTML = ARROW_UP_RIGHT;
                a.appendChild(go);
                hl.appendChild(a);
            });
            hintsBox.appendChild(hl);
        }

        function openSearch() {
            if (searching) return;
            searching = true;
            applyTheme();
            document.body.classList.add('is-searching');
            wrap.classList.add('is-open');
            openBtn.tabIndex = -1;
            clearBtn.hidden = false;
            idle(false);
            render(input.value);
            input.focus();
        }
        function closeSearch() {
            searching = false;
            applyTheme();
            document.body.classList.remove('is-searching');
            wrap.classList.remove('is-open');
            openBtn.tabIndex = 0;
            input.value = '';
            input.blur();
            clearBtn.hidden = true;
            box.hidden = true;
            box.innerHTML = '';
            hintsBox.hidden = true;
            idle(true);
            active = -1;
        }
        function rows() { return box.querySelectorAll('.xp-row'); }
        function setActive(n) {
            var r = rows();
            if (!r.length) { active = -1; return; }
            active = (n + r.length) % r.length;
            Array.prototype.forEach.call(r, function (row, i) { row.classList.toggle('is-active', i === active); });
            r[active].scrollIntoView({ block: 'nearest' });
        }

        function showTopics() {
            var topics = el('div', 'xp-topics');
            cats.forEach(function (c) {
                var b = el('button', 'xp-chip', c.title);
                b.type = 'button';
                b.addEventListener('click', function () {
                    closeSearch();
                    openCategory(c);
                });
                topics.appendChild(b);
            });
            return topics;
        }

        function render(q) {
            q = q.trim();
            clearBtn.setAttribute('aria-label', input.value ? 'Clear search' : 'Close search');
            if (!q) {
                box.hidden = true;
                box.innerHTML = '';
                active = -1;
                hintsBox.hidden = !(searching && hints.length);
                return;
            }
            hintsBox.hidden = true;        // the hints vanish with the first letter
            box.hidden = false;
            box.innerHTML = '';
            var found = [];
            all.forEach(function (it, order) {
                var m = fuzzyMatch(q, it.title);
                if (m) found.push({ it: it, m: m, order: order });
            });
            // a sub-category whose name matches is an option of its own, ranked by the same score
            cats.forEach(function (c) {
                c.groups.forEach(function (g, gi) {
                    if (!g.title) return;
                    var gm = fuzzyMatch(q, g.title);
                    if (gm) found.push({ group: g, cat: c, m: gm, order: -1 + gi * 0.001 });
                });
            });
            found.sort(function (a, b) { return b.m.score - a.m.score || a.order - b.order; });
            found = found.slice(0, 8);
            if (!found.length) {
                var empty = el('div', 'xp-empty');
                empty.appendChild(el('h2', 'xp-empty-title', 'No results found'));
                empty.appendChild(el('p', 'xp-empty-sub', 'Try again or select a topic below'));
                empty.appendChild(el('p', 'xp-empty-msg', 'No results found for \u201c' + q + '\u201d.'));
                empty.appendChild(showTopics());
                box.appendChild(empty);
                active = -1;
                return;
            }
            found.forEach(function (f) {
                var a = el('a', 'xp-row');
                var t = el('span', 'xp-row-title');
                if (f.group) {
                    // the sub-category itself: opens its category, scrolled to it
                    a.href = '#' + f.cat.id;
                    a.addEventListener('click', function (e) {
                        e.preventDefault();
                        closeSearch();
                        openCategory(f.cat, undefined, f.group.title);
                    });
                    a.appendChild(el('span', 'xp-row-cat', f.cat.title));
                    t.appendChild(document.createTextNode('Sub-category: '));
                    t.appendChild(el('em', 'xp-row-sub', '\u201c' + f.group.title + '\u201d'));
                } else {
                    linkAttrs(a, f.it.link);
                    a.title = f.it.title;
                    a.appendChild(el('span', 'xp-row-cat', f.it.cat.title));
                    t.appendChild(markedTitle(f.it.title, f.m.marks));
                }
                a.appendChild(t);
                box.appendChild(a);
            });
            setActive(0);
        }

        openBtn.addEventListener('click', openSearch);
        wrap.addEventListener('click', openSearch);
        input.addEventListener('input', function () { render(input.value); });
        clearBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (input.value) { input.value = ''; render(''); input.focus(); }
            else closeSearch();
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
            else if (e.key === 'Enter') {
                var r = rows();
                if (r.length) { e.preventDefault(); r[Math.max(active, 0)].click(); }
            }
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (searching) {
                if (input.value) { input.value = ''; render(''); input.focus(); }
                else closeSearch();
            } else if (current) {
                if (vFilter.value) { vFilter.value = ''; renderList(''); }
                else closeCategory();
            }
        });
        // a click on the empty background leaves search mode (only while nothing is typed)
        document.addEventListener('click', function (e) {
            if (!searching || input.value) return;
            if (e.target.closest && e.target.closest('.xp-search, .xp-hints, .xp-results, .nav, .about-modal-backdrop')) return;
            closeSearch();
        });

        // a link such as explore.html#articles opens that category straight away
        var startId = location.hash.slice(1);
        var startCat = cats.filter(function (c) { return c.id === startId; })[0];
        if (startCat) openCategory(startCat, false);
    }

    // 'no-cache' = ask the server whether the file changed on every load (a cheap 304 when it has
    // not), so an edited config shows up right away instead of an old copy from the browser's cache
    function loadJSON(path, onSuccess, label) {
        fetch(path, { cache: 'no-cache' })
            .then(function (res) {
                if (!res.ok) throw new Error(path + ' responded ' + res.status);
                return res.json();
            })
            .then(onSuccess)
            .catch(function (err) {
                console.error(
                    '[content] could not load ' + label + ' - is this page being served over http(s)? ' +
                    'fetch() does not work when a page is opened directly as a file. (' + err.message + ')'
                );
            });
    }

    // title bar, logo and About popup come from the welcome-page config on both pages
    if (document.getElementById('nav-links')) {
        loadJSON('config/homepage.json', initHome, 'homepage.json');
    }
    if (document.getElementById('xp-cats')) {
        loadJSON('config/explore.json', initExplore, 'explore.json');
    }
})();
