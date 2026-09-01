const SERPAPI_URL = 'https://serpapi.com/search.json';
const MIN_REVIEWS = 15;
const MAX_LIMIT = 20;
const MAX_SEARCH_ROUNDS = 7;
const MAX_RANDOM_PAGE = 8;

const KEYWORDS = [
    'hamburgueria',
    'burger delivery',
    'pizzaria',
    'sushi',
    'açai',
    'marmitaria',
    'lanchonete',
    'esfiharia',
    'pastelaria',
    'delivery comida'
];

const CITIES = [
    ['São Paulo', 'SP', -23.5505, -46.6333],
    ['Rio de Janeiro', 'RJ', -22.9068, -43.1729],
    ['Belo Horizonte', 'MG', -19.9167, -43.9345],
    ['Brasília', 'DF', -15.7939, -47.8828],
    ['Salvador', 'BA', -12.9777, -38.5016],
    ['Fortaleza', 'CE', -3.7319, -38.5267],
    ['Curitiba', 'PR', -25.4284, -49.2733],
    ['Recife', 'PE', -8.0476, -34.8770],
    ['Porto Alegre', 'RS', -30.0346, -51.2177],
    ['Manaus', 'AM', -3.1190, -60.0217],
    ['Belém', 'PA', -1.4558, -48.4902],
    ['Goiânia', 'GO', -16.6869, -49.2648],
    ['Campinas', 'SP', -22.9099, -47.0626],
    ['São Luís', 'MA', -2.5307, -44.3068],
    ['Maceió', 'AL', -9.6498, -35.7089],
    ['Campo Grande', 'MS', -20.4697, -54.6201],
    ['Natal', 'RN', -5.7945, -35.2110],
    ['Teresina', 'PI', -5.0919, -42.8034],
    ['João Pessoa', 'PB', -7.1195, -34.8450],
    ['São Bernardo do Campo', 'SP', -23.6914, -46.5646],
    ['Santo André', 'SP', -23.6639, -46.5383],
    ['Osasco', 'SP', -23.5325, -46.7917],
    ['Sorocaba', 'SP', -23.5015, -47.4526],
    ['Ribeirão Preto', 'SP', -21.1775, -47.8103],
    ['Uberlândia', 'MG', -18.9186, -48.2772],
    ['Contagem', 'MG', -19.9321, -44.0539],
    ['Aracaju', 'SE', -10.9472, -37.0731],
    ['Feira de Santana', 'BA', -12.2664, -38.9663],
    ['Cuiabá', 'MT', -15.6014, -56.0979],
    ['Joinville', 'SC', -26.3044, -48.8464],
    ['Londrina', 'PR', -23.3045, -51.1696],
    ['Juiz de Fora', 'MG', -21.7609, -43.3500],
    ['Niterói', 'RJ', -22.8859, -43.1153],
    ['Ananindeua', 'PA', -1.3656, -48.3722],
    ['Aparecida de Goiânia', 'GO', -16.8198, -49.2469],
    ['Porto Velho', 'RO', -8.7612, -63.9004],
    ['Serra', 'ES', -20.1288, -40.3074],
    ['Caxias do Sul', 'RS', -29.1634, -51.1797],
    ['Macapá', 'AP', 0.0349, -51.0694],
    ['Florianópolis', 'SC', -27.5949, -48.5482],
    ['Vila Velha', 'ES', -20.3297, -40.2925],
    ['Mauá', 'SP', -23.6677, -46.4613],
    ['São José dos Campos', 'SP', -23.2237, -45.9009],
    ['Mogi das Cruzes', 'SP', -23.5229, -46.1883],
    ['Betim', 'MG', -19.9673, -44.2011],
    ['Jundiaí', 'SP', -23.1857, -46.8978],
    ['Maringá', 'PR', -23.4205, -51.9333],
    ['Santos', 'SP', -23.9608, -46.3336],
    ['Piracicaba', 'SP', -22.7338, -47.6476],
    ['Blumenau', 'SC', -26.9194, -49.0661],
    ['Bauru', 'SP', -22.3145, -49.0587],
    ['Vitória', 'ES', -20.3155, -40.3128],
    ['Franca', 'SP', -20.5393, -47.4013],
    ['Ponta Grossa', 'PR', -25.0994, -50.1583],
    ['Canoas', 'RS', -29.9178, -51.1836],
    ['Pelotas', 'RS', -31.7654, -52.3376],
    ['Limeira', 'SP', -22.5649, -47.4017],
    ['Rio Claro', 'SP', -22.4100, -47.5600],
    ['Sumaré', 'SP', -22.8219, -47.2669],
    ['Americana', 'SP', -22.7370, -47.3330],
    ['São José do Rio Preto', 'SP', -20.8113, -49.3758],
    ['Uberaba', 'MG', -19.7472, -47.9392],
    ['Montes Claros', 'MG', -16.7286, -43.8582],
    ['Cascavel', 'PR', -24.9555, -53.4552],
    ['Foz do Iguaçu', 'PR', -25.5163, -54.5854],
    ['Itajaí', 'SC', -26.9101, -48.6705],
    ['Chapecó', 'SC', -27.1004, -52.6152]
];

function response(data, statusCode = 200) {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(data)
    };
}

function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
}

function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function randomPoint(city) {
    const [, , lat, lng] = city;
    return {
        lat: Number((lat + ((Math.random() - 0.5) * 0.12)).toFixed(6)),
        lng: Number((lng + ((Math.random() - 0.5) * 0.12)).toFixed(6))
    };
}

function normalizePhone(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';

    let digits = raw.replace(/\D/g, '');
    if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')) {
        digits = `55${digits}`;
    }
    return digits;
}

function stablePlaceId(place) {
    return String(
        place.data_id ||
        place.data_cid ||
        place.place_id ||
        `${place.title || ''}|${place.address || ''}`
    ).trim();
}

async function serpJson(params) {
    const apiKey = process.env.SERPAPI_API_KEY?.trim();
    if (!apiKey) throw new Error('SERPAPI_API_KEY is not configured.');

    const query = new URLSearchParams({
        ...params,
        api_key: apiKey
    });

    const res = await fetch(`${SERPAPI_URL}?${query}`, {
        headers: { Accept: 'application/json' }
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.error || `SerpAPI HTTP ${res.status}.`);
    if (data.error) throw new Error(data.error);
    return data;
}

async function fetchMapResults(city, keyword) {
    const [name, state] = city;
    const point = randomPoint(city);
    const page = Math.floor(Math.random() * (MAX_RANDOM_PAGE + 1));

    const data = await serpJson({
        engine: 'google_maps',
        type: 'search',
        q: keyword,
        hl: 'pt-br',
        gl: 'br',
        ll: `@${point.lat},${point.lng},13z`,
        start: String(page * 20)
    });

    return {
        city: name,
        state,
        keyword,
        page: page + 1,
        results: Array.isArray(data.local_results) ? data.local_results : []
    };
}

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return response({ error: 'Method not allowed.' }, 405);
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const requestedLimit = Number(body.limit);
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(requestedLimit)))
            : 10;

        const excluded = new Set(
            Array.isArray(body.excludePlaceIds)
                ? body.excludePlaceIds.slice(-1500).map(value => String(value))
                : []
        );
        const seen = new Set(excluded);
        const seenPhones = new Set();
        const leads = [];
        const searches = [];

        for (let round = 0; round < MAX_SEARCH_ROUNDS && leads.length < limit; round += 1) {
            const city = randomItem(CITIES);
            const keyword = randomItem(KEYWORDS);
            const batch = await fetchMapResults(city, keyword);
            searches.push({ city: batch.city, state: batch.state, keyword, page: batch.page });

            const candidates = shuffle(batch.results)
                .filter(place => {
                    const placeId = stablePlaceId(place);
                    const reviews = Number(place.reviews) || 0;
                    return placeId && !seen.has(placeId) && reviews >= MIN_REVIEWS && place.phone;
                })
                .sort((a, b) => (Number(b.reviews) || 0) - (Number(a.reviews) || 0));

            for (const place of candidates) {
                if (leads.length >= limit) break;

                const placeId = stablePlaceId(place);
                const phoneDigits = normalizePhone(place.phone);
                if (!phoneDigits || seenPhones.has(phoneDigits)) continue;

                seen.add(placeId);
                seenPhones.add(phoneDigits);

                leads.push({
                    placeId,
                    name: place.title || 'Restaurante',
                    phone: place.phone || '',
                    phoneDigits,
                    city: batch.city,
                    state: batch.state,
                    address: place.address || '',
                    categories: place.type ? [place.type] : [],
                    rating: Number(place.rating) || null,
                    reviewsCount: Number(place.reviews) || 0,
                    website: place.website || '',
                    mapsUrl: place.google_maps_url || ''
                });
            }
        }

        return response({
            leads,
            searches,
            minReviews: MIN_REVIEWS,
            requested: limit,
            provider: 'serpapi'
        });
    } catch (error) {
        return response({ error: error?.message || String(error) }, 500);
    }
};
