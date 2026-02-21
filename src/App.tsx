import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import './App.css'
import { type CepmRecord, parseCepmWorkbook } from './lib/cepmParser'

const WORKBOOK_PATH = '/data/concludentes-cepm.xlsx'

const FORCE_COLORS = [
  '#0284c7',
  '#16a34a',
  '#f59e0b',
  '#ef4444',
  '#7c3aed',
  '#ec4899',
  '#0f766e',
  '#ea580c',
  '#2563eb',
  '#4338ca',
]

const numberFormatter = new Intl.NumberFormat('pt-BR')
const percentageFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const normalizeTooltipValue = (value: unknown): number | string => {
  if (Array.isArray(value)) {
    return value[0] ?? 0
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return value
  }

  return 0
}

const formatTooltipNumber = (value: unknown): string =>
  numberFormatter.format(Number(normalizeTooltipValue(value)))

const formatTooltipPercent = (value: unknown): string =>
  `${percentageFormatter.format(Number(normalizeTooltipValue(value)))}%`

interface YearlyMetrics {
  year: number
  classes: number
  totalStarted: number
  pmceGraduates: number
  otherForceGraduates: number
  totalGraduates: number
  completionRate: number
}

interface ForceMetrics {
  force: string
  total: number
}

interface SequenceMetrics {
  sequenceNumber: number
  year: number
  turma: string
  totalStarted: number
  totalGraduates: number
}

function App() {
  const [records, setRecords] = useState<CepmRecord[]>([])
  const [forceNames, setForceNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [yearFilter, setYearFilter] = useState('Todos')
  const [forceFilter, setForceFilter] = useState('Todas')
  const [searchFilter, setSearchFilter] = useState('')
  const [topForcesLimit, setTopForcesLimit] = useState(8)

  useEffect(() => {
    const loadWorkbook = async () => {
      setLoading(true)
      setError(null)

      try {
        const parsed = await parseCepmWorkbook(WORKBOOK_PATH)
        setRecords(parsed.records)
        setForceNames(parsed.forceNames)
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Erro ao ler a planilha')
      } finally {
        setLoading(false)
      }
    }

    void loadWorkbook()
  }, [])

  const availableYears = useMemo(
    () => Array.from(new Set(records.map((record) => record.year))).sort((a, b) => a - b),
    [records],
  )

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [records],
  )

  const filteredRecords = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    return sortedRecords.filter((record) => {
      if (yearFilter !== 'Todos' && record.year !== Number(yearFilter)) {
        return false
      }

      if (forceFilter !== 'Todas' && (record.forceBreakdown[forceFilter] ?? 0) <= 0) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const textIndex = `${record.year} ${record.turma} ${record.sequenceLabel} ${record.bcg}`.toLowerCase()
      return textIndex.includes(normalizedSearch)
    })
  }, [sortedRecords, yearFilter, forceFilter, searchFilter])

  const totalMetrics = useMemo(
    () =>
      filteredRecords.reduce(
        (accumulator, record) => {
          accumulator.classes += 1
          accumulator.totalStarted += record.totalStarted
          accumulator.pmceGraduates += record.pmceGraduates
          accumulator.otherForceGraduates += record.otherForceGraduates
          accumulator.totalGraduates += record.totalGraduates
          accumulator.nonGraduates += record.nonGraduatesCount
          return accumulator
        },
        {
          classes: 0,
          totalStarted: 0,
          pmceGraduates: 0,
          otherForceGraduates: 0,
          totalGraduates: 0,
          nonGraduates: 0,
        },
      ),
    [filteredRecords],
  )

  const completionRate =
    totalMetrics.totalStarted > 0 ? (totalMetrics.totalGraduates / totalMetrics.totalStarted) * 100 : 0

  const yearlyMetrics = useMemo<YearlyMetrics[]>(() => {
    const grouped = new Map<number, YearlyMetrics>()

    filteredRecords.forEach((record) => {
      const existing = grouped.get(record.year)

      if (existing) {
        existing.classes += 1
        existing.totalStarted += record.totalStarted
        existing.pmceGraduates += record.pmceGraduates
        existing.otherForceGraduates += record.otherForceGraduates
        existing.totalGraduates += record.totalGraduates
        return
      }

      grouped.set(record.year, {
        year: record.year,
        classes: 1,
        totalStarted: record.totalStarted,
        pmceGraduates: record.pmceGraduates,
        otherForceGraduates: record.otherForceGraduates,
        totalGraduates: record.totalGraduates,
        completionRate: 0,
      })
    })

    return Array.from(grouped.values())
      .sort((a, b) => a.year - b.year)
      .map((entry) => ({
        ...entry,
        completionRate: entry.totalStarted > 0 ? (entry.totalGraduates / entry.totalStarted) * 100 : 0,
      }))
  }, [filteredRecords])

  const forceMetrics = useMemo<ForceMetrics[]>(() => {
    const grouped = forceNames.map((force) => ({
      force,
      total: filteredRecords.reduce((sum, record) => sum + (record.forceBreakdown[force] ?? 0), 0),
    }))

    return grouped.filter((entry) => entry.total > 0).sort((a, b) => b.total - a.total)
  }, [filteredRecords, forceNames])

  const maxTopForces = Math.max(3, Math.min(forceMetrics.length || 3, 15))

  useEffect(() => {
    if (topForcesLimit > maxTopForces) {
      setTopForcesLimit(maxTopForces)
    }
  }, [maxTopForces, topForcesLimit])

  const topForces = forceMetrics.slice(0, topForcesLimit)

  const sequenceMetrics = useMemo<SequenceMetrics[]>(
    () =>
      filteredRecords.map((record) => ({
        sequenceNumber: record.sequenceNumber,
        year: record.year,
        turma: record.turma,
        totalStarted: record.totalStarted,
        totalGraduates: record.totalGraduates,
      })),
    [filteredRecords],
  )

  const handleResetFilters = () => {
    setYearFilter('Todos')
    setForceFilter('Todas')
    setSearchFilter('')
  }

  if (loading) {
    return (
      <main className="dashboard-shell">
        <section className="status-card">
          <h1>Carregando dashboard...</h1>
          <p>Lendo os dados da planilha Concludentes do CEPM.</p>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="dashboard-shell">
        <section className="status-card error">
          <h1>Erro ao carregar os dados</h1>
          <p>{error}</p>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-shell">
      <header className="hero-panel fade-in-up">
        <div>
          <p className="eyebrow">Analise interativa</p>
          <h1>Concludentes do CEPM</h1>
          <p className="subtitle">
            Dashboard em React + TypeScript com leitura direta da planilha e filtros para turmas, anos e forcas.
          </p>
        </div>
        <div className="hero-meta">
          <span>{numberFormatter.format(records.length)} turmas lidas</span>
          <span>
            {availableYears[0]} a {availableYears[availableYears.length - 1]}
          </span>
        </div>
      </header>

      <section className="filters-panel fade-in-up delayed-1">
        <div className="filter-group">
          <label htmlFor="year-filter">Ano</label>
          <select id="year-filter" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
            <option value="Todos">Todos</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="force-filter">Forca externa</label>
          <select id="force-filter" value={forceFilter} onChange={(event) => setForceFilter(event.target.value)}>
            <option value="Todas">Todas</option>
            {forceNames.map((force) => (
              <option key={force} value={force}>
                {force}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group grow">
          <label htmlFor="search-filter">Busca por turma/BCG</label>
          <input
            id="search-filter"
            type="text"
            value={searchFilter}
            onChange={(event) => setSearchFilter(event.target.value)}
            placeholder="Ex.: 2025, 10o CEPM, BCG169"
          />
        </div>

        <button type="button" className="reset-button" onClick={handleResetFilters}>
          Limpar filtros
        </button>
      </section>

      <section className="stats-grid fade-in-up delayed-2">
        <article className="stat-card">
          <p>Turmas filtradas</p>
          <strong>{numberFormatter.format(totalMetrics.classes)}</strong>
          <small>base ativa</small>
        </article>

        <article className="stat-card">
          <p>Servidores que iniciaram</p>
          <strong>{numberFormatter.format(totalMetrics.totalStarted)}</strong>
          <small>somatorio</small>
        </article>

        <article className="stat-card">
          <p>Concludentes PMCE</p>
          <strong>{numberFormatter.format(totalMetrics.pmceGraduates)}</strong>
          <small>{percentageFormatter.format((totalMetrics.pmceGraduates / Math.max(totalMetrics.totalGraduates, 1)) * 100)}%</small>
        </article>

        <article className="stat-card">
          <p>Concludentes outras forcas</p>
          <strong>{numberFormatter.format(totalMetrics.otherForceGraduates)}</strong>
          <small>{percentageFormatter.format((totalMetrics.otherForceGraduates / Math.max(totalMetrics.totalGraduates, 1)) * 100)}%</small>
        </article>

        <article className="stat-card">
          <p>Taxa de conclusao</p>
          <strong>{percentageFormatter.format(completionRate)}%</strong>
          <small>{numberFormatter.format(totalMetrics.nonGraduates)} nao concluiram</small>
        </article>
      </section>

      <section className="charts-grid fade-in-up delayed-3">
        <article className="chart-card wide">
          <div className="card-head">
            <h2>Evolucao anual</h2>
            <p>Concludentes PMCE + outras forcas, comparados com iniciantes.</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={yearlyMetrics}>
                <CartesianGrid strokeDasharray="4 4" stroke="#bdd5df" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => numberFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatTooltipNumber(value)}
                  contentStyle={{ borderRadius: 12, borderColor: '#b6cad4' }}
                />
                <Legend />
                <Bar dataKey="pmceGraduates" name="Concludentes PMCE" stackId="concluintes" fill="#0369a1" radius={[8, 8, 0, 0]} />
                <Bar
                  dataKey="otherForceGraduates"
                  name="Concludentes outras forcas"
                  stackId="concluintes"
                  fill="#14b8a6"
                  radius={[8, 8, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="totalStarted"
                  name="Iniciaram o CEPM"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 3, strokeWidth: 0 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="chart-card">
          <div className="card-head">
            <h2>Top forcas externas</h2>
            <p>Concludentes por instituicao no recorte filtrado.</p>
            <label className="range-label" htmlFor="top-force-range">
              Mostrar top {topForcesLimit}
            </label>
            <input
              id="top-force-range"
              type="range"
              min={3}
              max={maxTopForces}
              value={Math.min(topForcesLimit, maxTopForces)}
              onChange={(event) => setTopForcesLimit(Number(event.target.value))}
            />
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topForces} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="#bdd5df" />
                <XAxis type="number" tickFormatter={(value) => numberFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="force" width={130} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatTooltipNumber(value)} />
                <Bar dataKey="total" name="Concludentes" radius={[0, 10, 10, 0]}>
                  {topForces.map((entry, index) => (
                    <Cell key={entry.force} fill={FORCE_COLORS[index % FORCE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="chart-card">
          <div className="card-head">
            <h2>Taxa de conclusao anual</h2>
            <p>Percentual de concludentes sobre iniciantes, por ano.</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyMetrics}>
                <CartesianGrid strokeDasharray="4 4" stroke="#bdd5df" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatTooltipPercent(value)} />
                <Line
                  type="monotone"
                  dataKey="completionRate"
                  stroke="#0f766e"
                  strokeWidth={3}
                  dot={{ r: 3, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name="Taxa de conclusao"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="chart-card full">
          <div className="card-head">
            <h2>Linha de sequencia dos CEPMs</h2>
            <p>Use o brush para navegar pelas turmas em ordem de sequencia.</p>
          </div>
          <div className="chart-wrap tall">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={sequenceMetrics}>
                <CartesianGrid strokeDasharray="4 4" stroke="#bdd5df" />
                <XAxis dataKey="sequenceNumber" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => numberFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => formatTooltipNumber(value)}
                  labelFormatter={(value) => `Sequencia ${value}`}
                />
                <Legend />
                <Bar dataKey="totalGraduates" name="Concludentes" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                <Line
                  type="monotone"
                  dataKey="totalStarted"
                  name="Iniciaram"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={false}
                />
                <Brush dataKey="sequenceNumber" height={24} stroke="#0f172a" travellerWidth={10} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="table-card fade-in-up delayed-4">
        <div className="card-head">
          <h2>Detalhamento por turma</h2>
          <p>{numberFormatter.format(filteredRecords.length)} registros no filtro atual.</p>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ano</th>
                <th>Turma</th>
                <th>Sequencia</th>
                <th>BCG</th>
                <th>Iniciaram</th>
                <th>PMCE</th>
                <th>Outras forcas</th>
                <th>Total</th>
                <th>Nao concluiram</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={`${record.year}-${record.sequenceNumber}-${record.turma}`}>
                  <td>{record.year}</td>
                  <td>{record.turma}</td>
                  <td>{record.sequenceLabel}</td>
                  <td>{record.bcg}</td>
                  <td>{numberFormatter.format(record.totalStarted)}</td>
                  <td>{numberFormatter.format(record.pmceGraduates)}</td>
                  <td>{numberFormatter.format(record.otherForceGraduates)}</td>
                  <td>{numberFormatter.format(record.totalGraduates)}</td>
                  <td>{record.nonGraduatesRaw || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default App
