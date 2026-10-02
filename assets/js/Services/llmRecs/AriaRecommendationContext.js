import * as Html from "../Html";
import { getAriaRecommendationPolicy } from "./AriaRecommendationPolicy";

const MAX_TEXT_LENGTH = 300;
const MAX_HTML_LENGTH = 4000;
const MAX_CANDIDATE_IDS = 100;

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
  };

  return policy.context.reduce((context, field) => {
    context[field] = availableContext[field];
    return context;
  }, {});
}
