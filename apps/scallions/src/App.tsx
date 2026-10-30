import { useEffect, useMemo, useState } from 'react'
import {
  SeasonItem,
  formatDateRange,
  formatNextSeasonRange,
  getCurrentMoonPhaseItem,
  getHolidayDayRelativeStatus,
  isItemComingSoon,
  isItemEndingSoon,
  isItemInSeason,
  isSingleDayHoliday,
  seasonItems,
} from './data/seasonItems'
import { loadGoogleFonts, widgetFonts } from './data/widgetFonts'

const ALL_MOON_IDS = [
  'moon-new-moon',
  'moon-waxing-crescent',
  'moon-first-quarter',
  'moon-waxing-gibbous',
  'moon-full-moon',
  'moon-waning-gibbous',
  'moon-third-quarter',
  'moon-waning-crescent',
]

function getRandomFontMap(items: SeasonItem[], pool: string[]): Record<string, string> {
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  const mapping: Record<string, string> = {}
  items.forEach((item, index) => {
    mapping[item.id] = shuffled[index % shuffled.length]
  })
  ALL_MOON_IDS.forEach((moonId, index) => {
    mapping[moonId] = shuffled[(items.length + index) % shuffled.length]
  })
  mapping['jefferson-williams'] = shuffled[(items.length + ALL_MOON_IDS.length) % shuffled.length] || pool[0]
  return mapping
}

const apiBaseUrl = (
  import.meta.env.VITE_SCALLIONS_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://api-scallions.jeffersonwm.com' : '')
).replace(/\/$/, '')

export function App() {
  const [items, setItems] = useState<SeasonItem[]>(seasonItems)
  const [selectedItem, setSelectedItem] = useState<SeasonItem | null>(null)
  const [showCreditPopup, setShowCreditPopup] = useState(false)
  const [, setFontPool] = useState<string[]>(widgetFonts)

  // Random font assignment on load
  const [itemFonts, setItemFonts] = useState<Record<string, string>>(() => getRandomFontMap(seasonItems, widgetFonts))

  // Fetch fonts and items from backend if available
  useEffect(() => {
    let cancelled = false

    async function loadData() {
      try {
        const [fontsRes, itemsRes] = await Promise.allSettled([
          fetch(`${apiBaseUrl}/api/fonts`),
          fetch(`${apiBaseUrl}/api/items`),
        ])

        let activeFonts = widgetFonts
        if (fontsRes.status === 'fulfilled' && fontsRes.value.ok) {
          const fontData = await fontsRes.value.json()
          if (fontData.ok && Array.isArray(fontData.fonts) && fontData.fonts.length > 0) {
            activeFonts = fontData.fonts
            if (!cancelled) {
              setFontPool(activeFonts)
            }
          }
        }

        let activeItems = seasonItems
        if (itemsRes.status === 'fulfilled' && itemsRes.value.ok) {
          const itemData = await itemsRes.value.json()
          if (itemData.ok && Array.isArray(itemData.items) && itemData.items.length > 0) {
            activeItems = itemData.items
            if (!cancelled) {
              setItems(activeItems)
            }
          }
        }

        if (!cancelled && (activeFonts !== widgetFonts || activeItems !== seasonItems)) {
          setItemFonts(getRandomFontMap(activeItems, activeFonts))
        }
      } catch (err) {
        // Fall back gracefully to built-in datasets
        console.warn('Could not load data from API, using fallback data:', err)
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [])

  const displayedItems = useMemo(() => {
    const today = new Date()
    const active: (SeasonItem | { id: string; name: string })[] = items.filter((item) => {
      if (isSingleDayHoliday(item)) {
        return getHolidayDayRelativeStatus(item, today) !== null
      }
      return isItemInSeason(item, today) || isItemComingSoon(item, today)
    })
    const currentMoon = getCurrentMoonPhaseItem(today)
    if (!active.some((item) => item.id === currentMoon.id)) {
      active.push(currentMoon)
    }
    return [...active, { id: 'jefferson-williams', name: 'Jefferson Williams' }].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [items])

  // Load the assigned Google Fonts
  useEffect(() => {
    const fontsToLoad = Object.values(itemFonts)
    loadGoogleFonts([...fontsToLoad, 'Young Serif'])
  }, [itemFonts])

  // Dismiss popup on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null)
        setShowCreditPopup(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className="page-shell">
      <ul className="season-list" aria-label="Items in season">
        {displayedItems.map((item) => {
          if (item.id === 'jefferson-williams') {
            return (
              <li key={item.id} className="season-list-item">
                <button
                  type="button"
                  className="season-item-button jefferson-williams-button"
                  style={{ fontFamily: '"Young Serif", Georgia, serif' }}
                  onClick={() => {
                    setSelectedItem(null)
                    setShowCreditPopup(true)
                  }}
                >
                  {item.name}
                </button>
              </li>
            )
          }

          const seasonItem = item as SeasonItem
          const font = itemFonts[seasonItem.id]
          const holidayStatus = getHolidayDayRelativeStatus(seasonItem)
          const endingSoon = !holidayStatus && isItemEndingSoon(seasonItem)
          const comingSoon = !holidayStatus && isItemComingSoon(seasonItem)
          return (
            <li key={seasonItem.id} className="season-list-item">
              <button
                type="button"
                className="season-item-button"
                style={font ? { fontFamily: `"${font}", system-ui, sans-serif` } : undefined}
                onClick={() => {
                  setShowCreditPopup(false)
                  setSelectedItem(seasonItem)
                }}
              >
                {seasonItem.name}
                {holidayStatus === 'tomorrow' ? <span className="season-coming-tag"> (Tomorrow)</span> : null}
                {holidayStatus === 'yesterday' ? <span className="season-ending-tag"> (Yesterday)</span> : null}
                {endingSoon ? <span className="season-ending-tag"> (Ending Soon)</span> : null}
                {comingSoon ? <span className="season-coming-tag"> (Coming Soon)</span> : null}
              </button>
            </li>
          )
        })}
      </ul>

      {selectedItem ? (
        <div
          className="popup-backdrop"
          onClick={() => setSelectedItem(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="date-popup" onClick={() => setSelectedItem(null)}>
            <div className="popup-title">{selectedItem.name}</div>
            <div className="popup-dates">{formatDateRange(selectedItem)}</div>
          </div>
        </div>
      ) : null}

      {showCreditPopup ? (
        <div
          className="popup-backdrop"
          onClick={() => setShowCreditPopup(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="date-popup credit-popup"
            onClick={(e) => {
              if ((e.target as HTMLElement).tagName !== 'A') {
                setShowCreditPopup(false)
              }
            }}
          >
            <span className="popup-dates credit-popup-content">
              &copy; 2026{' '}
              <a
                href="https://jeffersonwm.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Jefferson Williams
              </a>
              . All rights reserved.{' '}
              <a
                href="https://github.com/users/wmjefferson/projects/4"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              .
            </span>
          </div>
        </div>
      ) : null}

      <nav className="link-banner" aria-label="Page links" />
    </main>
  )
}
