const GOOGLE_MAPS_API_KEY = 'AIzaSyDQAtJgGoPHJk7-PqX9F18h4uX9OYaJTgE';
const NEARBY_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const MIN_REVIEWS = 15;
const MAX_LIMIT = 20;
const MAX_SEARCH_ROUNDS = 7;
const DETAIL_CONCURRENCY = 6;

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

const FOOD_TYPES = new Set([
    'restaurant',
    'food',
    'meal_takeaway',
    'meal_delivery',
    'cafe',
    'bakery',
    'bar'
]);

const CITIES = [
    ['São Paulo', 'SP', -23.5505, -46.6333, 24000],
    ['Rio de Janeiro', 'RJ', -22.9068, -43.1729, 22000],
    ['Belo Horizonte', 'MG', -19.9167, -43.9345, 19000],
    ['Brasília', 'DF', -15.7939, -47.8828, 24000],
    ['Salvador', 'BA', -12.9777, -38.5016, 18000],
    ['Fortaleza', 'CE', -3.7319, -38.5267, 18000],
    ['Curitiba', 'PR', -25.4284, -49.2733, 19000],
    ['Recife', 'PE', -8.0476, -34.8770, 17000],
    ['Porto Alegre', 'RS', -30.0346, -51.2177, 19000],
    ['Manaus', 'AM', -3.1190, -60.0217, 20000],
    ['Belém', 'PA', -1.4558, -48.4902, 17000],
    ['Goiânia', 'GO', -16.6869, -49.2648, 19000],
    ['Campinas', 'SP', -22.9099, -47.0626, 18000],
    ['São Luís', 'MA', -2.5307, -44.3068, 17000],
    ['Maceió', 'AL', -9.6498, -35.7089, 16000],
    ['Campo Grande', 'MS', -20.4697, -54.6201, 19000],
    ['Natal', 'RN', -5.7945, -35.2110, 16000],
    ['Teresina', 'PI', -5.0919, -42.8034, 17000],
    ['João Pessoa', 'PB', -7.1195, -34.8450, 15000],
    ['São Bernardo do Campo', 'SP', -23.6914, -46.5646, 15000],
    ['Santo André', 'SP', -23.6639, -46.5383, 14000],
    ['Osasco', 'SP', -23.5325, -46.7917, 14000],
    ['Sorocaba', 'SP', -23.5015, -47.4526, 16000],
    ['Ribeirão Preto', 'SP', -21.1775, -47.8103, 16000],
    ['Uberlândia', 'MG', -18.9186, -48.2772, 17000],
    ['Contagem', 'MG', -19.9321, -44.0539, 14000],
    ['Aracaju', 'SE', -10.9472, -37.0731, 15000],
    ['Feira de Santana', 'BA', -12.2664, -38.9663, 16000],
    ['Cuiabá', 'MT', -15.6014, -56.0979, 17000],
    ['Joinville', 'SC', -26.3044, -48.8464, 16000],
    ['Londrina', 'PR', -23.3045, -51.1696, 16000],
    ['Juiz de Fora', 'MG', -21.7609, -43.3500, 15000],
    ['Niterói', 'RJ', -22.8859, -43.1153, 14000],
    ['Ananindeua', 'PA', -1.3656, -48.3722, 14000],
    ['Aparecida de Goiânia', 'GO', -16.8198, -49.2469, 15000],
    ['Porto Velho', 'RO', -8.7612, -63.9004, 17000],
    ['Serra', 'ES', -20.1288, -40.3074, 15000],
    ['Caxias do Sul', 'RS', -29.1634, -51.1797, 15000],
    ['Macapá', 'AP', 0.0349, -51.0694, 15000],
    ['Florianópolis', 'SC', -27.5949, -48.5482, 17000],
    ['Vila Velha', 'ES', -20.3297, -40.2925, 14000],
    ['Mauá', 'SP', -23.6677, -46.4613, 13000],
    ['São José dos Campos', 'SP', -23.2237, -45.9009, 16000],
    ['Mogi das Cruzes', 'SP', -23.5229, -46.1883, 15000],
    ['Betim', 'MG', -19.9673, -44.2011, 15000],
    ['Jundiaí', 'SP', -23.1857, -46.8978, 14000],
    ['Maringá', 'PR', -23.4205, -51.9333, 15000],
    ['Santos', 'SP', -23.9608, -46.3336, 14000],
    ['Piracicaba', 'SP', -22.7338, -47.6476, 15000],
    ['Blumenau', 'SC', -26.9194, -49.0661, 15000],
    ['Bauru', 'SP', -22.3145, -49.0587, 15000],
    ['Vitória', 'ES', -20.3155, -40.3128, 13000],
    ['Franca', 'SP', -20.5393, -47.4013, 15000],
    ['Ponta Grossa', 'PR', -25.0994, -50.1583, 15000],
    ['Canoas', 'RS', -29.9178, -51.1836, 14000],
    ['Pelotas', 'RS', -31.7654, -52.3376, 15000],
    ['Limeira', 'SP', -22.5649, -47.4017, 14000],
    ['Rio Claro', 'SP', -22.4100, -47.5600, 13000],
    ['Sumaré', 'SP', -22.8219, -47.2669, 14000],
    ['Americana', 'SP', -22.7370, -47.3330, 14000],
    ['São José do Rio Preto', 'SP', -20.8113, -49.3758, 15000],
    ['Uberaba', 'MG', -19.7472, -47.9392, 15000],
    ['Montes Claros', 'MG', -16.7286, -43.8582, 15000],
    ['Cascavel', 'PR', -24.9555, -53.4552, 15000],
    ['Foz do Iguaçu', 'PR', -25.5163, -54.5854, 15000],
    ['Itajaí', 'SC', -26.9101, -48.6705, 14000],
    ['Chapecó', 'SC', -27.1004, -52.6152, 15000]
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
    const latJitter = (Math.random() - 0.5) * 0.18;
    const lngJitter = (Math.random() - 0.5) * 0.18;
    return {
        lat: Number((lat + latJitter).toFixed(6)),
        lng: Number((lng + lngJitter).toFixed(6))
    };
}

function isFoodPlace(place) {
    const types = Array.isArray(place.types) ? place.types : [];
    return types.some(type => FOOD_TYPES.has(type));
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

async function googleJson(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
        throw new Error(`Google Places HTTP ${res.status}.`);
    }

    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
        throw new Error(data.error_message || `Google Places: ${data.status}.`);
    }

    return data;
}

async function fetchNearby(city, keyword) {
    const [name, state, , , radius] = city;
    const point = randomPoint(city);
    const params = new URLSearchParams({
        location: `${point.lat},${point.lng}`,
        radius: String(radius),
        keyword,
        key: GOOGLE_MAPS_API_KEY
    });
    const data = await googleJson(`${NEARBY_URL}?${params}`);

    return {
        city: name,
        state,
        keyword,
        results: Array.isArray(data.results) ? data.results : []
    };
}

async function fetchDetails(placeId) {
    const params = new URLSearchParams({
        place_id: placeId,
        fields: [
            'place_id',
            'name',
            'formatted_phone_number',
            'international_phone_number',
            'formatted_address',
            'website',
            'rating',
            'user_ratings_total',
            'types',
            'business_status',
            'url'
        ].join(','),
        key: GOOGLE_MAPS_API_KEY
    });
    const data = await googleJson(`${DETAILS_URL}?${params}`);
    return data.result || null;
}

async function mapWithConcurrency(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function run() {
        while (nextIndex < items.length) {
            const index = nextIndex;
            nextIndex += 1;
            try {
                results[index] = await worker(items[index]);
            } catch {
                results[index] = null;
            }
        }
    }

    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, () => run())
    );
    return results;
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
            const nearby = await fetchNearby(city, keyword);
            searches.push({ city: nearby.city, state: nearby.state, keyword });

            const remaining = limit - leads.length;
            const candidates = shuffle(nearby.results)
                .filter(place => {
                    if (!place?.place_id || seen.has(place.place_id)) return false;
                    if (place.business_status && place.business_status !== 'OPERATIONAL') return false;
                    if ((Number(place.user_ratings_total) || 0) < MIN_REVIEWS) return false;
                    return isFoodPlace(place);
                })
                .sort((a, b) => (Number(b.user_ratings_total) || 0) - (Number(a.user_ratings_total) || 0))
                .slice(0, Math.max(8, remaining * 3));

            candidates.forEach(place => seen.add(place.place_id));
            const detailsList = await mapWithConcurrency(
                candidates,
                DETAIL_CONCURRENCY,
                place => fetchDetails(place.place_id)
            );

            for (let i = 0; i < candidates.length && leads.length < limit; i += 1) {
                const place = candidates[i];
                const details = detailsList[i];
                if (!details) continue;

                const displayPhone =
                    details.international_phone_number ||
                    details.formatted_phone_number ||
                    '';
                const phoneDigits = normalizePhone(displayPhone);
                if (!phoneDigits || seenPhones.has(phoneDigits)) continue;

                const reviewsCount = Number(details.user_ratings_total ?? place.user_ratings_total) || 0;
                if (reviewsCount < MIN_REVIEWS) continue;

                seenPhones.add(phoneDigits);
                leads.push({
                    placeId: place.place_id,
                    name: details.name || place.name || 'Restaurante',
                    phone: displayPhone,
                    phoneDigits,
                    city: nearby.city,
                    state: nearby.state,
                    address: details.formatted_address || '',
                    categories: Array.isArray(details.types) ? details.types : (place.types || []),
                    rating: Number(details.rating ?? place.rating) || null,
                    reviewsCount,
                    website: details.website || '',
                    mapsUrl: details.url || ''
                });
            }
        }

        return response({
            leads,
            searches,
            minReviews: MIN_REVIEWS,
            requested: limit
        });
    } catch (error) {
        return response({ error: error?.message || String(error) }, 500);
    }
};
