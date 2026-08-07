(function () {
    'use strict';
// Renders content fetched from assets/*.json. Requires an actual HTTP
// server (GitHub Pages, npx serve, etc.) - fetch() of local files is
// blocked when a page is opened directly via file://.
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) e.className = className;
        if (text !== undefined) e.textContent = text;
        return e;
    }

// The hero panel's size tracks the viewport, not profile.json's content
// (see styles.css) - this cap is what makes that safe to rely on. Truncates
// on a word boundary and appends "...".
    var LIMITS = {
        headline: 100,
    };

    function truncate(str, maxLen) {
        str = str || '';
        if (str.length <= maxLen) return str;
        var cut = str.slice(0, maxLen);
        var lastSpace = cut.lastIndexOf(' ');
        if (lastSpace > 0) cut = cut.slice(0, lastSpace);
        return cut.trim() + '...';
    }

    function externalLinkIcon() {
        var span = document.createElement('span');
        span.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">' +
            '<path d="M7 17 17 7M8 7h9v9" stroke-linecap="round" stroke-linejoin="round" /></svg>';
        return span.firstElementChild;
    }

    function renderProfile(data) {
        var headline = document.getElementById('profile-headline');
        var portrait = document.getElementById('profile-portrait');
        if (headline) headline.textContent = truncate(data.headline, LIMITS.headline);
        if (portrait && data.photo) {
            portrait.src = data.photo;
            portrait.alt = 'Portrait of ' + (data.name || '');
        }
        var contacts = data.contacts || {};
        var links = {
            'hero-contact-linkedin': contacts.linkedin,
            'hero-contact-medium': contacts.medium,
            'about-contact-linkedin': contacts.linkedin,
            'about-contact-medium': contacts.medium,
        };
        Object.keys(links).forEach(function (id) {
            var a = document.getElementById(id);
            if (a && links[id]) a.href = links[id];
        });
// Email buttons copy the address instead of navigating (see script.js) -
// they read it from this data attribute rather than an href.
        if (contacts.email) {
            document.querySelectorAll('[data-copy-email]').forEach(function (btn) {
                btn.setAttribute('data-copy-email', contacts.email);
            });
        }
    }

    function renderSeriesCards(items) {
        var root = document.getElementById('series-root');
        if (!root) return;
        root.innerHTML = '';
        (items || []).forEach(function (item) {
            var card = el('article', 'series-card');
            var img = document.createElement('img');
            img.className = 'series-card-image';
            img.src = item.image;
            img.alt = item.name;
            card.appendChild(img);
            var content = el('div', 'series-card-content');
            content.appendChild(el('h3', 'series-card-name', item.name));
            var quote = el('blockquote', 'series-card-quote');
            quote.appendChild(el('p', null, item.quote));
            quote.appendChild(el('cite', null, '- ' + item.quoteAuthor));
            content.appendChild(quote);
            var body = el('div', 'series-card-body');
            (item.paragraphs || []).forEach(function (text) {
                body.appendChild(el('p', null, text));
            });
            content.appendChild(body);
            var link = document.createElement('a');
            link.className = 'series-card-link';
            link.href = item.exploreLink || 'explore.html';
            link.textContent = 'Explore the series →';
            content.appendChild(link);
            card.appendChild(content);
            root.appendChild(card);
        });
    }

// Explore page: one tab per series, one series on screen at a time - a
// multi-open accordion made same-series content hard to tell apart from
// the next series' own. Kept separate from renderSeriesCards above
// because the two pages show entirely different slices of the same
// series.json - the bio/quote fields that drive the index page's cards
// have no place here, per the brief to keep this page uncluttered.
    function renderSeriesArchive(items) {
        var root = document.getElementById('series-archive');
        if (!root) return;
        root.innerHTML = '';
        var tabs = el('div', 'archive-tabs');
        tabs.setAttribute('role', 'tablist');
        var panels = [];
        (items || []).forEach(function (item, index) {
            var isFirst = index === 0;
            var tab = el('button', 'archive-tab' + (isFirst ? ' active' : ''), item.name);
            tab.type = 'button';
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', isFirst ? 'true' : 'false');
            tab.setAttribute('data-series', item.id);
            tabs.appendChild(tab);
            var panel = el('div', 'archive-panel' + (isFirst ? ' active' : ''));
            panel.id = 'series-' + item.id;
            panel.setAttribute('data-series', item.id);
            panel.setAttribute('role', 'tabpanel');
            var groups = item.groups || [];
            if (groups.length === 0) {
                panel.appendChild(el('p', 'archive-empty', 'More coming soon.'));
            } else {
// Each group is its own block with a rule above every one after
// the first, so two groups in the same series never read as one
// continuous list of posts.
                groups.forEach(function (group) {
                    var groupEl = el('div', 'archive-group');
                    groupEl.appendChild(el('h3', 'eyebrow', group.heading));
                    groupEl.appendChild(el('p', 'archive-group-desc', group.description));
                    var ul = el('ul', 'post-list');
                    (group.links || []).forEach(function (link) {
                        var li = document.createElement('li');
                        var a = document.createElement('a');
                        a.href = link.url;
                        a.target = '_blank';
                        a.rel = 'noopener noreferrer';
                        a.appendChild(el('span', null, link.text));
                        a.appendChild(externalLinkIcon());
                        li.appendChild(a);
                        ul.appendChild(li);
                    });
                    groupEl.appendChild(ul);
                    panel.appendChild(groupEl);
                });
            }
            panels.push(panel);
            tab.addEventListener('click', function () {
                tabs.querySelectorAll('.archive-tab').forEach(function (t) {
                    var active = t === tab;
                    t.classList.toggle('active', active);
                    t.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                panels.forEach(function (p) {
                    p.classList.toggle('active', p === panel);
                });
            });
        });
        root.appendChild(tabs);
        panels.forEach(function (p) {
            root.appendChild(p);
        });
// Deep link from the index page's "Explore the series" links
// (explore.html#series-<id>) - select that one series' tab and scroll
// to it, rather than opening it in place (there's no "in place" left
// to open now that only one panel is ever shown).
        if (location.hash) {
            var match = root.querySelector(location.hash);
            if (match && match.classList.contains('archive-panel')) {
                var matchingTab = tabs.querySelector('[data-series="' + match.getAttribute('data-series') + '"]');
                if (matchingTab) matchingTab.click();
                root.scrollIntoView({block: 'start'});
            }
        }
    }

    function renderAbout(data) {
// The name header is the site's own "Akshatmistry." wordmark, hardcoded
// in index.html to match .nav-mark exactly - not data-driven, since
// it's a repeat of the brand mark rather than a personalized field.
        var body = document.getElementById('about-modal-body');
        if (!body) return;
        body.innerHTML = '';
        (data.paragraphs || []).forEach(function (text) {
            body.appendChild(el('p', null, text));
        });
    }

    function loadJSON(path, onSuccess, label) {
        fetch(path)
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

    if (document.getElementById('profile-headline')) {
        loadJSON('assets/profile.json', renderProfile, 'profile.json');
    }
    if (document.getElementById('series-root') || document.getElementById('series-archive')) {
        loadJSON('assets/series.json', function (data) {
            renderSeriesCards(data);
            renderSeriesArchive(data);
        }, 'series.json');
    }
    if (document.getElementById('about-modal-name')) {
        loadJSON('assets/about.json', renderAbout, 'about.json');
    }
})();