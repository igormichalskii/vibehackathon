# GEO DATA — Dokumentacja plików CSV
## MRO Prediction Platform — LOTAMS Hackathon

Zestaw 4 plików CSV generowanych syntetycznie na podstawie realnych danych flotowych
(`europe_fleet.csv`, `predictions_raw.csv`). Służą do zasilenia zakładki **Radar**
w dashboardzie — mapy geopolitycznej z zamkniętymi strefami powietrznymi, zmienionymi
trasami lotów i ich wpływem na harmonogram C-checków.

---

## Pliki i ich zawartość

### 1. `geo_airspaces.csv` — Zamknięte strefy powietrzne
**Po co:** Polygony wyświetlane na mapie jako kolorowe strefy (czerwone = zamknięte, żółte = ograniczone).

| Kolumna | Typ | Opis |
|---|---|---|
| `airspace_id` | string | Unikalny ID strefy (AS001–AS004) |
| `name` | string | Nazwa FIR / kraju |
| `status` | string | `closed` lub `restricted` |
| `reason` | string | Powód zamknięcia |
| `closed_since` | date | Data zamknięcia (YYYY-MM-DD) |
| `closed_until` | string | Data końca lub `indefinite` |
| `notam_ref` | string | Numer referencyjny NOTAM |
| `severity` | string | `critical` (czerwony) lub `warning` (żółty) |
| `affected_operators` | string | Operatorzy z floty których dotyczy (rozdzielone przecinkami) |
| `bbox_north/south/west/east` | float | Bounding box strefy w stopniach (do rysowania prostokąta na mapie) |
| `color` | string | Kolor HEX do wyświetlenia na mapie |

**Strefy w danych:**
- AS001 — Rosja (zamknięta od 24.02.2022, dotyczy Norwegian/KLM/Lufthansa)
- AS002 — Ukraina (zamknięta od 24.02.2022, dotyczy LOT/Enter Air/Smartwings)
- AS003 — Białoruś (zamknięta od 27.05.2021, dotyczy Ryanair/LOT)
- AS004 — Iran (ograniczona od 15.04.2024, dotyczy SunExpress/Corendon/TUI fly)

---

### 2. `geo_routes.csv` — Zmienione trasy lotów
**Po co:** Łuki wyświetlane na mapie pokazujące starą (szarą przerywaną) i nową (niebieską) trasę. Tylko trasy które faktycznie się zmieniły przez zamknięcie stref.

| Kolumna | Typ | Opis |
|---|---|---|
| `route_id` | string | Unikalny ID trasy (RT001–RT012) |
| `operator` | string | Linia lotnicza — musi pasować do `europe_fleet.csv` |
| `origin_icao` | string | ICAO lotniska startowego |
| `origin_name` | string | Nazwa lotniska startowego |
| `dest_icao` | string | ICAO lotniska docelowego |
| `dest_name` | string | Nazwa lotniska docelowego |
| `airspace_affected` | string | ID strefy z `geo_airspaces.csv` która wymusiła zmianę |
| `old_flight_hours` | float | Czas lotu przed zmianą trasy [h] |
| `new_flight_hours` | float | Czas lotu po zmianie trasy [h] |
| `delta_fh_per_flight` | float | Różnica czasu per lot [h] |
| `frequency_weekly` | int | Częstotliwość lotów na tej trasie [loty/tydz] |
| `extra_fh_monthly` | float | Dodatkowe godziny nalotu miesięcznie przez zmianę trasy [FH/mies] |
| `old_route_desc` | string | Opis starej trasy (przez jakie FIR) |
| `new_route_desc` | string | Opis nowej trasy (przez jakie FIR) |
| `ccheck_acceleration_days` | int | O ile dni wcześniej nastąpi C-check przez dodatkowe FH |
| `active_since` | date | Od kiedy obowiązuje zmieniona trasa |

**Logika obliczenia przyspieszenia C-check:**
```
extra_fh_monthly = delta_fh_per_flight × frequency_weekly × 4.3
extra_fh_yearly  = extra_fh_monthly × 12
ccheck_acceleration_days = (extra_fh_yearly / 4500) × 365
```
Próg C-check przyjęty jako 4500 FH (standard Boeing 737).

---

### 3. `geo_airports.csv` — Obciążenie lotnisk
**Po co:** Koła na mapie przy lotniskach. Kolor i rozmiar zależy od `traffic_delta_pct`.

| Kolumna | Typ | Opis |
|---|---|---|
| `icao` | string | Kod ICAO lotniska |
| `iata` | string | Kod IATA lotniska |
| `name` | string | Pełna nazwa lotniska |
| `city` | string | Miasto |
| `country` | string | Kod kraju ISO2 |
| `lat` | float | Szerokość geograficzna |
| `lon` | float | Długość geograficzna |
| `traffic_delta_pct` | int | Zmiana ruchu vs baseline 2021 [%] |
| `trend` | string | `up` (zielony) / `down` (czerwony) / `stable` (szary) |
| `baseline_flights_day` | int | Liczba lotów dziennie przed zmianą |
| `current_flights_day` | int | Aktualna liczba lotów dziennie |
| `top_operators` | string | Top 3 operatorów (rozdzielone przecinkami) |
| `reason` | string | Wyjaśnienie zmiany ruchu |

**Reguła kolorowania na mapie:**
- `trend = up` i `traffic_delta_pct > 15` → zielony krąg
- `trend = down` i `traffic_delta_pct < -15` → czerwony krąg
- pozostałe → szary krąg
- Rozmiar kółka proporcjonalny do `current_flights_day`

---

### 4. `geo_impact.csv` — Wpływ na konkretne samoloty (kluczowy plik)
**Po co:** Łączy zmiany tras z konkretnymi samolotami z floty. Pokazuje które rejestracje są dotknięte zmianą i o ile wcześniej należy spodziewać się C-check. Plik do połączenia z zakładką Checks.

| Kolumna | Typ | Opis |
|---|---|---|
| `registration` | string | Rejestracja samolotu — klucz do `predictions_raw.csv` |
| `operator` | string | Linia lotnicza |
| `route_id` | string | ID trasy z `geo_routes.csv` |
| `origin_icao` | string | ICAO lotniska bazowego operatora |
| `dest_icao` | string | ICAO lotniska docelowego |
| `airspace_affected` | string | ID zamkniętej strefy z `geo_airspaces.csv` |
| `extra_fh_monthly` | float | Dodatkowe FH miesięcznie przez zmianę trasy |
| `ccheck_acceleration_days` | int | O ile dni wcześniej C-check niż bez zmiany trasy |
| `original_predicted_date` | date | Oryginalna prognoza C-check z modelu ML |
| `adjusted_predicted_date` | date | Skorygowana prognoza uwzględniająca dodatkowe FH |
| `original_days_from_today` | int | Dni do C-check bez korekty geo |
| `adjusted_days_from_today` | int | Dni do C-check z korektą geo (użyj tego w Checks!) |
| `age_years` | int | Wiek samolotu |
| `last_check_window` | string | Ostatnie okno serwisowe |

---

## Relacje między plikami

```
geo_airspaces.csv
    ↕ airspace_id
geo_routes.csv
    ↕ route_id
geo_impact.csv
    ↕ registration
predictions_raw.csv (główny plik C-check)

geo_airports.csv
    ↕ icao = origin_icao z geo_routes.csv
    (niezależny — do wyświetlenia kółek na mapie)
```

## Jak to połączyć z backendem

**Endpoint mapy:**
```
GET /api/radar/airports    → geo_airports.csv
GET /api/radar/airspaces   → geo_airspaces.csv
GET /api/radar/routes      → geo_routes.csv
```

**Endpoint impact (do zakładki Checks):**
```
GET /api/radar/impact/:registration → geo_impact.csv filtrowany po registration
```

**Logika w Checks:**
Jeśli samolot istnieje w `geo_impact.csv`, użyj `adjusted_days_from_today`
zamiast `days_from_today` z `predictions_raw.csv` i oznacz ikoną ⚡ że
prognoza została przyspieszona przez sytuację geopolityczną.

---

## Operatorzy i dotknięte trasy (podsumowanie)

| Operator | Strefa | Trasa | Przyspieszenie C-check | Samolotów |
|---|---|---|---|---|
| LOT Polish | Ukraina (AS002) | WAW→TLV, WAW→BAK | 32–47 dni | 10 |
| Norwegian | Rosja (AS001) | OSL→NRT, OSL→ICN | 129–132 dni | 15 |
| KLM | Rosja (AS001) | AMS→HND, AMS→PEK | 76–193 dni | 20 |
| SunExpress | Iran (AS004) | SAW→DXB, SAW→AMM | 41–106 dni | 20 |
| Corendon | Iran (AS004) | IST→DXB | 70 dni | 10 |
| Enter Air | Ukraina (AS002) | WAW→SSH | 47 dni | 20 |
| Smartwings | Ukraina (AS002) | PRG→TLV | 21 dni | 10 |
| TUI fly | Iran (AS004) | BRU→DXB | 38 dni | 20 |

**Łącznie: 125 samolotów z przyspieszonymi prognozami C-check.**
