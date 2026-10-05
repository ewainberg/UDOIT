import * as Html from "../Html";
import { ARIA_ATTRIBUTE_DEFINITIONS } from "./AriaAttributes";
import { getAriaRecommendationPolicy } from "./AriaRecommendationPolicy";

const MAX_TEXT_LENGTH = 300;
const MAX_HTML_LENGTH = 4000;
const MAX_CANDIDATE_IDS = 100;
const MAX_EVIDENCE_VALUES = 25;

const NATIVE_VALUE_ATTRIBUTES = {
  "aria-valuemin": ["min"],
  "aria-valuemax": ["max"],
  "aria-valuenow": ["value"],
  "aria-valuetext": ["value"],
};

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...`;
}

function getText(element) {
  return truncate((element.textContent || "").trim().replace(/\s+/g, " "), MAX_TEXT_LENGTH);
}

function getElementSummary(element) {
  return {
    tagName: element.tagName.toLowerCase(),
    id: element.id || "",
    role: element.getAttribute("role") || "",
    text: getText(element),
    html: truncate(element.outerHTML, MAX_HTML_LENGTH),
    attributes: Array.from(element.attributes).reduce((attributes, attribute) => {
      attributes[attribute.name] = attribute.value;
      return attributes;
    }, {}),
  };
}

function getAncestors(element) {
  const ancestors = [];
  let ancestor = element.parentElement;
  while (ancestor && ancestor.tagName.toLowerCase() !== "body" && ancestors.length < 4) {
    ancestors.push(getElementSummary(ancestor));
    ancestor = ancestor.parentElement;
  }
  return ancestors;
}

function getSiblings(element) {
  if (!element.parentElement) {
    return [];
  }
  return Array.from(element.parentElement.children)
    .filter((sibling) => sibling !== element)
    .slice(0, 25)
    .map(getElementSummary);
}

function getLocalMarkup(element) {
  const siblings = Array.from(element.parentElement?.children || []);
  const elementIndex = siblings.indexOf(element);
  const localElements = siblings.slice(
    Math.max(0, elementIndex - 2),
    elementIndex + 3,
  );
  return truncate(
    localElements.map((localElement) => localElement.outerHTML).join(""),
    MAX_HTML_LENGTH,
  );
}

function getCandidateIds(document, target, attributeName) {
  const currentReferences = new Set(
    (target.getAttribute(attributeName) || "").split(/\s+/).filter(Boolean),
  );
  return Array.from(document.querySelectorAll("[id]"))
    .sort((first, second) => {
      const firstIsReferenced = currentReferences.has(first.id);
      const secondIsReferenced = currentReferences.has(second.id);
      return Number(secondIsReferenced) - Number(firstIsReferenced);
    })
    .slice(0, MAX_CANDIDATE_IDS)
    .map((element) => ({
      ...getElementSummary(element),
      relationship: target.contains(element)
        ? "descendant"
        : element.contains(target)
          ? "ancestor"
          : "other",
    }));
}

function getStructure(element) {
  const container = element.closest("table, nav, [role='grid'], [role='tree'], [role='listbox'], [role='menu'], [role='tablist'], [role='radiogroup']");
  if (!container) {
    return null;
  }
  return {
    container: getElementSummary(container),
    itemCount: container.querySelectorAll("[role], tr, td, th, li, option").length,
  };
}

function addEvidence(evidence, value, source) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (
    normalizedValue === "" ||
    evidence.some((item) => item.value === normalizedValue) ||
    evidence.length >= MAX_EVIDENCE_VALUES
  ) {
    return;
  }
  evidence.push({ value: normalizedValue, source });
}

function getLabelText(document, target) {
  const labels = [];
  if (target.id) {
    document.querySelectorAll("label[for]").forEach((label) => {
      if (label.getAttribute("for") === target.id) {
        labels.push(label);
      }
    });
  }
  const wrappingLabel = target.closest("label");
  if (wrappingLabel) {
    labels.push(wrappingLabel);
  }
  return labels.map((label) => getText(label));
}

function getExactValueEvidence(document, target, attributeName) {
  const evidence = [];
  const definition = ARIA_ATTRIBUTE_DEFINITIONS[attributeName];
  if (!definition) {
    return evidence;
  }

  if (definition.valueType === "idref" || definition.valueType === "idrefs") {
    getCandidateIds(document, target, attributeName).forEach((candidate) => {
      addEvidence(evidence, candidate.id, `existing ID on <${candidate.tagName}>`);
    });
    return evidence;
  }

  const addTextEvidence = (value, source) => {
    if (definition.valueType === "integer" || definition.valueType === "number") {
      (value.match(/-?(?:\d+(?:\.\d+)?|\.\d+)/g) || []).forEach((number) => {
        addEvidence(evidence, number, `number in ${source}`);
      });
      return;
    }
    addEvidence(evidence, value, source);
  };

  (NATIVE_VALUE_ATTRIBUTES[attributeName] || []).forEach((name) => {
    addEvidence(evidence, target.getAttribute(name), `native ${name} attribute`);
  });

  ["title", "placeholder", "value"].forEach((name) => {
    addTextEvidence(target.getAttribute(name) || "", `native ${name} attribute`);
  });
  getLabelText(document, target).forEach((text) => {
    addTextEvidence(text, "visible label");
  });
  addTextEvidence(getText(target), "element text");

  Array.from(target.parentElement?.children || [])
    .filter((element) => element !== target)
    .slice(0, 10)
    .forEach((element) =>
      addTextEvidence(getText(element), "nearby visible text"),
    );

  return evidence;
}

export function collectAriaRecommendationContext({
  attributeName,
  activeIssue,
  contentHtml,
}) {
  const policy = getAriaRecommendationPolicy(attributeName);
  if (!policy || !activeIssue || !contentHtml) {
    return null;
  }

  const document = new DOMParser().parseFromString(contentHtml, "text/html");
  const target = Html.findElementWithIssue(document, activeIssue);
  if (!target) {
    return null;
  }

  const availableContext = {
    target: getElementSummary(target),
    localMarkup: getLocalMarkup(target),
    candidateIds: getCandidateIds(document, target, attributeName),
    ancestors: getAncestors(target),
    siblings: getSiblings(target),
    structure: getStructure(target),
    evidence: getExactValueEvidence(document, target, attributeName),
  };

  const context = policy.context.reduce((context, field) => {
    context[field] = availableContext[field];
    return context;
  }, {});
  context.evidence = availableContext.evidence;
  return context;
}
