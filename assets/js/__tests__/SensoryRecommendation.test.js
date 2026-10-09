import { describe, expect, it } from '@jest/globals'
import { collectSensoryContext, getSuggestedText, isSafeSuggestedHtml, validateSensoryRecommendation } from '../Services/SensoryRecommendation'

describe('sensory recommendations', () => {
  it('accepts wording changes that preserve the existing markup and attributes', () => {
    expect(isSafeSuggestedHtml(
      '<p class="instructions">Click the button on the right.</p>',
      '<p class="instructions">Click the Delete button.</p>'
    )).toBe(true)
  })

  it('converts suggested HTML into plain inline preview text', () => {
    expect(getSuggestedText('<p>Choose <strong>Save Profile</strong>.</p>')).toBe('Choose Save Profile.')
  })

  it('rejects markup or attribute changes in a suggested edit', () => {
    const source = '<p>Click the button on the right.</p>'
    expect(isSafeSuggestedHtml(source, '<p><a href="/delete">Click Delete</a></p>')).toBe(false)
    expect(isSafeSuggestedHtml(source, '<p onclick="alert(1)">Click Delete</p>')).toBe(false)
  })

  it('validates review recommendations and rejects incomplete responses', () => {
    expect(validateSensoryRecommendation({
      action: 'manual-review', confidence: 'medium', reason: 'Context does not identify the control.',
    }, '<p>Click on the right.</p>')).toBe(true)
    expect(validateSensoryRecommendation({ action: 'suggest-edit', confidence: 'high', reason: 'Edit' }, '<p>Original</p>')).toBe(false)
  })

  it('recognizes a no-instructions recommendation as a distinct decision', () => {
    expect(validateSensoryRecommendation({
      action: 'no-instructions', confidence: 'high', reason: 'This is descriptive text, not an instruction.',
    }, '<p>The path turns left by the river.</p>')).toBe(true)
  })

  it('leaves semantic wording review to the server-side reviewer', () => {
    expect(validateSensoryRecommendation({
      action: 'suggest-edit', confidence: 'medium', reason: 'Changed upper to top.',
      html: '<p>Move the card to the top section.</p>',
    }, '<p>Move the card to the upper section.</p>')).toBe(true)
    expect(validateSensoryRecommendation({
      action: 'suggest-edit', confidence: 'medium', reason: 'Changed right to side.',
      html: '<p>Choose the option on the side to continue.</p>',
    }, '<p>Choose the option on the right to continue.</p>')).toBe(true)
    expect(validateSensoryRecommendation({
      action: 'suggest-edit', confidence: 'medium', reason: 'Changed the markup.',
      html: '<div>Choose the option.</div>',
    }, '<p>Choose the option.</p>')).toBe(false)
  })

  it('collects a short ancestor text excerpt around the issue for context', () => {
    const context = collectSensoryContext(
      '<div><h2>Profile settings</h2><p>Choose Save Profile at the bottom-right.</p><p>Changes may take a minute.</p><p>Unrelated distant content.</p><p>More unrelated content.</p></div>',
      { xpath: '//p[1]', sourceHtml: '<p>Choose Save Profile at the bottom-right.</p>', status: 0 }
    )
    expect(context).toContain('Profile settings')
    expect(context).toContain('Changes may take a minute')
    expect(context).not.toContain('Unrelated distant content')
    expect(context.length).toBeLessThanOrEqual(3000)
  })
})
