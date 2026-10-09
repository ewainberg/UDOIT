import chroma from "chroma-js";
import { findElementWithXpath, findXpathFromElement } from "./Html";

export function toHSL(color) {
  try {
    const chromaColor = chroma(color)
    const [h, s, l] = chromaColor.hsl()
    return { h, s, l }
  } catch {
    const tempDiv = document.createElement('div')
    tempDiv.style.color = color
    document.body.appendChild(tempDiv)
    const computedColor = getComputedStyle(tempDiv).color
    document.body.removeChild(tempDiv)
    try {
      const forcedChromaColor = chroma(computedColor)
      const [forcedH, forcedS, forcedL] = forcedChromaColor.hsl()
      return { h: forcedH, s: forcedS, l: forcedL }
    } catch {
      return { h: 0, s: 0, l: 0 }
    }
  }
}

export function hslToHex(hsl) {
  try {
    return chroma.hsl(hsl.h, hsl.s, hsl.l).hex();
  } catch {
    return null;
  }
}

export function changeLuminance(hsl, dir) {
  if (!hsl || typeof hsl.l !== 'number') return hsl;
  const step = 0.025;
  let newL = hsl.l;
  if (dir === "lighten") {
    newL = Math.min(1, newL + step);
  } else {
    newL = Math.max(0, newL - step);
  }
  return { h: hsl.h, s: hsl.s, l: newL };
}

export function findColorForContrast(color, otherColors, targetRatio) {
  const meetsRatio = (candidate) => otherColors.every((otherColor) =>
    contrastRatio(hslToHex(candidate), hslToHex(otherColor)) >= targetRatio
  )
  if (meetsRatio(color)) return color

  const candidates = []
  ;['lighten', 'darken'].forEach((direction) => {
    let candidate = color
    for (let attempt = 0; attempt < 41; attempt += 1) {
      candidate = changeLuminance(candidate, direction)
      if (meetsRatio(candidate)) {
        candidates.push(candidate)
        break
      }
    }
  })
  if (!candidates.length) return null
  return candidates.sort((first, second) =>
    Math.abs(first.l - color.l) - Math.abs(second.l - color.l)
  )[0]
}

const GRADIENT_KEYWORDS = new Set([
  'linear', 'radial', 'conic', 'repeating-linear', 'repeating-radial', 'repeating-conic', 'gradient',
  'to', 'top', 'bottom', 'left', 'right', 'circle', 'ellipse', 'at', 'center', 'from', 'in',
  'hue', 'shorter', 'longer', 'increasing', 'decreasing', 'deg', 'grad', 'rad', 'turn',
  'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'srgb', 'srgb-linear',
  'xyz', 'xyz-d50', 'xyz-d65',
])

export function extractGradientColors(value) {
  const colorFunctions = new Set([
    'rgb', 'rgba', 'hsl', 'hsla', 'lab', 'lch', 'oklab', 'oklch',
    'hwb', 'color', 'color-mix', 'color-contrast', 'device-cmyk',
  ])
  const colors = []
  let index = 0

  while (index < value.length) {
    if (value[index] === '#') {
      const match = value.slice(index).match(/^#[0-9a-fA-F]{3,8}\b/)
      if (match) {
        colors.push(match[0])
        index += match[0].length
        continue
      }
    }

    const match = value.slice(index).match(/^[a-zA-Z][\w-]*/)
    if (!match) {
      index += 1
      continue
    }

    const word = match[0]
    const lowerWord = word.toLowerCase()
    const afterWord = index + word.length
    if (value[afterWord] === '(') {
      if (colorFunctions.has(lowerWord)) {
        let depth = 0
        for (let end = afterWord; end < value.length; end += 1) {
          if (value[end] === '(') depth += 1
          else if (value[end] === ')') {
            depth -= 1
            if (depth === 0) {
              colors.push(value.slice(index, end + 1))
              index = end + 1
              break
            }
          }
        }
        if (depth === 0) continue
      }
      index = afterWord + 1
      continue
    }

    if (!GRADIENT_KEYWORDS.has(lowerWord)) colors.push(word)
    index = afterWord
  }

  return colors
}

export function setLuminance(hsl, value) {
  if (!hsl || typeof hsl.l !== 'number') return hsl;
  const newL = Math.max(0, Math.min(1, value));
  return { h: hsl.h, s: hsl.s, l: newL };
}

export function contrastRatio(back, fore) {
  try {
    return Math.round(chroma.contrast(back, fore) * 100) / 100;
  } catch {
    return 1;
  }
}

export function replaceColorStops(cssValue, sourceColors, replacementColors) {
  if (!Array.isArray(sourceColors) || sourceColors.length !== replacementColors.length) {
    return cssValue
  }

  let searchFrom = 0
  const positions = sourceColors.map((color) => {
    const index = cssValue.indexOf(color, searchFrom)
    if (index !== -1) searchFrom = index + color.length
    return index
  })
  if (positions.some((position) => position < 0)) return cssValue

  let result = cssValue
  for (let index = positions.length - 1; index >= 0; index -= 1) {
    const start = positions[index]
    result = result.slice(0, start) + replacementColors[index] + result.slice(start + sourceColors[index].length)
  }
  return result
}

export function findBackgroundDeclaration(html, targetXpath) {
  if (!html || !targetXpath) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let current = findElementWithXpath(doc, targetXpath)
  while (current && current !== doc.body) {
    const style = current.style
    const backgroundImage = style?.backgroundImage || ''
    const background = style?.background || ''
    const backgroundColor = style?.backgroundColor || ''
    let propertyName = ''
    let styleValue = ''
    if (/(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(backgroundImage)) {
      propertyName = 'background-image'
      styleValue = backgroundImage
    } else if (/(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(background)) {
      propertyName = 'background'
      styleValue = background
    } else if (backgroundColor && !/^rgba?\(0\s*,\s*0\s*,\s*0(?:\s*,\s*0)?\)$/i.test(backgroundColor)) {
      propertyName = 'background-color'
      styleValue = backgroundColor
    } else if (background) {
      propertyName = 'background'
      styleValue = background
    }

    if (styleValue) {
      return {
        styleValue,
        propertyName,
        ownerXpath: findXpathFromElement(current),
      }
    }

    const ownerXpath = findXpathFromElement(current)
    const computedStyle = getComputedStyle(html, ownerXpath)
    const computedBackgroundImage = computedStyle?.backgroundImage || ''
    if (/(?:repeating-)?(?:linear|radial|conic)-gradient\(/i.test(computedBackgroundImage)) {
      return {
        styleValue: computedBackgroundImage,
        propertyName: 'background-image',
        ownerXpath,
      }
    }
    const computedBackgroundColor = computedStyle?.backgroundColor || ''
    if (computedBackgroundColor && !/^rgba?\(0\s*,\s*0\s*,\s*0(?:\s*,\s*0)?\)$/i.test(computedBackgroundColor)) {
      return {
        styleValue: computedBackgroundColor,
        propertyName: 'background-color',
        ownerXpath,
      }
    }
    current = current.parentElement
  }
  return null
}

export function joinXpath(baseXpath, relativeXpath) {
  const base = typeof baseXpath === 'string' ? baseXpath.replace(/\/+$/, '') : ''
  const relative = typeof relativeXpath === 'string' ? relativeXpath.replace(/^\/+/, '') : ''
  return [base, relative].filter(Boolean).join('/')
}

export function convertHtmlRgb2Hex(html) {
  return html.replace(/rgb\((\d+,\s*\d+,\s*\d+)\)(?=[^<]*>)/ig, (_, rgb) => {
    return '#' + rgb.split(',')
      .map(str => parseInt(str, 10).toString(16).padStart(2, '0'))
      .join('')
  })
}

export function getComputedStyle(html, relativeXpath = '') {
  if ( !html ) return null;

  const tempElementId = 'udoit-temp-contrast-element'

  let elementInDOM = document.getElementById(tempElementId)
  if(!elementInDOM) {
    // If the element isn't already in the DOM, we need to add it so that we can compute styles
    elementInDOM = document.createElement('div')
    elementInDOM.id = tempElementId
    document.body.appendChild(elementInDOM)
  }

  elementInDOM.innerHTML = html;
  let styles = null;

  if (relativeXpath) {
    let relativeElement = findElementWithXpath(elementInDOM, relativeXpath);
    if (relativeElement) {
      styles = window.getComputedStyle(relativeElement);
    }
  }
  if (!styles) {
    styles = window.getComputedStyle(elementInDOM);
  }
  // For some reason, the styles object gets cleared when we remove the element from the DOM,
  // so we need to make a copy of it before removing the element
  let deepCopy = Object.assign({}, styles);
  elementInDOM.remove();

  return deepCopy;
}
