import { ARIA_ATTRIBUTE_DEFINITIONS } from "./AriaAttributes";

export const ARIA_RECOMMENDATION_MODES = {
  SELECTION: "selection",
  DRAFT: "draft",
  REVIEW: "review",
};

const REVIEW_ONLY_ATTRIBUTES = new Set([
  "aria-dropeffect",
  "aria-flowto",
  "aria-grabbed",
  "aria-keyshortcuts",
  "aria-owns",
  "aria-roledescription",
]);

const ATTRIBUTE_CONTEXT = {};

function setContext(attributes, fields) {
  attributes.forEach((attribute) => {
    ATTRIBUTE_CONTEXT[attribute] = fields;
  });
}

setContext(["aria-activedescendant"], ["target", "candidateIds", "structure"]);
setContext(["aria-controls", "aria-details", "aria-errormessage"], ["target", "candidateIds", "localMarkup"]);
setContext(["aria-describedby", "aria-labelledby"], ["target", "candidateIds", "localMarkup", "ancestors"]);
setContext(["aria-atomic", "aria-busy", "aria-live", "aria-relevant"], ["target", "localMarkup", "structure"]);
setContext(["aria-autocomplete", "aria-expanded", "aria-haspopup", "aria-modal"], ["target", "localMarkup", "structure", "candidateIds"]);
setContext(["aria-checked", "aria-current", "aria-pressed", "aria-selected"], ["target", "siblings", "structure"]);
setContext(["aria-hidden"], ["target", "localMarkup", "ancestors", "structure"]);
setContext(["aria-disabled", "aria-invalid", "aria-multiline", "aria-multiselectable", "aria-orientation", "aria-readonly", "aria-required"], ["target", "localMarkup", "structure"]);
setContext(["aria-description", "aria-label", "aria-placeholder", "aria-roledescription"], ["target", "localMarkup", "ancestors"]);
setContext(["aria-level", "aria-posinset", "aria-setsize"], ["target", "ancestors", "siblings", "structure"]);
setContext(["aria-colcount", "aria-colindex", "aria-colindextext", "aria-colspan", "aria-rowcount", "aria-rowindex", "aria-rowindextext", "aria-rowspan", "aria-sort"], ["target", "structure", "ancestors"]);
setContext(["aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"], ["target", "localMarkup", "structure"]);
setContext(["aria-flowto", "aria-keyshortcuts", "aria-owns"], ["target", "candidateIds", "localMarkup", "ancestors", "siblings", "structure"]);

function normalizeAttributeName(attributeName) {
  return typeof attributeName === "string" ? attributeName.toLowerCase() : "";
}

export function getAriaRecommendationPolicy(attributeName) {
  const normalizedAttributeName = normalizeAttributeName(attributeName);
  const definition = ARIA_ATTRIBUTE_DEFINITIONS[normalizedAttributeName];
  if (!definition) {
    return null;
  }

  const mode = REVIEW_ONLY_ATTRIBUTES.has(normalizedAttributeName)
    ? ARIA_RECOMMENDATION_MODES.REVIEW
    : definition.finiteValues
      ? ARIA_RECOMMENDATION_MODES.SELECTION
      : ARIA_RECOMMENDATION_MODES.DRAFT;

  return {
    mode,
    context: ATTRIBUTE_CONTEXT[normalizedAttributeName] || ["target"],
  };
}
