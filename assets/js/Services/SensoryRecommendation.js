import * as Html from './Html'

const MAX_CONTEXT_LENGTH = 3000

export const SENSORY_WORDS = [
  'above', 'below', 'beside', 'big', 'bigger', 'biggest', 'bottom', 'bottom-left',
  'bottom-right', 'bottom-to-top', 'corner', 'extra', 'huge', 'large', 'larger',
  'largest', 'left', 'left-to-right', 'little', 'lower', 'medium', 'right',
  'right-to-left', 'rectangle', 'round', 'shape', 'size', 'small', 'smaller',
  'smallest', 'square', 'tiny', 'top', 'top-left', 'top-right', 'top-to-bottom',
  'triangle', 'upper',
]

export function collectSensoryContext(contentHtml, issue) {
  if (typeof contentHtml !== 'string' || !contentHtml || !issue) return ''
  const document = new DOMParser().parseFromString(contentHtml, 'text/html')
  const target = Html.findElementWithIssue(document, issue)
  if (!target) return ''

  const textOf = (element) => (element?.innerText || element?.textContent || '')
    .replace(/\s+/g, ' ').trim()
  const ancestorScopes = []
  let scope = target.parentElement
  while (scope && scope !== document.body && ancestorScopes.length < 5) {
    const semanticScope = scope.matches('li, section, article, form, fieldset, table, [role], [aria-label]')
    const elementCount = scope.querySelectorAll('*').length
    const scopeText = textOf(scope)
    if (semanticScope || (elementCount <= 16 && scopeText.length <= 1800)) {
      ancestorScopes.push(scope)
    }
    scope = scope.parentElement
  }

  const selectedScope = ancestorScopes[0] || target.parentElement
  if (!selectedScope) return ''
  const targetParent = target.parentElement
  const siblings = Array.from(targetParent?.children || [])
  const siblingIndex = siblings.indexOf(target)
  const nearby = siblingIndex >= 0
    ? siblings.slice(Math.max(0, siblingIndex - 2), siblingIndex)
      .concat(siblings.slice(siblingIndex + 1, siblingIndex + 3))
      .map(textOf).filter(Boolean)
    : []
  const headingText = Array.from(selectedScope.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(textOf).filter(Boolean).slice(0, 5)
  const controls = Array.from(selectedScope.querySelectorAll('button, [role="button"], label, option'))
    .map((element) => [
      textOf(element),
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.getAttribute('value'),
    ].filter(Boolean).join(' '))
    .filter(Boolean).slice(0, 12)
  const scopeLabel = [selectedScope.getAttribute('aria-label'), selectedScope.getAttribute('title')]
    .filter(Boolean)
  const context = [
    scopeLabel.length && `Section label: ${scopeLabel.join(' ')}`,
    headingText.length && `Headings in this section: ${headingText.join(' | ')}`,
    nearby.length && `Nearby content: ${nearby.join(' | ')}`,
    controls.length && `Control labels in this section: ${controls.join(' | ')}`,
  ].filter(Boolean).join('\n')

  return context.slice(0, MAX_CONTEXT_LENGTH)
}

export function isSafeSuggestedHtml(currentHtml, suggestedHtml) {
  if (typeof suggestedHtml !== 'string' || suggestedHtml.length > 12000) return false
  const getStructure = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    if (doc.querySelector('script, style, iframe, object, embed, form')) return null
    return Array.from(doc.body.querySelectorAll('*')).map((element) =>
      `${element.tagName}:${Array.from(element.attributes).map((attribute) => `${attribute.name}=${attribute.value}`).sort().join(',')}`
    )
  }
  const currentStructure = getStructure(currentHtml)
  const suggestedStructure = getStructure(suggestedHtml)
  return currentStructure && suggestedStructure
    && JSON.stringify(currentStructure) === JSON.stringify(suggestedStructure)
    && suggestedHtml.trim() !== ''
}

export function getSuggestedText(suggestedHtml) {
  if (typeof suggestedHtml !== 'string') return ''
  const document = new DOMParser().parseFromString(suggestedHtml, 'text/html')
  return (document.body.textContent || '').replace(/\s+/g, ' ').trim()
}

export function validateSensoryRecommendation(recommendation, currentHtml) {
  if (!recommendation || !['suggest-edit', 'no-instructions', 'manual-review'].includes(recommendation.action)
    || !['low', 'medium', 'high'].includes(recommendation.confidence)
    || typeof recommendation.reason !== 'string' || recommendation.reason.trim() === '') return false
  if (recommendation.action !== 'suggest-edit') return true
  return isSafeSuggestedHtml(currentHtml, recommendation.html)
}
