(function () {
    'use strict';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
// mail client, which is common in a browser-only workflow. content.js
// writes the real address into data-copy-email once profile.json loads.
    document.querySelectorAll('[data-copy-email]').forEach(function (btn) {
        btn.addEventListener('click', function () {
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
    });
// "About Him" popup - generic open/close chrome only; content.js fills
// in the name and paragraphs once about.json loads.
    var aboutTrigger = document.querySelector('[data-open-about]');
    var aboutBackdrop = document.getElementById('about-modal-backdrop');
    if (aboutTrigger && aboutBackdrop) {
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
        aboutTrigger.addEventListener('click', openAbout);
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