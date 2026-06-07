import { useState, useEffect, FormEvent } from 'react';
import { Cloud, Sun, CloudRain, Snowflake, Settings, ArrowLeft, RefreshCw, Sparkles, Calendar } from 'lucide-react';

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="w-10 h-10 stroke-1" />;
  if (code > 0 && code < 50) return <Cloud className="w-10 h-10 stroke-1" />;
  if (code >= 50 && code < 70) return <CloudRain className="w-10 h-10 stroke-1 text-blue-400" />;
  if (code >= 70 && code < 80) return <Snowflake className="w-10 h-10 stroke-1 text-blue-200" />;
  if (code >= 80 && code < 95) return <CloudRain className="w-10 h-10 stroke-1 text-blue-400" />;
  if (code >= 95) return <CloudRain className="w-10 h-10 stroke-1 text-blue-500 animate-pulse" />;
  return <Cloud className="w-10 h-10 stroke-1" />;
}

const API_BASE_URL = 'http://localhost:3000';

interface CalendarEvent {
  id: number;
  name: string;
  date: string;
  end_date?: string | null;
  description?: string | null;
}

interface FontSetting {
  id: number;
  name: string;
  weight: string;
  probability: number;
}

interface AnniversaryData {
  today: Array<{ name: string; date: string; description: string; years: number }>;
  upcoming: Array<{ name: string; date: string; description: string; daysLeft: number }>;
  recent: Array<{ name: string; date: string; description: string; daysAgo: number }>;
}

export default function App() {
  const [activePage, setActivePage] = useState<'home' | 'inspiration'>('home');
  const [time, setTime] = useState(new Date());
  
  // Standard widget state
  const [weather, setWeather] = useState<{ current: { temp: number; code: number } } | null>(null);
  const [wotd, setWotd] = useState<{ dictionary: string; merriam: string; oxford: string; wiktionary: string } | null>(null);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [activeFont, setActiveFont] = useState<string>('Inter');
  const [showEventList, setShowEventList] = useState(false);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [newEvent, setNewEvent] = useState({ name: '', date: '', end_date: '', description: '' });

  // Staging features state
  const [anniversaries, setAnniversaries] = useState<AnniversaryData | null>(null);
  const [fontsList, setFontsList] = useState<FontSetting[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  
  // Daily Feed states
  const [wikipedia, setWikipedia] = useState<{ title: string; extract: string; url: string } | null>(null);
  const [poem, setPoem] = useState<{ title: string; author: string; lines: string[] } | null>(null);
  const [colorOfDay, setColorOfDay] = useState<{ name: string; hex: string; desc: string } | null>(null);
  const [fontOfDay, setFontOfDay] = useState<string>('Inter');
  const [museumArt, setMuseumArt] = useState<{ title: string; artist: string; year: string; imageUrl: string; wikidataUrl: string } | null>(null);
  const [selectedMuseum, setSelectedMuseum] = useState<string>('moma');
  const [loadingMuseum, setLoadingMuseum] = useState(false);

  // Time effect
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial data loading
  useEffect(() => {
    // 1. Fetch weather
    fetch('https://api.open-meteo.com/v1/forecast?latitude=37.7811&longitude=-122.4883&current_weather=true&temperature_unit=fahrenheit')
      .then(res => res.json())
      .then(data => {
        if (data.current_weather) {
          setWeather({
            current: {
              temp: Math.round(data.current_weather.temperature),
              code: data.current_weather.weathercode
            }
          });
        }
      }).catch(err => console.error("Weather load failed", err));

    // 2. Fetch Words of the Day
    fetch(`${API_BASE_URL}/api/wotd`)
      .then(res => res.json())
      .then(data => setWotd(data))
      .catch(err => console.error("WOTD load failed", err));

    // 3. Fetch Calendar Event list & Next Event
    fetchEvents();

    // 4. Fetch Anniversaries
    fetch(`${API_BASE_URL}/api/anniversaries`)
      .then(res => res.json())
      .then(data => setAnniversaries(data))
      .catch(err => console.error("Anniversaries load failed", err));

    // 5. Fetch Fonts and weight probabilities
    fetchFonts();
  }, []);

  // Fetch daily feeds when inspiration page becomes active
  useEffect(() => {
    if (activePage !== 'inspiration') return;

    // Fetch Wikipedia TFA
    fetch(`${API_BASE_URL}/api/feeds/wikipedia`)
      .then(res => res.json())
      .then(data => setWikipedia(data))
      .catch(e => console.error(e));

    // Fetch Poem of the Day
    fetch(`${API_BASE_URL}/api/feeds/poem`)
      .then(res => res.json())
      .then(data => setPoem(data))
      .catch(e => console.error(e));

    // Fetch Color of the Day
    fetch(`${API_BASE_URL}/api/feeds/color`)
      .then(res => res.json())
      .then(data => setColorOfDay(data))
      .catch(e => console.error(e));

    // Fetch Font of the Day
    fetch(`${API_BASE_URL}/api/feeds/font`)
      .then(res => res.json())
      .then(data => setFontOfDay(data.name))
      .catch(e => console.error(e));

    // Fetch Museum Artwork
    loadMuseumArt(selectedMuseum);
  }, [activePage]);

  const fetchEvents = () => {
    fetch(`${API_BASE_URL}/api/all-events`)
      .then(res => res.json())
      .then(data => setAllEvents(data))
      .catch(err => console.error(err));

    fetch(`${API_BASE_URL}/api/next-event`)
      .then(res => res.json())
      .then(data => setNextEvent(data))
      .catch(err => console.error(err));
  };

  const fetchFonts = () => {
    fetch(`${API_BASE_URL}/api/fonts`)
      .then(res => res.json())
      .then(data => {
        setFontsList(data);
        // Date-seeded random font selection weighted by database probabilities
        if (data.length > 0) {
          const totalWeight = data.reduce((sum: number, f: FontSetting) => sum + f.probability, 0);
          if (totalWeight > 0) {
            let threshold = (new Date().getDate() * 17) % totalWeight;
            let selected = data[0].name;
            for (const f of data) {
              threshold -= f.probability;
              if (threshold <= 0) {
                selected = f.name;
                break;
              }
            }
            setActiveFont(selected);
          }
        }
      })
      .catch(err => console.error(err));
  };

  const loadMuseumArt = (museum: string) => {
    setLoadingMuseum(true);
    fetch(`${API_BASE_URL}/api/museum-art?museum=${museum}`)
      .then(res => res.json())
      .then(data => {
        setMuseumArt(data);
        setLoadingMuseum(false);
      })
      .catch(e => {
        console.error(e);
        setLoadingMuseum(false);
      });
  };

  const handleUpdateProbability = (id: number, val: number) => {
    setFontsList(prev => prev.map(f => f.id === id ? { ...f, probability: val } : f));
  };

  const saveFontProbabilities = () => {
    fetch(`${API_BASE_URL}/api/update-font-probability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fonts: fontsList })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          alert("Font probabilities updated successfully!");
          fetchFonts();
        }
      })
      .catch(e => console.error("Save probabilities failed", e));
  };

  const handleAddEvent = (e: FormEvent) => {
    e.preventDefault();
    fetch(`${API_BASE_URL}/api/add-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEvent)
    })
      .then(() => {
        setIsAddingEvent(false);
        setNewEvent({ name: '', date: '', end_date: '', description: '' });
        fetchEvents();
      });
  };

  const handleUpdateEvent = (e: FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    fetch(`${API_BASE_URL}/api/update-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingEvent)
    })
      .then(() => {
        setEditingEvent(null);
        fetchEvents();
      });
  };

  // Dynamically inject Google Fonts link if needed
  useEffect(() => {
    if (!activeFont) return;
    const fontId = 'gfont-link';
    let link = document.getElementById(fontId) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${activeFont.replace(/\s+/g, '+')}:wght@300;400;700&display=swap`;
    document.body.style.fontFamily = `"${activeFont}", sans-serif`;
  }, [activeFont]);

  // Load font of the day stylesheet preview
  useEffect(() => {
    if (!fontOfDay) return;
    const fontId = 'gfont-fod-link';
    let link = document.getElementById(fontId) as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.id = fontId;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
    link.href = `https://fonts.googleapis.com/css2?family=${fontOfDay.replace(/\s+/g, '+')}:wght@400;700&display=swap`;
  }, [fontOfDay]);

  return (
    <div className="min-h-screen bg-[#fafaf9] text-[#1c1917] p-8 md:p-16 transition-all duration-300">
      
      {/* 1. Header Bar */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
          <h1 className="text-xl font-bold tracking-tight text-stone-700">JeffWM Widget</h1>
        </div>
        <div className="flex gap-4">
          {activePage === 'home' ? (
            <button
              onClick={() => setActivePage('inspiration')}
              className="px-4 py-2 bg-stone-900 text-stone-100 rounded-md hover:bg-stone-800 transition text-sm font-medium flex items-center gap-2"
            >
              Inspiration Hub
            </button>
          ) : (
            <button
              onClick={() => setActivePage('home')}
              className="px-4 py-2 border border-stone-300 rounded-md hover:bg-stone-100 transition text-sm font-medium flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back Home
            </button>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 border border-stone-300 rounded-md hover:bg-stone-100 transition"
            title="Typeface Settings"
          >
            <Settings className="w-5 h-5 text-stone-600" />
          </button>
        </div>
      </header>

      {/* 2. Celebration Banner for Anniversaries */}
      {anniversaries?.today && anniversaries.today.length > 0 && (
        <section className="max-w-6xl mx-auto mb-10">
          {anniversaries.today.map((ann, idx) => (
            <div key={idx} className="relative overflow-hidden p-6 rounded-lg bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse-border">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-500 rounded-full text-white">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-900">🎉 Today is the {ann.years} Year Anniversary of {ann.name}!</h3>
                  <p className="text-stone-700 text-sm mt-1">{ann.description || "Celebrating this milestone today."}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 3. Main Views */}
      <main className="max-w-6xl mx-auto">
        {activePage === 'home' ? (
          
          /* ================= HOME PAGE (Original Minimalist) ================= */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
            
            {/* Clock & Weather Column */}
            <div className="lg:col-span-2 space-y-12">
              <div className="space-y-2">
                <div className="text-7xl font-light tracking-tighter tabular-nums text-stone-800">
                  {time.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
                <div className="text-lg text-stone-500 font-medium">
                  {time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              {/* Weather Info */}
              {weather ? (
                <div className="flex items-center gap-4 p-4 rounded-lg bg-stone-100/50 max-w-sm border border-stone-200">
                  {getWeatherIcon(weather.current.code)}
                  <div>
                    <div className="text-3xl font-semibold text-stone-800">{weather.current.temp}°F</div>
                    <div className="text-xs text-stone-500">San Francisco, CA</div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-stone-400">Loading weather...</div>
              )}

              {/* Word of the Day Links */}
              {wotd ? (
                <div className="space-y-4 max-w-md pt-4">
                  <h3 className="text-sm font-semibold tracking-wider text-stone-400 uppercase">Words Of The Day</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <a href="https://www.dictionary.com/browse/daily" target="_blank" rel="noreferrer" className="p-3 border rounded hover:bg-stone-50 transition border-stone-200">
                      <div className="text-xs text-stone-400 font-bold">Dictionary.com</div>
                      <div className="text-base font-semibold text-amber-700">{wotd.dictionary}</div>
                    </a>
                    <a href="https://www.merriam-webster.com/word-of-the-day" target="_blank" rel="noreferrer" className="p-3 border rounded hover:bg-stone-50 transition border-stone-200">
                      <div className="text-xs text-stone-400 font-bold">Merriam-Webster</div>
                      <div className="text-base font-semibold text-amber-700">{wotd.merriam}</div>
                    </a>
                    <a href="https://www.oxfordlearnersdictionaries.com" target="_blank" rel="noreferrer" className="p-3 border rounded hover:bg-stone-50 transition border-stone-200">
                      <div className="text-xs text-stone-400 font-bold">Oxford Learners</div>
                      <div className="text-base font-semibold text-amber-700">{wotd.oxford}</div>
                    </a>
                    <div className="p-3 border rounded border-stone-200 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-stone-400 font-bold">Wiktionary</div>
                        <a href="https://en.wiktionary.org/wiki/Wiktionary:Word_of_the_day" target="_blank" rel="noreferrer" className="text-base font-semibold text-amber-700 block hover:underline">
                          {wotd.wiktionary}
                        </a>
                      </div>
                      {/* Secondary Inspiration Trigger */}
                      <button
                        onClick={() => setActivePage('inspiration')}
                        className="text-[10px] text-amber-500 font-semibold hover:underline text-left mt-2 block tracking-wider uppercase"
                      >
                        Of-The-Day Links
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-stone-400">Loading daily dictionary feeds...</div>
              )}
            </div>

            {/* Calendar Events Column */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-stone-200 pb-2">
                <h3 className="text-base font-bold text-stone-700 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" /> Calendar
                </h3>
                <button
                  onClick={() => setShowEventList(!showEventList)}
                  className="text-xs text-stone-500 hover:text-stone-800 underline"
                >
                  {showEventList ? "Hide List" : "Show All"}
                </button>
              </div>

              {nextEvent ? (
                <div className="p-4 border rounded bg-amber-50/30 border-amber-200/50">
                  <span className="text-[10px] bg-amber-500/10 text-amber-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Next Event</span>
                  <h4 className="text-lg font-bold text-stone-800 mt-2">{nextEvent.name}</h4>
                  <p className="text-xs text-stone-500 mt-1">
                    {new Date(nextEvent.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    {nextEvent.end_date && ` - ${new Date(nextEvent.end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                  </p>
                  {nextEvent.description && (
                    <p className="text-sm text-stone-600 mt-2 italic border-t border-stone-200/50 pt-2">{nextEvent.description}</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-stone-400">No events found.</p>
              )}

              {showEventList && (
                <div className="space-y-3 max-h-60 overflow-y-auto border border-stone-200 rounded p-3 bg-white">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-stone-500">Event Schedule</span>
                    <button
                      onClick={() => setIsAddingEvent(true)}
                      className="text-xs bg-stone-900 text-stone-100 px-2 py-0.5 rounded hover:bg-stone-800"
                    >
                      + Add
                    </button>
                  </div>
                  {allEvents.map(ev => (
                    <div key={ev.id} className="p-2 hover:bg-stone-50 rounded flex justify-between items-center text-sm border-b border-stone-100 last:border-b-0">
                      <div>
                        <div className="font-semibold text-stone-800">{ev.name}</div>
                        <div className="text-[10px] text-stone-400">
                          {new Date(ev.date).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => setEditingEvent(ev)}
                        className="text-xs text-amber-600 hover:underline"
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          
          /* ================= INSPIRATION HUB ================= */
          <div className="space-y-12">
            <div className="border-b border-stone-200 pb-4">
              <h2 className="text-3xl font-light tracking-tight">Daily Inspiration Hub</h2>
              <p className="text-sm text-stone-500 mt-1">A curated compilation of daily knowledge, poetry, and worldwide museum exhibits.</p>
            </div>

            {/* Inspiration Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              
              {/* 1. Wikipedia Featured Article */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between">
                <div>
                  <div className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-2">Featured Wikipedia Article</div>
                  {wikipedia ? (
                    <>
                      <h4 className="text-lg font-bold text-stone-800 mb-2">{wikipedia.title}</h4>
                      <p className="text-sm text-stone-600 leading-relaxed line-clamp-6">{wikipedia.extract}</p>
                    </>
                  ) : (
                    <div className="text-sm text-stone-400">Loading featured article...</div>
                  )}
                </div>
                {wikipedia && (
                  <a href={wikipedia.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-amber-700 hover:underline mt-4 block">
                    Read entire article on Wikipedia &rarr;
                  </a>
                )}
              </div>

              {/* 2. Poem of the Day */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between lg:col-span-2">
                <div>
                  <div className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-2">Poetry Collection</div>
                  {poem ? (
                    <>
                      <h4 className="text-lg font-bold text-stone-800">{poem.title}</h4>
                      <p className="text-xs text-stone-400 font-medium mb-4">By {poem.author}</p>
                      <div className="text-sm text-stone-600 italic leading-relaxed max-h-56 overflow-y-auto whitespace-pre-line border-t border-stone-100 pt-3 pr-2 font-serif">
                        {poem.lines.slice(0, 18).join('\n')}
                        {poem.lines.length > 18 && '\n...'}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-stone-400">Loading daily poem...</div>
                  )}
                </div>
                {poem && (
                  <span className="text-[10px] text-stone-400 italic mt-4">Retrieved via PoetryDB Daily Feed</span>
                )}
              </div>

              {/* 3. Museum Collection SPARQL client */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between md:col-span-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] tracking-wider text-amber-600 font-bold uppercase">Museum Masterpieces</span>
                    <select
                      value={selectedMuseum}
                      onChange={(e) => {
                        setSelectedMuseum(e.target.value);
                        loadMuseumArt(e.target.value);
                      }}
                      className="text-xs border border-stone-300 rounded px-2 py-1 bg-white text-stone-700"
                    >
                      <option value="moma">MoMA (NY)</option>
                      <option value="louvre">Musée du Louvre (Paris)</option>
                      <option value="met">Metropolitan Museum of Art (NY)</option>
                      <option value="sfmoma">SFMOMA (San Francisco)</option>
                      <option value="lacma">LACMA (Los Angeles)</option>
                      <option value="tate">Tate Gallery (London)</option>
                      <option value="whitney">Whitney Museum</option>
                    </select>
                  </div>

                  {loadingMuseum ? (
                    <div className="text-sm text-stone-400 flex items-center gap-2 justify-center py-10">
                      <RefreshCw className="w-4 h-4 animate-spin text-stone-500" /> Fetching artwork via Wikidata SPARQL...
                    </div>
                  ) : museumArt ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {museumArt.imageUrl && (
                        <div className="h-44 rounded overflow-hidden bg-stone-100 flex items-center justify-center border border-stone-200">
                          <img src={museumArt.imageUrl} alt={museumArt.title} className="max-h-full max-w-full object-contain" />
                        </div>
                      )}
                      <div className="flex flex-col justify-between">
                        <div>
                          <h4 className="text-base font-bold text-stone-800 leading-tight">{museumArt.title}</h4>
                          <p className="text-xs text-stone-500 mt-1">Artist: {museumArt.artist}</p>
                          {museumArt.year && <p className="text-xs text-stone-400">Created: {museumArt.year}</p>}
                        </div>
                        {museumArt.wikidataUrl && (
                          <a href={museumArt.wikidataUrl} target="_blank" rel="noreferrer" className="text-[10px] text-amber-700 hover:underline font-bold mt-3 block">
                            Explore on Wikidata &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400 py-10 text-center">No artwork loaded.</div>
                  )}
                </div>
              </div>

              {/* 4. Color of the Day */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between">
                <div>
                  <div className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-2">Color Of The Day</div>
                  {colorOfDay ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg border border-stone-200 shadow-sm" style={{ backgroundColor: colorOfDay.hex }}></div>
                        <div>
                          <h4 className="text-base font-bold text-stone-800">{colorOfDay.name}</h4>
                          <code className="text-xs text-stone-400 font-mono">{colorOfDay.hex}</code>
                        </div>
                      </div>
                      <p className="text-sm text-stone-600 leading-relaxed">{colorOfDay.desc}</p>
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400">Loading daily color...</div>
                  )}
                </div>
              </div>

              {/* 5. Font of the Day */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between">
                <div>
                  <div className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-2">Font Of The Day</div>
                  <div className="space-y-4">
                    <div className="text-stone-400 text-xs">Typeface preview: <strong className="text-stone-700 font-normal">{fontOfDay}</strong></div>
                    <div className="p-4 rounded border border-stone-100 bg-stone-50/50 flex flex-col gap-2">
                      <div style={{ fontFamily: `"${fontOfDay}", sans-serif` }} className="text-3xl tracking-tight leading-none text-stone-800">
                        Sphinx of black quartz, judge my vow.
                      </div>
                      <div style={{ fontFamily: `"${fontOfDay}", sans-serif` }} className="text-xs text-stone-400">
                        Aa Bb Cc Dd Ee Ff Gg 12345
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-stone-400 italic">Date-seeded selection from your collections</span>
              </div>

              {/* 6. Upcoming Anniversaries Column */}
              <div className="p-6 border border-stone-200 rounded-lg bg-white flex flex-col justify-between">
                <div>
                  <div className="text-[10px] tracking-wider text-amber-600 font-bold uppercase mb-4">Anniversary Timeline</div>
                  {anniversaries ? (
                    <div className="space-y-4">
                      {anniversaries.upcoming.length === 0 && anniversaries.recent.length === 0 ? (
                        <p className="text-sm text-stone-400 italic">No upcoming or recent anniversaries this week.</p>
                      ) : (
                        <>
                          {anniversaries.upcoming.map((ann, i) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-stone-50 pb-2">
                              <div>
                                <div className="font-semibold text-stone-800">{ann.name}</div>
                                <div className="text-[10px] text-stone-400">{new Date(ann.date).toLocaleDateString()}</div>
                              </div>
                              <span className="text-xs bg-amber-500/10 text-amber-700 font-bold px-2 py-0.5 rounded-full">In {ann.daysLeft} days</span>
                            </div>
                          ))}
                          {anniversaries.recent.map((ann, i) => (
                            <div key={i} className="flex justify-between items-center text-sm border-b border-stone-50 pb-2">
                              <div>
                                <div className="font-semibold text-stone-800">{ann.name}</div>
                                <div className="text-[10px] text-stone-400">{new Date(ann.date).toLocaleDateString()}</div>
                              </div>
                              <span className="text-xs bg-stone-100 text-stone-500 font-semibold px-2 py-0.5 rounded-full">{ann.daysAgo} days ago</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-stone-400">Loading anniversaries...</div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* 4. Typeface Settings Slide-out Drawer */}
      {showSettings && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white shadow-2xl border-l border-stone-200 p-6 z-50 overflow-y-auto transform transition-transform duration-300">
          <div className="flex justify-between items-center border-b border-stone-200 pb-3 mb-6">
            <h3 className="font-bold text-stone-800 flex items-center gap-2">
              <Settings className="w-5 h-5" /> Typeface Probability
            </h3>
            <button onClick={() => setShowSettings(false)} className="text-xs font-semibold text-stone-500 hover:text-stone-800">Close</button>
          </div>
          <p className="text-xs text-stone-500 mb-6">
            Configure the selection probabilities for random background font generation. Setting a probability to 0.0 disables the font.
          </p>
          <div className="space-y-6">
            {fontsList.map(font => (
              <div key={font.id} className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-stone-800" style={{ fontFamily: `"${font.name}", sans-serif` }}>{font.name}</span>
                  <span className="text-xs font-mono text-amber-600 bg-amber-50 px-2 py-0.5 rounded">{font.probability.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="10.0"
                  step="0.5"
                  value={font.probability}
                  onChange={(e) => handleUpdateProbability(font.id, parseFloat(e.target.value))}
                  className="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
                />
              </div>
            ))}
          </div>
          <button
            onClick={saveFontProbabilities}
            className="w-full mt-8 py-2 bg-stone-900 text-stone-100 rounded hover:bg-stone-800 transition text-sm font-medium"
          >
            Save Probabilities
          </button>
        </div>
      )}

      {/* 5. Modals for Adding / Editing Events */}
      {isAddingEvent && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <form onSubmit={handleAddEvent} className="bg-white rounded-lg border border-stone-200 p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-stone-800">Add Calendar Event</h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Event Name</label>
              <input required type="text" value={newEvent.name} onChange={e => setNewEvent({...newEvent, name: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Start Date</label>
              <input required type="date" value={newEvent.date} onChange={e => setNewEvent({...newEvent, date: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">End Date (Optional)</label>
              <input type="date" value={newEvent.end_date} onChange={e => setNewEvent({...newEvent, end_date: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Description / Significance</label>
              <textarea value={newEvent.description} onChange={e => setNewEvent({...newEvent, description: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white h-20" placeholder="Optional detail or anniversary notes..." />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setIsAddingEvent(false)} className="px-4 py-2 border rounded text-sm hover:bg-stone-50">Cancel</button>
              <button type="submit" className="px-4 py-2 bg-stone-900 text-stone-100 rounded text-sm hover:bg-stone-800">Save</button>
            </div>
          </form>
        </div>
      )}

      {editingEvent && (
        <div className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm flex items-center justify-center p-4 z-40">
          <form onSubmit={handleUpdateEvent} className="bg-white rounded-lg border border-stone-200 p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-stone-800">Edit Event</h3>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Event Name</label>
              <input required type="text" value={editingEvent.name} onChange={e => setEditingEvent({...editingEvent, name: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Start Date</label>
              <input required type="date" value={editingEvent.date.substring(0, 10)} onChange={e => setEditingEvent({...editingEvent, date: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">End Date (Optional)</label>
              <input type="date" value={editingEvent.end_date ? editingEvent.end_date.substring(0, 10) : ''} onChange={e => setEditingEvent({...editingEvent, end_date: e.target.value || null})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-stone-500 uppercase">Description / Significance</label>
              <textarea value={editingEvent.description || ''} onChange={e => setEditingEvent({...editingEvent, description: e.target.value})} className="w-full border border-stone-300 rounded p-2 text-sm bg-white h-20" placeholder="Optional detail or anniversary notes..." />
            </div>
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm("Are you sure you want to delete this event?")) {
                    fetch(`${API_BASE_URL}/api/delete-event?id=${editingEvent.id}`, { method: 'POST' })
                      .then(() => {
                        setEditingEvent(null);
                        fetchEvents();
                      });
                  }
                }}
                className="text-xs text-red-600 hover:underline"
              >
                Delete Event
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => setEditingEvent(null)} className="px-4 py-2 border rounded text-sm hover:bg-stone-50">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-stone-900 text-stone-100 rounded text-sm hover:bg-stone-800">Save</button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}