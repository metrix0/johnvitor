exports.handler = async function() {
  const response = await fetch('https://johnvitor.com/.netlify/functions/ahgora-clock-background', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot: '12:15' })
  });

  if (!response.ok) console.error(`Ahgora 12:15 trigger failed: HTTP ${response.status}`);
  return { statusCode: 200 };
};
