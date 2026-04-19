import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const lat = searchParams.get('lat') || '32.08';
    const lon = searchParams.get('lon') || '34.78';

    // 1. Fetch Forecast from Open-Meteo
    // current_weather: true, hourly: temp + codes, daily: high/low + codes
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
    
    // 2. Fetch City Name from Nominatim (OpenStreetMap)
    const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;

    const [weatherRes, geocodeRes] = await Promise.all([
      fetch(weatherUrl, { next: { revalidate: 300 } }), // 5 min cache
      fetch(geocodeUrl, { 
        headers: { 
          'User-Agent': 'SOCMaster-System-Agent/1.0 (Cyber-Intelligence-Center)',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        next: { revalidate: 3600 } // City name changes less frequently
      })
    ]);

    if (!weatherRes.ok) throw new Error('Weather API failure');
    
    const weatherData = await weatherRes.json();
    const geocodeData = await geocodeRes.json().catch(() => ({}));

    // Extract city name safely with fallbacks
    const city = geocodeData.address?.city || 
                 geocodeData.address?.town || 
                 geocodeData.address?.village || 
                 geocodeData.address?.suburb || 
                 geocodeData.address?.municipality ||
                 'Unknown Sector';

    return NextResponse.json({
      city,
      current: weatherData.current_weather,
      hourly: weatherData.hourly,
      daily: weatherData.daily
    });
  } catch (error) {
    console.error('Weather Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch environmental data' }, { status: 500 });
  }
}
