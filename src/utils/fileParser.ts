import type { AgentDocument } from '../agent'

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFileError'
  }
}

export class EmptyFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'EmptyFileError'
  }
}

export interface ParsedAgentDocument {
  document: AgentDocument
  formatLabel: string
  notes: string[]
}

const TEXT_EXTENSIONS = new Set([
  'txt',
  'text',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'yaml',
  'yml',
  'log',
  'ini',
  'conf',
  'xml',
  'html',
  'htm',
])

const WORD_EXTENSIONS = new Set(['docx'])

const EXCEL_EXTENSIONS = new Set(['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv'])

const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/xml',
  'application/yaml',
  'application/x-yaml',
  'application/csv',
  'text/csv',
  'text/tsv',
  'text/plain',
  'text/markdown',
  'text/xml',
  'text/html',
  'application/xhtml+xml',
])

const WORD_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.oasis.opendocument.spreadsheet',
])

export const ACCEPTED_FILE_EXTENSIONS = [
  '.txt',
  '.text',
  '.md',
  '.markdown',
  '.json',
  '.csv',
  '.tsv',
  '.yaml',
  '.yml',
  '.log',
  '.ini',
  '.conf',
  '.xml',
  '.html',
  '.htm',
  '.docx',
  '.xlsx',
  '.xls',
  '.xlsm',
  '.xlsb',
  '.ods',
]

export const ACCEPT_ATTRIBUTE_VALUE = ACCEPTED_FILE_EXTENSIONS.join(',')

export const SUPPORTED_FORMAT_LABEL =
  'TXT、Markdown、JSON、CSV、YAML、LOG、Word (DOCX)、Excel (XLSX)'

export async function parseFileToAgentDocument(
  file: File
): Promise<ParsedAgentDocument> {
  const extension = extractExtension(file.name)
  const lowerType = file.type.toLowerCase()

  if (isTextLike(extension, lowerType)) {
    const content = await file.text()
    if (!content.trim()) {
      throw new EmptyFileError('文件内容为空，无法进行分析。')
    }
    return {
      document: {
        kind: 'text',
        content,
        filename: file.name,
      },
      formatLabel: extensionToLabel(extension, '文本文件'),
      notes: [],
    }
  }

  if (isWordDocument(extension, lowerType)) {
    const content = await extractTextFromDocx(file)
    if (!content.trim()) {
      throw new EmptyFileError('未能从 Word 文件中提取内容，请确认文档是否为空。')
    }
    return {
      document: {
        kind: 'text',
        content,
        filename: file.name,
      },
      formatLabel: 'Word 文档',
      notes: ['已自动将 Word 文档转换成纯文本，排版可能有所丢失。'],
    }
  }

  if (isExcelWorkbook(extension, lowerType)) {
    const { content, notes } = await extractTextFromExcel(file, extension)
    if (!content.trim()) {
      throw new EmptyFileError('未能从 Excel 工作簿中读取到可用数据。')
    }
    return {
      document: {
        kind: 'text',
        content,
        filename: file.name,
      },
      formatLabel: 'Excel 工作簿',
      notes: [
        '已将每个工作表转换为制表符分隔的文本，建议上传结构化数据以提高准确率。',
        ...notes,
      ],
    }
  }

  throw new UnsupportedFileError(
    `暂不支持 ${file.name} 的文件类型。请上传 ${SUPPORTED_FORMAT_LABEL} 等常见文本或办公文档格式。`
  )
}

function isTextLike(extension: string | null, lowerType: string) {
  if (lowerType && (lowerType.startsWith('text/') || TEXT_MIME_TYPES.has(lowerType))) {
    return true
  }
  if (!extension) {
    return false
  }
  return TEXT_EXTENSIONS.has(extension)
}

function isWordDocument(extension: string | null, lowerType: string) {
  if (lowerType && WORD_MIME_TYPES.has(lowerType)) {
    return true
  }
  if (!extension) return false
  return WORD_EXTENSIONS.has(extension)
}

function isExcelWorkbook(extension: string | null, lowerType: string) {
  if (lowerType && EXCEL_MIME_TYPES.has(lowerType)) {
    return true
  }
  if (!extension) return false
  return EXCEL_EXTENSIONS.has(extension)
}

function extractExtension(filename: string): string | null {
  const normalized = filename.toLowerCase().trim()
  const lastDot = normalized.lastIndexOf('.')
  if (lastDot === -1 || lastDot === normalized.length - 1) {
    return null
  }
  return normalized.slice(lastDot + 1)
}

function extensionToLabel(extension: string | null, fallback: string): string {
  if (!extension) return fallback
  return `${extension.toUpperCase()} 文件`
}

async function extractTextFromDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const mammoth = await import('mammoth/mammoth.browser')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return result.value
}

async function extractTextFromExcel(
  file: File,
  extension: string | null
): Promise<{ content: string; notes: string[] }> {
  const arrayBuffer = await file.arrayBuffer()
  const XLSX = await import('xlsx')

  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  const notes: string[] = []

  if (!workbook.SheetNames.length) {
    return { content: '', notes }
  }

  if (extension && (extension === 'xls' || extension === 'xlsb')) {
    notes.push('旧版 Excel 格式转换可能存在兼容性差异，请留意结果。')
  }

  const sections = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' }).trim()
    if (!csv) {
      return `## 工作表：${sheetName}\n（空表）`
    }
    return `## 工作表：${sheetName}\n${csv}`
  })

  return {
    content: sections.join('\n\n'),
    notes,
  }
}
