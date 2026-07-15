export interface ParagraphContent {
  id: string
  text: string
}

export interface SectionContent {
  id: string
  heading: string | null
  paragraphs: ParagraphContent[]
}

export interface StructuredPageContent {
  title: string
  url: string
  domain: string
  sections: SectionContent[]
}

export interface KeySection {
  label: string // the specific thing at that location, not an abstract theme
  preview: string // what the reader will find there, citing a concrete detail
  targetId: string
}

export interface ReadMapResult {
  status: 'ok' | 'not_suitable' | 'low_confidence'
  overview: string
  keySections: KeySection[]
  pageQuality: 'high' | 'medium' | 'low'
  missingContext: string[]
  reason: string
}
