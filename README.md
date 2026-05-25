# LOTAMS MRO Intelligence Platform

> Platforma predykcyjna dla branży MRO (Maintenance, Repair & Overhaul), która przekształca surowe dane telemetryczne samolotów w realne decyzje handlowe, operacyjne i logistyczne.

---

## Spis treści

1. [Kontekst biznesowy — czym jest MRO?](#1-kontekst-biznesowy--czym-jest-mro)
2. [Problem, który rozwiązujemy](#2-problem-który-rozwiązujemy)
3. [Jak działa platforma — Workflow 360°](#3-jak-działa-platforma--workflow-360)
4. [Moduły aplikacji](#4-moduły-aplikacji)
   - [Checks — Priorytety C-Check](#41-checks--priorytety-c-check)
   - [Radar — Mapa Geopolityczna](#42-radar--mapa-geopolityczna)
   - [Risk Report — Analiza ML Komponentów](#43-risk-report--analiza-ml-komponentów)
5. [Pipeline ML — jak działa silnik predykcji](#5-pipeline-ml--jak-działa-silnik-predykcji)
6. [Stack technologiczny](#6-stack-technologiczny)
7. [Struktura projektu](#7-struktura-projektu)
8. [Jak uruchomić](#8-jak-uruchomić)
9. [Wartość biznesowa — trójkąt efektywności](#9-wartość-biznesowa--trójkąt-efektywności)

---

## 1. Kontekst biznesowy — czym jest MRO?

**MRO** (Maintenance, Repair & Overhaul) to branża odpowiedzialna za utrzymanie floty samolotów w zdatności do lotu. Każdy samolot komercyjny musi przechodzić cykliczne przeglądy techniczne regulowane przez prawo lotnicze (EASA). Najpoważniejszym z nich jest **C-Check** — kilkutygodniowy, kompleksowy przegląd hangaru obejmujący setki zadań technicznych, wymianę komponentów i certyfikację.

**LOTAMS** to polska firma MRO specjalizująca się w obsłudze samolotów wąskokadłubowych (głównie Boeing 737) obsługujących europejskich przewoźników: LOT Polish Airlines, Ryanair, Wizz Air, Enter Air i innych.

### Dlaczego to jest trudne?

Branża MRO ma kilka unikatowych wyzwań, których nie ma żaden inny sektor przemysłu:

- **Zamrożony kapitał w magazynie** — części zamienne, chemia lotnicza i farby mają rygorystyczne daty przydatności i wymagają kosztownej certyfikacji. Utrzymanie nadmiernych zapasów to miliony złotych zamrożone w półkach.
- **Skrajna sezonowość** — hangary pękają w szwach zimą (linie lotnicze odkładają samoloty na przegląd gdy ruch spada), a latem stoją puste. Biznes jest przewidywalnie nieprzewidywalny.
- **TAT jako przewaga konkurencyjna** — w przetargach MRO czas obsługi (TAT — Turnaround Time) liczy się bardziej niż cena. Linia lotnicza za każdy dzień przestoju samolotu traci setki tysięcy dolarów. O wygranym przetargu mogą decydować minuty.
- **Asymetria informacji** — firmy MRO często dowiadują się o planowanych przeglądach zbyt późno, żeby móc optymalnie zaplanować zasoby, zamówić części i skalkulować ofertę.

---

## 2. Problem, który rozwiązujemy

Tradycyjnie handlowiec LOTAMS dowiaduje się o planowanym C-Checku samolotu wtedy, gdy linia lotnicza sama wysyła zapytanie ofertowe — czyli 2–4 miesiące przed przeglądem. To za późno.

**Platforma LOTAMS MRO Intelligence rozwiązuje ten problem, dając LOTAMS wiedzę o planowanych przeglądach 6–18 miesięcy przed konkurencją.**

Robi to przez analizę trzech niezależnych źródeł danych:

| Źródło | Co analizujemy | Co przewidujemy |
|--------|---------------|-----------------|
| **Dane ADS-B** | Telemetria lotów (godziny lotu, cykle startów, trasy) | Kiedy samolot osiągnie próg C-Checka (co 4 500–6 000 FH) |
| **Dane geopolityczne** | Zamknięcia przestrzeni powietrznych, wydłużone trasy omijające strefy zagrożeń | Jak szybciej niż zakładano zużyją się godziny lotu przez dłuższe trasy |
| **Dane CAMO / historyczne** | Historia napraw, lista usterek MEL, dane o komponentach | Które konkretne części będą wymagały wymiany lub naprawy podczas C-Checka |

---

## 3. Jak działa platforma — Workflow 360°

Platforma realizuje cztery zsekwencjonowane kroki analityczne, od wykrycia sygnału po działanie handlowe:

### Krok 1 — Wczesne wykrywanie & geopolityka

System monitoruje dane ADS-B (pozycja, prędkość, wysokość, liczba lotów) dla floty blisko 100 samolotów Boeing 737 operujących w Europie. Na tej podstawie szacuje aktualne zużycie godzin lotu i cykli startów/lądowań dla każdej maszyny.

Równolegle śledzi sytuację geopolityczną: zamknięcia przestrzeni powietrznych (Rosja, Ukraina, Białoruś, Iran), wydłużenie tras i ich wpływ na tempo zużycia godzin lotu. Samolot który musi omijać zamkniętą przestrzeń powietrzną może zużywać nawet o 15–20% więcej FH miesięcznie niż zakładał harmonogram — co oznacza że C-Check przyjdzie szybciej niż przewidywała linia lotnicza.

### Krok 2 — Automatyzacja przetargów pod presją czasu

Gdy linia lotnicza wysyła dokumentację CAMO do przetargu (bazy danych zadań technicznych, tzw. Task Packetsy — często 8–10 GB danych), platforma automatycznie parsuje te pliki, mapuje tysiące zadań technicznych na zasoby hangarowe LOTAMS i układa optymalny harmonogram prac.

Wynik: LOTAMS może złożyć precyzyjną, bezpieczną ofertę szybciej niż jakakolwiek konkurencja — co w branży gdzie TAT jest kluczowym kryterium wyboru daje realną przewagę.

### Krok 3 — Inteligentny magazyn (Just-in-Time dla MRO)

Na podstawie historii napraw, profilu tras i modeli ML platforma przewiduje, które komponenty będą wymagały wymiany lub naprawy podczas konkretnego C-Checka. Zamiast utrzymywać kosztowny zapas „na wszelki wypadek", system generuje zamówienia dokładnie pod prognozowane okno serwisowe.

Szczególne znaczenie ma to dla chemii lotniczej (farby, uszczelniacze, smary) — mają rygorystyczne daty przydatności i wymagają certyfikacji. Zamówienie ich zbyt wcześnie = utylizacja. Zbyt późno = opóźnienie C-Checka i kary umowne.

### Krok 4 — Zarządzanie sezonowością (Yield Management w MRO)

Platforma identyfikuje samoloty, których okna serwisowe przypadają na letnie miesiące (maj–sierpień) — tradycyjnie martwy sezon dla MRO. Handlowcy otrzymują rekomendację proaktywnego kontaktu z linią i zaoferowania atrakcyjnych warunków za wypełnienie przestojów hangarowych. Takie letnich zlecenia, zdobyte dzięki wiedzy predykcyjnej, mogą być przekuwane w długoterminowe kontrakty serwisowe.

---

## 4. Moduły aplikacji

Aplikacja składa się z trzech zakładek dostępnych w lewym panelu bocznym.

---

### 4.1 Checks — Priorytety C-Check

**Dla kogo:** Dział handlowy (Sales). Odpowiada na pytanie: *z którymi liniami lotniczymi powinienem skontaktować się w tej chwili?*

#### Karty metryczne (górny rząd)

| Karta | Znaczenie |
|-------|-----------|
| **Wymaga kontaktu** (czerwona) | Samoloty, których C-Check przypada za 0–6 miesięcy. Wymaga natychmiastowego działania handlowego. |
| **Obserwuj** (bursztynowa) | Samoloty w oknie 6–12 miesięcy. Czas na budowanie relacji i wstępną wycenę. |
| **Śledzone** (niebieska) | Łączna liczba samolotów B737 monitorowanych w Europie. |

#### Filtry i wyszukiwanie

Tabela pozwala filtrować flotę według:
- **Rejestracji lub operatora** — wyszukiwanie tekstowe (np. wpisanie „SP-" wyświetli wszystkie polskie rejestry, „Ryanair" wyfiltruje całą flotę Ryanaira)
- **Operatora** — lista rozwijana wszystkich linii lotniczych w bazie
- **Priorytetu** — TERAZ / 6 mies. / 12 mies. / Daleko
- **Typu checku** — C-Check, A-Check, B-Check, D-Check

#### Tabela floty

Każdy wiersz to jeden samolot. Kolumny:
- **Numer ogonowy** — unikatowy identyfikator samolotu (np. SP-LVB), monospace dla czytelności
- **Operator** — linia lotnicza z kolorowym znacznikiem brandowym (granatowy dla LOT, pomarańczowy dla easyJet, etc.)
- **Wiek** — wiek samolotu w latach (starszy = szybsze zużycie komponentów)
- **Ostatnie okno** — kiedy był ostatni C-Check (miesiąc i rok)
- **Czas trwania** — ile dni trwał poprzedni przegląd (wskaźnik złożoności technicznej maszyny)
- **Prognoza C-Check** — przewidywany kwartał następnego przeglądu (np. Q3 2026)
- **Priorytet** — kolorowy badge: TERAZ (czerwony), 6 MIES. (bursztynowy), 12 MIES. (niebieski), DALEKO (szary)

Tabela jest sortowalna po każdej kolumnie — kliknięcie nagłówka przełącza między rosnącym i malejącym sortowaniem.

#### Rozwinięty wiersz — szczegóły samolotu

Kliknięcie w wiersz otwiera panel z czterema kolumnami szczegółów:

**Kolumna 1 — Wykryte okna serwisowe**
Lista historycznych C-Checków i A-Checków dla danego samolotu z dokładnymi datami i czasem trwania. Na dole prognoza kolejnego C-Checka z liczbą dni do okna.

**Kolumna 2 — Historia aktywności (36 miesięcy)**
Wizualizacja harmonogramu aktywności samolotu jako siatka 36 miesięcy. Niebieski pasek = samolot latał, szary pasek = przerwa serwisowa. Najechanie kursorem pokazuje miesiąc i szczegół przerwy (np. "przerwa 42 dni").

**Kolumna 3 — Szczegóły techniczne**
Logo operatora + kluczowe parametry: numer ogonowy, operator, wiek, wariant B737, daty ostatniego C-Checka, szacowane godziny lotu miesięcznie (FH/mies.), prognoza następnego przeglądu.

**Kolumna 4 — Wpływ geo** *(wyświetla się tylko gdy dostępne dane)*
Pokazuje, czy samolot lata trasą dotkniętą zamknięciem przestrzeni powietrznej. Zawiera: trasę, zamkniętą strefę, dodatkowe FH miesięcznie przez wydłużenie trasy, prognozę C-Checka bez i z uwzględnieniem geopolityki oraz liczbę dni przyspieszenia w stosunku do pierwotnego planu.

---

### 4.2 Radar — Mapa Geopolityczna

**Dla kogo:** Analitycy i dział handlowy. Odpowiada na pytanie: *jak sytuacja geopolityczna wpływa na tempo zużycia floty i kiedy to przekłada się na szanse dla LOTAMS?*

#### Mapa interaktywna (Leaflet)

Centralna część ekranu to mapa Europy i regionu EMEA z nałożonymi warstwami danych. Mapa pozwala na zoom, przesuwanie i klikanie w obiekty.

**Warstwy mapy** (przełączane w prawym górnym rogu):
- **Lotniska** — markery z informacją o ruchu lotniczym (delta % vs. baseline), top operatorzy, powód zmian ruchu
- **Przestrzenie powietrzne** — prostokątne ramki z kolorem oznaczającym status: czerwony = zamknięte (critical), bursztynowy = ograniczone (warning). Kliknięcie pokazuje NOTAM, daty zamknięcia, dotkniętych operatorów
- **Trasy** — linie łączące lotniska z podaniem zmiany czasu lotu (stara vs. nowa trasa), dodatkowych FH miesięcznie i przyspieszenia C-Checka w dniach
- **Wpływ na flotę** — połączenie tras z konkretnymi samolotami, które latają dotkniętymi połączeniami

#### Panel boczny

Po kliknięciu w element mapy (lotnisko, trasę, samolot) prawy panel wyświetla szczegóły:
- Dla **lotniska**: ruch dzienny (baseline vs. current), trend (↑/↓/stable), top operatorzy, powód zmian
- Dla **trasy**: origin → destination, operator, czas lotu przed i po zmianie, dodatkowe FH/mies., ile to przyspiesza C-Check
- Dla **samolotu z wpływem geo**: rejestracja, prognoza C-Checka oryginalna vs. skorygowana o geopolitykę, link do zakładki Checks

#### Filtry panelu

Możliwość filtrowania wyświetlanych danych po operatorze i minimalnym przyspieszeniu C-Checka (np. "pokaż tylko samoloty, których C-Check przyspieszył o co najmniej 30 dni").

---

### 4.3 Risk Report — Analiza ML Komponentów

**Dla kogo:** Dział operacyjny (planowanie hangarowe) i logistyka (magazyn części). Odpowiada na pytanie: *które konkretne części będą wymagały wymiany lub naprawy podczas nadchodzącego C-Checka i co trzeba zamówić z wyprzedzeniem?*

Jest to wynik działania pipeline'u ML wytrenowanego na danych historycznych CAMO.

#### Karty metryczne

| Karta | Znaczenie |
|-------|-----------|
| **HIGH** (czerwona) | 29 komponentów z wysokim ryzykiem uszkodzenia. Wymagają planowania wymiany i rezerwacji części. |
| **MEDIUM** (bursztynowa) | 7 komponentów w strefie obserwacji. |
| **LOW** (szara) | 5 komponentów z niskim ryzykiem. Monitorować rutynowo. |
| **RUL = 0 FH** (granatowa) | 2 komponenty z zerowym pozostałym czasem eksploatacji (Nose Tire, Main Tire) — **muszą zostać wymienione**. |

#### Pasek modeli ML

Trzy karty pokazują jakość predykcji dla każdego z zadań ML:

| Task | Zadanie | Najlepszy model | Wynik |
|------|---------|----------------|-------|
| Task 1 | Wykrywanie uszkodzeń (binarnie: uszkodzony / sprawny) | Logistic Regression | ROC-AUC 0.639 |
| Task 2 | Predykcja dotkliwości (None / Minor / Moderate / Major) | KNN | F1 (weighted) 0.302 |
| Task 3 | Estymacja RUL — pozostałe godziny lotu | Random Forest | R² = 0.852, MAE ~2 313 FH |

Task 3 (RUL) jest najdokładniejszy — R²=0.852 oznacza że model wyjaśnia 85% wariancji rzeczywistego zużycia. Task 2 (dotkliwość) jest najtrudniejszy z powodu silnej nierównowagi klas w danych treningowych.

#### Tabela komponentów (41 pozycji)

Każdy wiersz to jeden komponent B737 z oceną ryzyka. Kolumny:

- **Część / komponent** — nazwa techniczna (np. "Main Landing Gear Right", "Fuel Boost Pump #1")
- **System** — system samolotu do którego należy komponent, z kolorowym znacznikiem (czerwony = Landing Gear, niebieski = Flight Controls, bursztynowy = Electrical, etc.)
- **ATA** — numer rozdziału ATA (międzynarodowy standard klasyfikacji systemów lotniczych: ATA 32 = Landing Gear, ATA 27 = Flight Controls, ATA 28 = Fuel System, etc.)
- **Uszkodzenie %** — pasek procentowy z kolorem: czerwony ≥90%, bursztynowy ≥60%, niebieski poniżej 60%. To wyjście modelu Task 1 zamienione na prawdopodobieństwo.
- **Korozja** — wskaźnik podatności na korozję (1–10) wizualizowany jako 10 kwadratów. Kolor: czerwony jeśli ≥8, bursztynowy jeśli ≥5, niebieski poniżej.
- **Dotkliwość** — wyjście modelu Task 2: badge z kolorem (Major = czerwony, Moderate = bursztynowy, Minor = niebieski, None = szary)
- **RUL (FH)** — wyjście modelu Task 3: pozostałe godziny lotu do granicznego przeglądu. Czerwone "WYCZERPANY" gdy 0 FH, czerwona liczba gdy <2 000 FH, bursztynowa gdy <5 000 FH.
- **Priorytet** — końcowa klasyfikacja: HIGH / MEDIUM / LOW

Tabela jest sortowalna po każdej kolumnie. Domyślnie posortowana malejąco po "Uszkodzenie %" — najgroźniejsze komponenty na górze.

Dostępne filtry: priorytet, system samolotu, dotkliwość, wyszukiwanie tekstowe po nazwie części.

#### Rozwinięty wiersz — szczegóły komponentu

Kliknięcie w komponent otwiera panel z trzema kolumnami:

**Kolumna 1 — Parametry techniczne**
System, rozdział ATA, wskaźnik korozji, prognozowana dotkliwość. Duży pasek procentowy damage probability z kolorem.

**Kolumna 2 — Remaining Useful Life (RUL)**
Pełny kontekst zużycia: próg wymiany (0 FH), strefa alarmowa (<2 000 FH), strefa obserwacji (<5 000 FH), priorytet nadany przez model. Gdy RUL=0 wyświetlany jest czerwony komunikat "WYCZERPANY — wymaga wymiany podczas C-checku".

**Kolumna 3 — Wnioski i rekomendacje**
Generowane automatycznie na podstawie danych:
- RUL = 0 → "Część wymaga natychmiastowej wymiany przed C-checkiem"
- RUL < 2 000 FH → "Niskie RUL — zarezerwuj część z wyprzedzeniem"
- Korozja ≥ 8 → "Wysoki wskaźnik korozji — wymagana inspekcja powłok"
- Severity = Major → "Przewidywalna wymiana podzespołu"

---

## 5. Pipeline ML — jak działa silnik predykcji

### Dane wejściowe

| Plik | Zawartość |
|------|-----------|
| `CAMO_DANE_TRAIN.csv` | Historyczne zdarzenia serwisowe B737: daty napraw, rodzaj usterki, system samolotu, dotkliwość, czas naprawy |
| `LOT_AWS_B737_MAGAZYN_CZESCI.xlsx` | Katalog magazynowy LOT: lista komponentów, podatność na korozję, numery ATA, historyczne zamówienia |

### Feature engineering (18 cech)

Model nie operuje na surowych zdarzeniach — z danych historycznych wyliczane są cechy predykcyjne:
- Burn rate FH (tempo zużycia godzin lotu miesięcznie)
- AOG ratio (procent dni gdy samolot był uziemiony — Aircraft on Ground)
- Inter-check intervals (odstępy między poprzednimi przeglądami)
- Age features (wiek samolotu, wiek od ostatniego C-Checka)
- Corrosion susceptibility (podatność na korozję z katalogu części)
- System type encoding (enkodowanie systemu lotniczego)

### 3 zadania × 7 algorytmów = 21 modeli

```
Task 1 — Damage Detection (Binary Classification)
  Czy dany komponent będzie uszkodzony podczas C-Checka? (tak/nie)
  Algorytmy: Logistic Regression, Random Forest, Gradient Boosting,
             XGBoost, LightGBM, SVM, KNN
  Najlepszy: Logistic Regression (ROC-AUC 0.639)

Task 2 — Severity Prediction (Multiclass Classification)
  Jak poważne będzie uszkodzenie? (None / Minor / Moderate / Major / Critical)
  Najlepszy: KNN (F1 weighted 0.302)

Task 3 — RUL Estimation (Regression)
  Ile godzin lotu pozostało komponentowi do granicznego przeglądu?
  Najlepszy: Random Forest (R² = 0.852, MAE ~2 313 FH)
```

### Wynik: C-Check Risk Report

Pipeline łączy wyniki trzech modeli w jeden raport 41 komponentów rankingowanych według priorytetu. Raport zapisywany do `backend/output/ccheck_risk_report.csv` i serwowany przez API do zakładki Risk Report.

### Złote okno (Golden Window)

Kluczowe pojęcie w logice predykcji C-Checków: system wyświetla tylko samoloty, których przegląd przypada w oknie **6–18 miesięcy od daty referencyjnej (22 maja 2026)**, czyli do **22 listopada 2027**. To „złote okno" — wystarczająco blisko żeby kontakt miał sens, wystarczająco daleko żeby LOTAMS mogło wygrać przetarg i przygotować zasoby.

---

## 6. Stack technologiczny

### Frontend
- **React 19** + **Vite 8** — framework i bundler
- **Tailwind CSS 4** — utility-first styling
- **React Leaflet + Leaflet** — interaktywne mapy
- **Recharts** — wykresy (bar chart, area chart)
- **Lucide React** — ikony
- Fonty: **Syne** (nagłówki), **IBM Plex Sans** (treść), **IBM Plex Mono** (dane liczbowe)

### Backend
- **FastAPI** — REST API (Python)
- **Uvicorn** — ASGI server
- **pandas** — przetwarzanie danych CSV
- CORS skonfigurowany dla `localhost:5173`

### ML Pipeline
- **scikit-learn** — RandomForestRegressor/Classifier, Logistic Regression, KNN, SVM, Gradient Boosting
- **XGBoost** + **LightGBM** — gradient boosting
- **pandas** + **numpy** — feature engineering
- **BeautifulSoup4** — parsowanie danych MRO z zewnętrznych źródeł

### Dane geograficzne
- `geo_airspaces.csv` — strefy powietrzne (bbox, status, severity, NOTAM)
- `geo_airports.csv` — lotniska (ICAO/IATA, współrzędne, ruch, operatorzy)
- `geo_routes.csv` — trasy (origin, destination, delta FH, częstotliwość)
- `geo_impact.csv` — wpływ geopolityki na konkretne rejestracje floty

---

## 7. Struktura projektu

```
vibe-hakaton/
│
├── backend/                        # FastAPI backend
│   ├── api.py                      # Główny serwer API — wszystkie endpointy
│   ├── main.py                     # Alternatywny serwer (radar endpoints)
│   ├── run_pipeline.py             # Master script — uruchamia cały pipeline ML
│   ├── requirements.txt            # Zależności Python
│   │
│   ├── data/                       # Dane wejściowe i przetworzone
│   │   ├── CAMO_DANE_TRAIN.csv     # Dane treningowe CAMO (historyczne naprawy)
│   │   ├── LOT_AWS_B737_MAGAZYN_CZESCI.xlsx  # Katalog magazynowy LOT
│   │   ├── lotams_prediction_leads.csv       # Wynik predykcji C-Check (flota)
│   │   ├── europe_fleet.csv        # Rejestr floty B737 w Europie
│   │   ├── mock_adsb.csv           # Syntetyczne dane ADS-B
│   │   ├── adsb_deliveries.csv     # Dostawy samolotów
│   │   └── predictions_raw.csv    # Surowe predykcje
│   │
│   ├── output/                     # Wyniki pipeline'u ML
│   │   ├── ccheck_risk_report.csv  # Raport ryzyka 41 komponentów (Risk Report tab)
│   │   ├── task1_damage_metrics.csv # Metryki Task 1 (klasyfikacja binarna)
│   │   ├── task2_severity_metrics.csv # Metryki Task 2 (wieloklasowa)
│   │   └── task3_rul_metrics.csv  # Metryki Task 3 (regresja RUL)
│   │
│   └── src/                       # Moduły pipeline'u ML
│       ├── generate_fleet.py       # Generuje rejestr floty B737
│       ├── generate_mock_adsb.py   # Generuje syntetyczne dane ADS-B
│       ├── train_predictor.py      # Trenuje RandomForestRegressor
│       ├── filter_golden_window.py # Filtruje złote okno (6–18 mies.)
│       └── explain_one_lead.py     # Wyjaśnia predykcję dla jednego samolotu
│
├── frontend/                      # React aplikacja
│   ├── src/
│   │   ├── App.jsx                # Root — routing między zakładkami
│   │   ├── components/
│   │   │   ├── Sidebar.jsx        # Panel nawigacji (lewy)
│   │   │   ├── TopBar.jsx         # Górny pasek (breadcrumb, status)
│   │   │   ├── Checks.jsx         # Zakładka: Priorytety C-Check
│   │   │   ├── RadarTab.jsx       # Zakładka: Radar geopolityczny (wrapper)
│   │   │   ├── Radar.jsx          # Komponent mapy Leaflet
│   │   │   ├── RiskReport.jsx     # Zakładka: Risk Report (ML)
│   │   │   ├── Dashboard.jsx      # Dashboard (mock data, nieaktywny)
│   │   │   └── CAMO.jsx           # CAMO Task Analysis (mock data, nieaktywny)
│   │   └── mock/
│   │       └── data.js            # Mock data dla nieaktywnych widoków
│   ├── public/
│   │   └── airspace-countries.geojson  # Dane GeoJSON granic krajów
│   └── vite.config.js             # Proxy /api → localhost:8000
│
├── geo data/                      # Dane geograficzne CSV
│   ├── geo_airspaces.csv
│   ├── geo_airports.csv
│   ├── geo_routes.csv
│   └── geo_impact.csv
│
└── MRO_Platform_Hackathon_Strategy.pdf  # Strategia produktu
```

---

## 8. Jak uruchomić

### Wymagania

- Python 3.11+
- Node.js 20+
- npm 10+

### Backend

```bash
cd backend

# Utwórz środowisko wirtualne (jednorazowo)
python -m venv venv

# Aktywuj (Windows)
venv\Scripts\activate

# Aktywuj (macOS/Linux)
source venv/bin/activate

# Zainstaluj zależności
pip install fastapi uvicorn pandas numpy scikit-learn beautifulsoup4 requests tqdm xgboost lightgbm scipy

# Uruchom serwer API
uvicorn api:app --reload --port 8000
```

Backend będzie dostępny pod: `http://localhost:8000`
Dokumentacja API (Swagger): `http://localhost:8000/docs`

### Frontend

```bash
cd frontend

# Zainstaluj zależności (jednorazowo)
npm install

# Uruchom dev server
npm run dev
```

Frontend będzie dostępny pod: `http://localhost:5173`

> Vite automatycznie proxy'uje wszystkie requesty `/api/*` do `http://localhost:8000` — obie usługi muszą działać jednocześnie.

### Opcjonalnie — regeneracja danych ML

Jeśli chcesz ponownie uruchomić cały pipeline ML (generowanie danych, trening modeli, generowanie raportów):

```bash
cd backend
python run_pipeline.py
```

Wygeneruje wszystkie pliki CSV w `backend/data/` i `backend/output/`.

### Endpointy API

| Endpoint | Opis |
|----------|------|
| `GET /api/aircraft` | Lista wszystkich samolotów z prognozami C-Check |
| `GET /api/stats` | Statystyki floty (total, NOW, observe) |
| `GET /api/radar/airspaces` | Zamknięte/ograniczone przestrzenie powietrzne |
| `GET /api/radar/airports` | Lotniska z danymi ruchu |
| `GET /api/radar/routes` | Trasy z delta FH i wpływem na C-Check |
| `GET /api/radar/impact` | Wpływ geopolityki na konkretne rejestracje |
| `GET /api/camo/risk-report` | Raport ryzyka 41 komponentów (ML) |
| `GET /api/camo/ml-metrics` | Metryki benchmarku modeli ML |
| `GET /api/health` | Status serwera i liczba załadowanych rekordów |

---

## 9. Wartość biznesowa — trójkąt efektywności

System rozwiązuje problemy trzech niezależnych działów LOTAMS jednocześnie:

### Dział Handlowy (Sales)
- **Wiedza 6–12 miesięcy przed konkurencją** — handlowiec wie o zbliżającym się C-Checku zanim linia wyśle RFQ (Request for Quotation)
- **Zapełnienie pustych hangarów w sezonie letnim** — proaktywny prospecting samolotów z letnim oknem serwisowym
- **Błyskawiczne generowanie ofert** — automatyczne parsowanie dokumentacji CAMO skraca czas przygotowania przetargu z tygodni do godzin

### Dział Operacyjny (Hangar)
- **Optymalne planowanie grafików mechaników** — wiedza o nadchodzących zleceniach z wyprzedzeniem pozwala eliminować przestoje i nadgodziny
- **Wcześniejsza wiedza o usterkach MEL** — Risk Report identyfikuje które komponenty wymagają wymiany, zanim samolot wjedzie do hangaru
- **Płynne zarządzanie TAT** — optymalne sekwencjonowanie zadań minimalizuje czas obsługi i ryzyko kar umownych

### Dział Logistyki i Finansów
- **Odmrożenie kapitału** — zamawianie części Just-in-Time zamiast utrzymywania kosztownych zapasów
- **Kontrola dat przydatności** — chemia lotnicza (farby, uszczelniacze, smary) zamawiana precyzyjnie pod okno serwisowe, nie "na zapas"
- **Eliminacja ryzyka kar** — precyzyjna kalkulacja TAT w ofertach przetargowych

---

> System przekształca surowe dane telemetryczne (ADS-B) w realne decyzje finansowo-logistyczne — od poziomu pojedynczej uszczelki z datą ważności, aż po globalne trendy geopolityczne wpływające na trasy cargo.
