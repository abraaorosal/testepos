import * as XLSX from 'xlsx'

export interface CepmRecord {
  year: number
  turma: string
  sequenceLabel: string
  sequenceNumber: number
  bcg: string
  totalStarted: number
  pmceGraduates: number
  otherForceGraduates: number
  totalGraduates: number
  nonGraduatesRaw: string
  nonGraduatesCount: number
  forceBreakdown: Record<string, number>
}

export interface ParsedDashboardData {
  records: CepmRecord[]
  forceNames: string[]
}

const FORCE_START_COLUMN = 6
const FORCE_END_COLUMN = 29
const DATA_START_ROW = 3

const normalizeText = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  const raw = normalizeText(value)
  if (!raw || raw === '-') {
    return 0
  }

  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

const extractSequenceNumber = (sequenceLabel: string): number => {
  const match = sequenceLabel.match(/\d+/)
  return match ? Number(match[0]) : 0
}

const extractNonGraduatesCount = (rawValue: string): number => {
  if (!rawValue || rawValue === '-') {
    return 0
  }

  const matches = rawValue.match(/\d+/g)
  if (!matches) {
    return 0
  }

  return matches.reduce((total, value) => total + Number(value), 0)
}

export async function parseCepmWorkbook(path: string): Promise<ParsedDashboardData> {
  const response = await fetch(path)
  if (!response.ok) {
    throw new Error(`Nao foi possivel carregar a planilha: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const worksheetName = workbook.SheetNames.find((name) => name.toLowerCase().includes('folha')) ?? workbook.SheetNames[0]
  const worksheet = workbook.Sheets[worksheetName]

  if (!worksheet) {
    throw new Error('A planilha nao possui uma aba valida para leitura')
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
  })

  const forceHeaderRow = rows[2] ?? []
  const forceNames: string[] = []

  for (let column = FORCE_START_COLUMN; column <= FORCE_END_COLUMN; column += 1) {
    const forceName = normalizeText(forceHeaderRow[column])
    forceNames.push(forceName || `FORCA ${column + 1}`)
  }

  const records: CepmRecord[] = []
  let currentYear = 0

  for (let rowIndex = DATA_START_ROW; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? []

    const sequenceLabel = normalizeText(row[2])
    if (sequenceLabel.toUpperCase() === 'TOTAL') {
      break
    }

    const turma = normalizeText(row[1])
    if (!turma) {
      continue
    }

    const possibleYear = toNumber(row[0])
    if (possibleYear > 0) {
      currentYear = possibleYear
    }

    if (!currentYear) {
      continue
    }

    const forceBreakdown: Record<string, number> = {}
    let otherForceGraduates = 0

    forceNames.forEach((forceName, index) => {
      const columnIndex = FORCE_START_COLUMN + index
      const quantity = toNumber(row[columnIndex])
      forceBreakdown[forceName] = quantity
      otherForceGraduates += quantity
    })

    const nonGraduatesRaw = normalizeText(row[30])

    records.push({
      year: currentYear,
      turma,
      sequenceLabel,
      sequenceNumber: extractSequenceNumber(sequenceLabel),
      bcg: normalizeText(row[3]),
      totalStarted: toNumber(row[4]),
      pmceGraduates: toNumber(row[5]),
      otherForceGraduates,
      totalGraduates: toNumber(row[31]),
      nonGraduatesRaw: nonGraduatesRaw === '-' ? '' : nonGraduatesRaw,
      nonGraduatesCount: extractNonGraduatesCount(nonGraduatesRaw),
      forceBreakdown,
    })
  }

  return { records, forceNames }
}
