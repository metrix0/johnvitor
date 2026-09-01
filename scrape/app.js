const amountInput = document.getElementById('amountInput');
const scrapeBtn = document.getElementById('scrapeBtn');
const statusBadge = document.getElementById('statusBadge');
const countValue = document.getElementById('countValue');
const queryValue = document.getElementById('queryValue');
const tableBody = document.getElementById('tableBody');
const emptyState = document.getElementById('emptyState');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const toastEl = document.getElementById('toast');

const HISTORY_KEY = 'imenu-lead-scraper-history-v1';
const BATCH_SIZE = 15;
const MAX_EMPTY_BATCHES = 6;

let running = false;
let abortController = null;
let leads = [];
let history = loadHistory();

function loadHistory() {
    try {
        const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}');
        return {
            placeIds: Array.isArray(parsed.placeIds) ? parsed.placeIds : [],
            phones: Array.isArray(parsed.phones) ? parsed.phones : []
        };
    } catch {
        return { placeIds: [], phones: [] };
    }
}

function saveHistory() {
    history.placeIds = history.placeIds.slice(-50000);
    history.phones = history.phones.slice(-50000);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function parseTarget() {
    const raw = amountInput.value.trim().toUpperCase();
    if (raw === 'MAX') return Infinity;
    if (!/^\d+$/.test(raw)) return null;
    const value = Number(raw);
    return value > 0 ? value : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function toast(title, message) {
    toastEl.innerHTML = `<strong>${escapeHtml(title)}</strong><div class="muted">${escapeHtml(message)}</div>`;
    toastEl.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toastEl.style.display = 'none';
    }, 2600);
}

function setRunning(value) {
    running = value;
    amountInput.disabled = value;
    scrapeBtn.className = value ? 'btn-danger' : 'btn-primary';
    scrapeBtn.innerHTML = value
        ? '<i class="fa-solid fa-stop"></i> Stop'
        : '<i class="fa-solid fa-magnifying-glass"></i> Scrape';
}

function render() {
    countValue.textContent = String(leads.length);
    copyBtn.disabled = leads.length === 0;
    downloadBtn.disabled = leads.length === 0;
    emptyState.style.display = leads.length ? 'none' : 'block';

    tableBody.innerHTML = leads.map((lead, index) => {
        const website = lead.website
            ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener noreferrer">site</a>`
            : '<span class="muted">—</span>';
        const maps = lead.mapsUrl
            ? `<a href="${escapeHtml(lead.mapsUrl)}" target="_blank" rel="noopener noreferrer">maps</a>`
            : '';
        const categories = (lead.categories || [])
            .filter(type => ['restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'cafe', 'bakery', 'bar'].includes(type))
            .join(', ');

        return `<tr>
            <td>${index + 1}</td>
            <td><strong>${escapeHtml(lead.name)}</strong><div class="sub">${escapeHtml(lead.city)}, ${escapeHtml(lead.state)}</div></td>
            <td class="phone">${escapeHtml(lead.phoneDigits)}</td>
            <td>${escapeHtml(categories || 'food')}</td>
            <td>${escapeHtml(lead.reviewsCount)}</td>
            <td>${lead.rating == null ? '—' : escapeHtml(lead.rating)}</td>
            <td class="links">${website}${website && maps ? ' · ' : ''}${maps}</td>
        </tr>`;
    }).join('');
}

function addLeads(incoming) {
    const seenPlaceIds = new Set(history.placeIds);
    const seenPhones = new Set(history.phones);
    const currentPhones = new Set(leads.map(lead => lead.phoneDigits));
    let added = 0;

    for (const lead of incoming || []) {
        if (!lead?.placeId || !lead?.phoneDigits) continue;
        if (seenPlaceIds.has(lead.placeId) || seenPhones.has(lead.phoneDigits) || currentPhones.has(lead.phoneDigits)) continue;

        leads.push(lead);
        history.placeIds.push(lead.placeId);
        history.phones.push(lead.phoneDigits);
        seenPlaceIds.add(lead.placeId);
        seenPhones.add(lead.phoneDigits);
        currentPhones.add(lead.phoneDigits);
        added += 1;
    }

    if (added) saveHistory();
    render();
    return added;
}

async function fetchBatch(limit) {
    abortController = new AbortController();
    const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            limit,
            excludePlaceIds: history.placeIds.slice(-1500)
        }),
        signal: abortController.signal
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
}

async function startScraping() {
    const target = parseTarget();
    if (target == null) {
        toast('Invalid amount', 'Use a number greater than 0 or MAX.');
        amountInput.focus();
        return;
    }

    leads = [];
    render();
    setRunning(true);
    statusBadge.textContent = target === Infinity ? 'Running · MAX' : `Running · target ${target}`;
    queryValue.textContent = 'Starting…';

    let emptyBatches = 0;

    try {
        while (running && (target === Infinity || leads.length < target)) {
            const remaining = target === Infinity
                ? BATCH_SIZE
                : Math.min(BATCH_SIZE, target - leads.length);
            const data = await fetchBatch(remaining);

            const lastSearch = Array.isArray(data.searches) && data.searches.length
                ? data.searches[data.searches.length - 1]
                : null;
            if (lastSearch) {
                queryValue.textContent = `${lastSearch.keyword} · ${lastSearch.city}/${lastSearch.state}`;
            }

            const added = addLeads(data.leads);
            emptyBatches = added === 0 ? emptyBatches + 1 : 0;
            statusBadge.textContent = target === Infinity
                ? `Running · ${leads.length} found`
                : `Running · ${leads.length}/${target}`;

            if (emptyBatches >= MAX_EMPTY_BATCHES) {
                throw new Error('Too many searches returned no new phone numbers. Try again later.');
            }

            if (target !== Infinity && leads.length >= target) break;
            await new Promise(resolve => setTimeout(resolve, 250));
        }

        if (running) {
            statusBadge.textContent = `Done · ${leads.length} found`;
            toast('Done', `${leads.length} new phone numbers found.`);
        }
    } catch (error) {
        if (error?.name === 'AbortError') {
            statusBadge.textContent = `Stopped · ${leads.length} found`;
        } else {
            statusBadge.textContent = `Error · ${leads.length} found`;
            toast('Scrape error', error?.message || String(error));
        }
    } finally {
        setRunning(false);
        abortController = null;
    }
}

scrapeBtn.addEventListener('click', () => {
    if (running) {
        running = false;
        abortController?.abort();
        return;
    }
    startScraping();
});

copyBtn.addEventListener('click', async () => {
    if (!leads.length) return;
    await navigator.clipboard.writeText(leads.map(lead => lead.phoneDigits).join('\n'));
    toast('Copied', `${leads.length} phone numbers copied.`);
});

downloadBtn.addEventListener('click', () => {
    if (!leads.length) return;
    const rows = [
        ['name', 'phone', 'city', 'state', 'reviews', 'rating', 'website', 'google_maps'],
        ...leads.map(lead => [
            lead.name,
            lead.phoneDigits,
            lead.city,
            lead.state,
            lead.reviewsCount,
            lead.rating ?? '',
            lead.website || '',
            lead.mapsUrl || ''
        ])
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `imenu-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
});

clearHistoryBtn.addEventListener('click', () => {
    if (!confirm('Clear the saved duplicate history?')) return;
    history = { placeIds: [], phones: [] };
    saveHistory();
    toast('History cleared', 'Previously found businesses can appear again.');
});

amountInput.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !running) startScraping();
});

render();
